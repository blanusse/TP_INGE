import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { MpOauthService } from './mp-oauth.service';
import { User } from '../entities/user.entity';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRepo() {
  return {
    findOne: jest.fn(),
    update: jest.fn(),
  };
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('MpOauthService', () => {
  let service: MpOauthService;
  let usersRepo: ReturnType<typeof makeRepo>;

  const USER_ID = 'user-uuid-1';

  beforeEach(async () => {
    usersRepo = makeRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MpOauthService,
        { provide: getRepositoryToken(User), useValue: usersRepo },
      ],
    }).compile();

    service = module.get<MpOauthService>(MpOauthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  // ── getAuthUrl ────────────────────────────────────────────────────────────

  describe('getAuthUrl', () => {
    test('GIVEN env vars configuradas WHEN getAuthUrl THEN devuelve URL de autorización con state firmado', () => {
      // GIVEN
      process.env.MP_CLIENT_ID = 'test-client-id';
      process.env.MP_REDIRECT_URI = 'http://localhost/callback';
      process.env.JWT_SECRET = 'test-jwt-secret';

      // WHEN
      const url = service.getAuthUrl(USER_ID);

      // THEN
      expect(url).toContain('https://auth.mercadopago.com/authorization');
      expect(url).toContain('client_id=test-client-id');
      expect(url).toContain('redirect_uri=');
      // state debe empezar con userId y tener tres componentes (userId.nonce.hmac)
      const stateMatch = url.match(/state=([^&]+)/);
      expect(stateMatch).toBeTruthy();
      const decoded = decodeURIComponent(stateMatch![1]);
      const parts = decoded.split('.');
      expect(parts).toHaveLength(3);
      expect(parts[0]).toBe(USER_ID);
    });

    test('GIVEN env vars faltantes WHEN getAuthUrl THEN lanza BadRequestException', () => {
      // GIVEN
      delete process.env.MP_CLIENT_ID;
      delete process.env.MP_REDIRECT_URI;

      // WHEN / THEN
      expect(() => service.getAuthUrl(USER_ID)).toThrow(BadRequestException);
    });
  });

  // ── handleCallback ────────────────────────────────────────────────────────

  describe('handleCallback', () => {
    test('GIVEN código válido + state firmado WHEN callback THEN actualiza mp_user_id del usuario', async () => {
      // GIVEN
      process.env.MP_CLIENT_ID = 'test-id';
      process.env.MP_CLIENT_SECRET = 'test-secret';
      process.env.MP_REDIRECT_URI = 'http://localhost/callback';
      process.env.JWT_SECRET = 'test-jwt-secret';

      const mockFetch = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ user_id: 12345 }),
      } as any);
      usersRepo.update.mockResolvedValue({});

      // Generar el state firmado vía getAuthUrl para reusar la firma real
      const url = service.getAuthUrl(USER_ID);
      const state = decodeURIComponent(url.match(/state=([^&]+)/)![1]);

      // WHEN
      await service.handleCallback('auth-code', state);

      // THEN
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(usersRepo.update).toHaveBeenCalledWith(USER_ID, { mp_user_id: '12345' });
    });

    test('GIVEN state inválido WHEN callback THEN rechaza con UnauthorizedException', async () => {
      process.env.JWT_SECRET = 'test-jwt-secret';
      await expect(
        service.handleCallback('any-code', `${USER_ID}.nonce.deadbeef`),
      ).rejects.toThrow();
    });

    test('GIVEN respuesta error de MP WHEN callback THEN lanza BadRequestException', async () => {
      // GIVEN
      process.env.MP_CLIENT_ID = 'test-id';
      process.env.MP_CLIENT_SECRET = 'test-secret';
      process.env.MP_REDIRECT_URI = 'http://localhost/callback';
      process.env.JWT_SECRET = 'test-jwt-secret';

      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        text: () => Promise.resolve('invalid_grant'),
      } as any);

      const url = service.getAuthUrl(USER_ID);
      const state = decodeURIComponent(url.match(/state=([^&]+)/)![1]);

      // WHEN / THEN
      await expect(service.handleCallback('bad-code', state)).rejects.toThrow(BadRequestException);
    });
  });

  // ── getStatus ─────────────────────────────────────────────────────────────

  describe('getStatus', () => {
    test('GIVEN usuario con mp_user_id WHEN getStatus THEN devuelve connected true', async () => {
      // GIVEN
      usersRepo.findOne.mockResolvedValue({ id: USER_ID, mp_user_id: '12345' });

      // WHEN
      const result = await service.getStatus(USER_ID);

      // THEN
      expect(result).toEqual({ connected: true });
    });

    test('GIVEN usuario sin mp_user_id WHEN getStatus THEN devuelve connected false', async () => {
      // GIVEN
      usersRepo.findOne.mockResolvedValue({ id: USER_ID, mp_user_id: null });

      // WHEN
      const result = await service.getStatus(USER_ID);

      // THEN
      expect(result).toEqual({ connected: false });
    });

    test('GIVEN usuario inexistente WHEN getStatus THEN devuelve connected false', async () => {
      // GIVEN
      usersRepo.findOne.mockResolvedValue(null);

      // WHEN
      const result = await service.getStatus(USER_ID);

      // THEN
      expect(result).toEqual({ connected: false });
    });
  });
});
