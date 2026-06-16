import { Test, TestingModule } from '@nestjs/testing';
import { MpOauthController } from './mp-oauth.controller';
import { MpOauthService } from './mp-oauth.service';

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('MpOauthController', () => {
  let controller: MpOauthController;
  let service: {
    getAuthUrl: jest.Mock;
    handleCallback: jest.Mock;
    getStatus: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      getAuthUrl: jest.fn(),
      handleCallback: jest.fn(),
      getStatus: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MpOauthController],
      providers: [{ provide: MpOauthService, useValue: service }],
    }).compile();

    controller = module.get<MpOauthController>(MpOauthController);
  });

  afterEach(() => jest.clearAllMocks());

  describe('connect', () => {
    test('GIVEN usuario autenticado WHEN connect THEN redirige a URL de MP', () => {
      // GIVEN
      const req = { user: { id: 'user-1', role: 'transportista' } } as any;
      const res = { redirect: jest.fn() } as any;
      service.getAuthUrl.mockReturnValue('https://auth.mercadopago.com/authorization?...');

      // WHEN
      controller.connect(req, res);

      // THEN
      expect(service.getAuthUrl).toHaveBeenCalledWith('user-1');
      expect(res.redirect).toHaveBeenCalledWith('https://auth.mercadopago.com/authorization?...');
    });
  });

  describe('callback', () => {
    test('GIVEN código válido WHEN callback THEN redirige con mp_connected=true', async () => {
      // GIVEN
      const res = { redirect: jest.fn() } as any;
      service.handleCallback.mockResolvedValue(undefined);
      process.env.FRONTEND_URL = 'http://localhost:3000';

      // WHEN
      await controller.callback('auth-code', 'user-1', res);

      // THEN
      expect(service.handleCallback).toHaveBeenCalledWith('auth-code', 'user-1');
      expect(res.redirect).toHaveBeenCalledWith('http://localhost:3000/perfil?mp_connected=true');
    });

    test('GIVEN error en callback WHEN callback THEN redirige con mp_connected=false', async () => {
      // GIVEN
      const res = { redirect: jest.fn() } as any;
      service.handleCallback.mockRejectedValue(new Error('fail'));
      process.env.FRONTEND_URL = 'http://localhost:3000';

      // WHEN
      await controller.callback('bad-code', 'user-1', res);

      // THEN
      expect(res.redirect).toHaveBeenCalledWith('http://localhost:3000/perfil?mp_connected=false');
    });
  });

  describe('status', () => {
    test('GIVEN usuario autenticado WHEN status THEN delega al service', async () => {
      const req = { user: { id: 'user-1', role: 'transportista' } } as any;
      service.getStatus.mockResolvedValue({ connected: true });

      const result = await controller.status(req);

      expect(service.getStatus).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ connected: true });
    });
  });
});
