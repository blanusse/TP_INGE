import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerException } from '@nestjs/throttler';
import { CustomThrottlerGuard } from './custom-throttler.guard';

const makeContext = (authorization?: string): ExecutionContext => {
  const req = { headers: authorization ? { authorization } : {} };
  const res = { header: jest.fn() };
  return {
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
    getHandler: jest.fn(),
    getClass: jest.fn(),
  } as unknown as ExecutionContext;
};

const makeGuard = () => {
  const options = [
    { name: 'public', ttl: 60_000, limit: 60 },
    { name: 'authenticated', ttl: 60_000, limit: 120 },
    { name: 'auth', ttl: 900_000, limit: 20 },
  ];
  const storage = {} as any;
  const reflector = new Reflector();
  const guard = new CustomThrottlerGuard(options as any, storage, reflector);

  // Stub getRequestResponse to return req/res from context
  (guard as any).getRequestResponse = (ctx: ExecutionContext) => {
    const http = ctx.switchToHttp();
    return { req: http.getRequest(), res: http.getResponse() };
  };

  return guard;
};

describe('CustomThrottlerGuard', () => {
  describe('handleRequest', () => {
    it('skip throttler "public" cuando el request tiene Authorization header', async () => {
      const guard = makeGuard();
      const superHandleRequest = jest
        .spyOn(Object.getPrototypeOf(Object.getPrototypeOf(guard)), 'handleRequest')
        .mockResolvedValue(true);

      const context = makeContext('Bearer token123');
      const result = await (guard as any).handleRequest({
        context,
        throttler: { name: 'public' },
        limit: 60,
        ttl: 60_000,
        blockDuration: 0,
        getTracker: jest.fn(),
        generateKey: jest.fn(),
      });

      expect(result).toBe(true);
      expect(superHandleRequest).not.toHaveBeenCalled();
    });

    it('skip throttler "authenticated" cuando el request no tiene Authorization header', async () => {
      const guard = makeGuard();
      const superHandleRequest = jest
        .spyOn(Object.getPrototypeOf(Object.getPrototypeOf(guard)), 'handleRequest')
        .mockResolvedValue(true);

      const context = makeContext(); // sin auth
      const result = await (guard as any).handleRequest({
        context,
        throttler: { name: 'authenticated' },
        limit: 120,
        ttl: 60_000,
        blockDuration: 0,
        getTracker: jest.fn(),
        generateKey: jest.fn(),
      });

      expect(result).toBe(true);
      expect(superHandleRequest).not.toHaveBeenCalled();
    });

    it('llama a super.handleRequest cuando el throttler coincide con el estado de auth', async () => {
      const guard = makeGuard();
      const superHandleRequest = jest
        .spyOn(Object.getPrototypeOf(Object.getPrototypeOf(guard)), 'handleRequest')
        .mockResolvedValue(true);

      const context = makeContext(); // sin auth → debe evaluar el throttler "public"
      await (guard as any).handleRequest({
        context,
        throttler: { name: 'public' },
        limit: 60,
        ttl: 60_000,
        blockDuration: 0,
        getTracker: jest.fn(),
        generateKey: jest.fn(),
      });

      expect(superHandleRequest).toHaveBeenCalled();
    });
  });

  describe('throwThrottlingException', () => {
    it('agrega header Retry-After y lanza ThrottlerException', async () => {
      const guard = makeGuard();
      const context = makeContext();
      const res = context.switchToHttp().getResponse() as any;

      await expect(
        (guard as any).throwThrottlingException(context, {
          ttl: 30_000, // 30 segundos
          limit: 60,
          key: 'test-key',
          tracker: '127.0.0.1',
          totalHits: 61,
          timeToExpire: 30,
          isBlocked: false,
          timeToBlockExpire: 0,
        }),
      ).rejects.toThrow(ThrottlerException);

      expect(res.header).toHaveBeenCalledWith('Retry-After', '30');
    });

    it('redondea hacia arriba los segundos del Retry-After', async () => {
      const guard = makeGuard();
      const context = makeContext();
      const res = context.switchToHttp().getResponse() as any;

      await expect(
        (guard as any).throwThrottlingException(context, {
          ttl: 45_500, // 45.5 segundos → debe ser 46
          limit: 60,
          key: 'test-key',
          tracker: '127.0.0.1',
          totalHits: 61,
          isBlocked: false,
          timeToExpire: 46,
          timeToBlockExpire: 0,
        }),
      ).rejects.toThrow(ThrottlerException);

      expect(res.header).toHaveBeenCalledWith('Retry-After', '46');
    });
  });
});
