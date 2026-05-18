import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('AuthController', () => {
  let controller: AuthController;
  let service: {
    register: jest.Mock;
    login: jest.Mock;
    checkField: jest.Mock;
    verifyEmail: jest.Mock;
    resendCode: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      register: jest.fn(),
      login: jest.fn(),
      checkField: jest.fn(),
      verifyEmail: jest.fn(),
      resendCode: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: service }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  afterEach(() => jest.clearAllMocks());

  describe('register', () => {
    test('GIVEN dto válido WHEN register THEN delega al service', async () => {
      const dto = { email: 'test@test.com', password: '12345678', name: 'Juan', role: 'transportista' as const };
      service.register.mockResolvedValue({ ok: true });

      const result = await controller.register(dto);

      expect(service.register).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ ok: true });
    });
  });

  describe('login', () => {
    test('GIVEN credenciales WHEN login THEN delega al service', async () => {
      const dto = { email: 'test@test.com', password: '12345678' };
      service.login.mockResolvedValue({ access_token: 'jwt', user: { id: '1' } });

      const result = await controller.login(dto);

      expect(service.login).toHaveBeenCalledWith(dto);
      expect(result.access_token).toBe('jwt');
    });
  });

  describe('check', () => {
    test('GIVEN field y value WHEN check THEN delega a checkField', async () => {
      service.checkField.mockResolvedValue({ available: true });

      const result = await controller.check('email', 'test@test.com', undefined as any);

      expect(service.checkField).toHaveBeenCalledWith('email', 'test@test.com');
      expect(result).toEqual({ available: true });
    });

    test('GIVEN solo email (legacy) WHEN check THEN usa field=email y value=email', async () => {
      service.checkField.mockResolvedValue({ available: false });

      const result = await controller.check(undefined as any, undefined as any, 'old@test.com');

      expect(service.checkField).toHaveBeenCalledWith('email', 'old@test.com');
    });
  });

  describe('verifyEmail', () => {
    test('GIVEN email y code WHEN verifyEmail THEN delega al service', async () => {
      service.verifyEmail.mockResolvedValue({ ok: true });

      const result = await controller.verifyEmail({ email: 'test@test.com', code: '123456' });

      expect(service.verifyEmail).toHaveBeenCalledWith('test@test.com', '123456');
      expect(result).toEqual({ ok: true });
    });
  });

  describe('resendCode', () => {
    test('GIVEN email WHEN resendCode THEN delega al service', async () => {
      service.resendCode.mockResolvedValue({ ok: true });

      const result = await controller.resendCode({ email: 'test@test.com' });

      expect(service.resendCode).toHaveBeenCalledWith('test@test.com');
      expect(result).toEqual({ ok: true });
    });
  });
});
