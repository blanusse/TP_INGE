import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';

// Mock bcryptjs antes de importar el servicio
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('$2a$12$mockedhash'),
  compare: jest.fn(),
}));
import * as bcrypt from 'bcryptjs';
const mockCompare = bcrypt.compare as jest.Mock;
import { User } from '../entities/user.entity';
import { Shipper } from '../entities/shipper.entity';
import { EmailVerification } from '../entities/email-verification.entity';
import { FleetInvitation } from '../entities/fleet-invitation.entity';
import { EmailService } from '../email/email.service';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRepo() {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    create: jest.fn((data) => ({ ...data })),
    update: jest.fn(),
    delete: jest.fn(),
  };
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('AuthService', () => {
  let service: AuthService;
  let usersRepo: ReturnType<typeof makeRepo>;
  let shippersRepo: ReturnType<typeof makeRepo>;
  let verificationsRepo: ReturnType<typeof makeRepo>;
  let invitationsRepo: ReturnType<typeof makeRepo>;
  let jwtService: { sign: jest.Mock };
  let emailService: { sendVerificationCode: jest.Mock };

  const VALID_REGISTER = {
    email: 'test@example.com',
    password: 'password123',
    name: 'Juan Perez',
    role: 'transportista' as const,
    dni: '30123456',
  };

  beforeEach(async () => {
    usersRepo = makeRepo();
    shippersRepo = makeRepo();
    verificationsRepo = makeRepo();
    invitationsRepo = makeRepo();
    jwtService = { sign: jest.fn().mockReturnValue('mock-jwt-token') };
    emailService = { sendVerificationCode: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: usersRepo },
        { provide: getRepositoryToken(Shipper), useValue: shippersRepo },
        { provide: getRepositoryToken(EmailVerification), useValue: verificationsRepo },
        { provide: getRepositoryToken(FleetInvitation), useValue: invitationsRepo },
        { provide: JwtService, useValue: jwtService },
        { provide: EmailService, useValue: emailService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => jest.clearAllMocks());

  // ══════════════════════════════════════════════════════════════════════════
  //  register
  // ══════════════════════════════════════════════════════════════════════════

  describe('register', () => {
    beforeEach(() => {
      // Default: no hay conflictos
      usersRepo.findOne.mockResolvedValue(null);
      shippersRepo.findOne.mockResolvedValue(null);
      usersRepo.save.mockImplementation((u) => Promise.resolve({ id: 'new-user-id', ...u }));
      verificationsRepo.save.mockResolvedValue({});
    });

    test('GIVEN datos válidos de transportista WHEN registra THEN crea usuario y devuelve ok', async () => {
      // WHEN
      const result = await service.register(VALID_REGISTER);

      // THEN
      expect(result).toEqual({ ok: true });
      expect(usersRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
          role: 'transportista',
          is_verified: false,
        }),
      );
      expect(usersRepo.save).toHaveBeenCalledTimes(1);
    });

    test('GIVEN email duplicado WHEN registra THEN lanza ConflictException', async () => {
      // GIVEN
      usersRepo.findOne.mockResolvedValueOnce({ id: 'existing', email: 'test@example.com' });

      // WHEN / THEN
      await expect(service.register(VALID_REGISTER)).rejects.toThrow(ConflictException);
    });

    test('GIVEN teléfono duplicado WHEN registra THEN lanza ConflictException', async () => {
      // GIVEN — email no existe (primer findOne), pero teléfono sí (segundo findOne)
      usersRepo.findOne
        .mockResolvedValueOnce(null)          // email check
        .mockResolvedValueOnce({ id: 'x' });  // phone check

      // WHEN / THEN
      await expect(
        service.register({ ...VALID_REGISTER, phone: '1155550000' }),
      ).rejects.toThrow(ConflictException);
    });

    test('GIVEN DNI inválido (muy corto) WHEN registra THEN lanza BadRequestException', async () => {
      // WHEN / THEN
      await expect(
        service.register({ ...VALID_REGISTER, dni: '123' }),
      ).rejects.toThrow(BadRequestException);
    });

    test('GIVEN DNI inválido (fuera de rango) WHEN registra THEN lanza BadRequestException', async () => {
      // WHEN / THEN
      await expect(
        service.register({ ...VALID_REGISTER, dni: '0000001' }),
      ).rejects.toThrow(BadRequestException);
    });

    test('GIVEN DNI duplicado para mismo rol WHEN registra THEN lanza ConflictException', async () => {
      // GIVEN — email OK, phone skip, DNI check hits
      usersRepo.findOne
        .mockResolvedValueOnce(null)           // email
        .mockResolvedValueOnce({ id: 'dup' }); // DNI + role

      // WHEN / THEN
      await expect(service.register(VALID_REGISTER)).rejects.toThrow(ConflictException);
    });

    test('GIVEN contraseña menor a 8 caracteres WHEN registra THEN lanza BadRequestException', async () => {
      // WHEN / THEN
      await expect(
        service.register({ ...VALID_REGISTER, password: 'short' }),
      ).rejects.toThrow(BadRequestException);
    });

    test('GIVEN role dador tipo empresa WHEN registra THEN crea shipper con CUIT', async () => {
      // GIVEN
      const dto = {
        ...VALID_REGISTER,
        role: 'dador' as const,
        tipo_dador: 'empresa' as const,
        cuit: '20301234563',  // CUIT válido
        razon_social: 'Mi Empresa SA',
      };
      shippersRepo.save.mockResolvedValue({});

      // WHEN
      const result = await service.register(dto);

      // THEN
      expect(result).toEqual({ ok: true });
      expect(shippersRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo: 'empresa',
          cuit: '20301234563',
        }),
      );
      expect(shippersRepo.save).toHaveBeenCalledTimes(1);
    });

    test('GIVEN CUIT inválido WHEN registra como empresa THEN lanza BadRequestException', async () => {
      const dto = {
        ...VALID_REGISTER,
        role: 'dador' as const,
        tipo_dador: 'empresa' as const,
        cuit: '12345678901',
      };

      // WHEN / THEN
      await expect(service.register(dto)).rejects.toThrow(BadRequestException);
    });

    test('GIVEN role empleado sin invitation_token WHEN registra THEN lanza BadRequestException', async () => {
      const dto = { ...VALID_REGISTER, role: 'empleado' as const };

      // WHEN / THEN
      await expect(service.register(dto)).rejects.toThrow(BadRequestException);
    });

    test('GIVEN invitation token inválido WHEN registra como empleado THEN lanza NotFoundException', async () => {
      const dto = {
        ...VALID_REGISTER,
        role: 'empleado' as const,
        invitation_token: 'bad-token',
      };
      invitationsRepo.findOne.mockResolvedValue(null);

      // WHEN / THEN
      await expect(service.register(dto)).rejects.toThrow(NotFoundException);
    });

    test('GIVEN invitation ya aceptada WHEN registra como empleado THEN lanza GoneException', async () => {
      const dto = {
        ...VALID_REGISTER,
        role: 'empleado' as const,
        invitation_token: 'used-token',
      };
      invitationsRepo.findOne.mockResolvedValue({
        token: 'used-token',
        status: 'accepted',
        email: 'test@example.com',
      });

      // WHEN / THEN
      await expect(service.register(dto)).rejects.toThrow(GoneException);
    });

    test('GIVEN invitation expirada WHEN registra como empleado THEN lanza GoneException', async () => {
      const dto = {
        ...VALID_REGISTER,
        role: 'empleado' as const,
        invitation_token: 'expired-token',
      };
      invitationsRepo.findOne.mockResolvedValue({
        token: 'expired-token',
        status: 'pending',
        expires_at: new Date('2020-01-01'),
        email: 'test@example.com',
      });
      invitationsRepo.save.mockResolvedValue({});

      // WHEN / THEN
      await expect(service.register(dto)).rejects.toThrow(GoneException);
    });

    test('GIVEN invitation con email distinto WHEN registra como empleado THEN lanza ForbiddenException', async () => {
      const dto = {
        ...VALID_REGISTER,
        role: 'empleado' as const,
        invitation_token: 'valid-token',
      };
      invitationsRepo.findOne.mockResolvedValue({
        token: 'valid-token',
        status: 'pending',
        expires_at: new Date(Date.now() + 60000),
        email: 'otro@example.com',
      });

      // WHEN / THEN
      await expect(service.register(dto)).rejects.toThrow(ForbiddenException);
    });

    test('GIVEN role flota WHEN registra THEN usuario tiene is_fleet_owner true', async () => {
      const dto = { ...VALID_REGISTER, role: 'flota' as const };

      // WHEN
      await service.register(dto);

      // THEN
      expect(usersRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ is_fleet_owner: true }),
      );
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  //  login
  // ══════════════════════════════════════════════════════════════════════════

  describe('login', () => {
    const MOCK_USER = {
      id: 'user-1',
      email: 'test@example.com',
      name: 'Juan',
      password_hash: '$2a$12$hashedpassword',
      is_verified: true,
      role: 'transportista',
      account_status: 'active',
      fleet_id: null,
      is_fleet_owner: false,
    };

    test('GIVEN credenciales válidas WHEN login THEN devuelve access_token y datos de usuario', async () => {
      // GIVEN
      usersRepo.findOne.mockResolvedValue(MOCK_USER);
      mockCompare.mockResolvedValue(true);

      // WHEN
      const result = await service.login({ email: 'test@example.com', password: 'password123' });

      // THEN
      expect(result.access_token).toBe('mock-jwt-token');
      expect(result.user.id).toBe('user-1');
      expect(result.user.role).toBe('transportista');
      expect(jwtService.sign).toHaveBeenCalledWith({ sub: 'user-1', role: 'transportista' });
    });

    test('GIVEN email inexistente WHEN login THEN lanza UnauthorizedException', async () => {
      // GIVEN
      usersRepo.findOne.mockResolvedValue(null);

      // WHEN / THEN
      await expect(
        service.login({ email: 'no@existe.com', password: 'x' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    test('GIVEN contraseña incorrecta WHEN login THEN lanza UnauthorizedException', async () => {
      // GIVEN
      usersRepo.findOne.mockResolvedValue(MOCK_USER);
      mockCompare.mockResolvedValue(false);

      // WHEN / THEN
      await expect(
        service.login({ email: 'test@example.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    test('GIVEN email no verificado WHEN login THEN lanza ForbiddenException con código EMAIL_NOT_VERIFIED', async () => {
      // GIVEN
      usersRepo.findOne.mockResolvedValue({ ...MOCK_USER, is_verified: false });
      mockCompare.mockResolvedValue(true);

      // WHEN / THEN
      await expect(
        service.login({ email: 'test@example.com', password: 'password123' }),
      ).rejects.toThrow(ForbiddenException);
    });

    test('GIVEN cuenta suspendida WHEN login THEN lanza ForbiddenException', async () => {
      // GIVEN
      usersRepo.findOne.mockResolvedValue({ ...MOCK_USER, account_status: 'suspended' });
      mockCompare.mockResolvedValue(true);

      // WHEN / THEN
      await expect(
        service.login({ email: 'test@example.com', password: 'password123' }),
      ).rejects.toThrow(ForbiddenException);
    });

    test('GIVEN cuenta baneada WHEN login THEN lanza ForbiddenException', async () => {
      // GIVEN
      usersRepo.findOne.mockResolvedValue({ ...MOCK_USER, account_status: 'banned' });
      mockCompare.mockResolvedValue(true);

      // WHEN / THEN
      await expect(
        service.login({ email: 'test@example.com', password: 'password123' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  //  checkField
  // ══════════════════════════════════════════════════════════════════════════

  describe('checkField', () => {
    test('GIVEN email disponible WHEN checkField THEN devuelve { available: true }', async () => {
      usersRepo.findOne.mockResolvedValue(null);
      const result = await service.checkField('email', 'new@test.com');
      expect(result).toEqual({ available: true });
    });

    test('GIVEN email ya registrado WHEN checkField THEN devuelve available false con metadata', async () => {
      usersRepo.findOne.mockResolvedValue({
        id: 'x',
        is_verified: true,
        account_status: 'active',
      });
      const result = await service.checkField('email', 'taken@test.com');
      expect(result.available).toBe(false);
      expect(result.is_verified).toBe(true);
    });

    test('GIVEN teléfono disponible WHEN checkField THEN devuelve available true', async () => {
      usersRepo.findOne.mockResolvedValue(null);
      const result = await service.checkField('phone', '1155550000');
      expect(result).toEqual({ available: true });
    });

    test('GIVEN teléfono ocupado WHEN checkField THEN devuelve available false', async () => {
      usersRepo.findOne.mockResolvedValue({ id: 'x' });
      const result = await service.checkField('phone', '1155550000');
      expect(result.available).toBe(false);
    });

    test('GIVEN DNI disponible WHEN checkField THEN devuelve available true', async () => {
      usersRepo.findOne.mockResolvedValue(null);
      const result = await service.checkField('dni', '30123456');
      expect(result).toEqual({ available: true });
    });

    test('GIVEN CUIT disponible WHEN checkField THEN devuelve available true', async () => {
      shippersRepo.findOne.mockResolvedValue(null);
      const result = await service.checkField('cuit', '20301234560');
      expect(result).toEqual({ available: true });
    });

    test('GIVEN campo vacío WHEN checkField THEN devuelve available true', async () => {
      const result = await service.checkField('email', '');
      expect(result).toEqual({ available: true });
    });

    test('GIVEN campo desconocido WHEN checkField THEN devuelve available true', async () => {
      const result = await service.checkField('unknown', 'value');
      expect(result).toEqual({ available: true });
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  //  verifyEmail
  // ══════════════════════════════════════════════════════════════════════════

  describe('verifyEmail', () => {
    const MOCK_USER = { id: 'u1', email: 'test@example.com', is_verified: false };

    test('GIVEN código correcto WHEN verifica THEN marca usuario como verificado', async () => {
      // GIVEN
      usersRepo.findOne.mockResolvedValue({ ...MOCK_USER });
      verificationsRepo.findOne.mockResolvedValue({
        code: '123456',
        expires_at: new Date(Date.now() + 60000),
        attempts: 0,
        used: false,
      });
      verificationsRepo.save.mockResolvedValue({});
      usersRepo.save.mockResolvedValue({});

      // WHEN
      const result = await service.verifyEmail('test@example.com', '123456');

      // THEN
      expect(result).toEqual({ ok: true });
      expect(usersRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ is_verified: true }),
      );
    });

    test('GIVEN email no registrado WHEN verifica THEN lanza NotFoundException', async () => {
      usersRepo.findOne.mockResolvedValue(null);
      await expect(service.verifyEmail('no@existe.com', '123456')).rejects.toThrow(NotFoundException);
    });

    test('GIVEN cuenta ya verificada WHEN verifica THEN lanza ConflictException', async () => {
      usersRepo.findOne.mockResolvedValue({ ...MOCK_USER, is_verified: true });
      await expect(service.verifyEmail('test@example.com', '123456')).rejects.toThrow(ConflictException);
    });

    test('GIVEN no hay código activo WHEN verifica THEN lanza BadRequestException', async () => {
      usersRepo.findOne.mockResolvedValue({ ...MOCK_USER });
      verificationsRepo.findOne.mockResolvedValue(null);
      await expect(service.verifyEmail('test@example.com', '123456')).rejects.toThrow(BadRequestException);
    });

    test('GIVEN código expirado WHEN verifica THEN lanza BadRequestException', async () => {
      usersRepo.findOne.mockResolvedValue({ ...MOCK_USER });
      verificationsRepo.findOne.mockResolvedValue({
        code: '123456',
        expires_at: new Date('2020-01-01'),
        attempts: 0,
        used: false,
      });
      verificationsRepo.save.mockResolvedValue({});

      await expect(service.verifyEmail('test@example.com', '123456')).rejects.toThrow(BadRequestException);
    });

    test('GIVEN 3 intentos previos WHEN verifica THEN lanza BadRequestException', async () => {
      usersRepo.findOne.mockResolvedValue({ ...MOCK_USER });
      verificationsRepo.findOne.mockResolvedValue({
        code: '123456',
        expires_at: new Date(Date.now() + 60000),
        attempts: 3,
        used: false,
      });

      await expect(service.verifyEmail('test@example.com', '123456')).rejects.toThrow(BadRequestException);
    });

    test('GIVEN código incorrecto WHEN verifica THEN incrementa intentos y lanza BadRequestException', async () => {
      const verification = {
        code: '123456',
        expires_at: new Date(Date.now() + 60000),
        attempts: 0,
        used: false,
      };
      usersRepo.findOne.mockResolvedValue({ ...MOCK_USER });
      verificationsRepo.findOne.mockResolvedValue(verification);
      verificationsRepo.save.mockResolvedValue({});

      await expect(service.verifyEmail('test@example.com', '000000')).rejects.toThrow(BadRequestException);
      expect(verification.attempts).toBe(1);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  //  resendCode
  // ══════════════════════════════════════════════════════════════════════════

  describe('resendCode', () => {
    test('GIVEN usuario no verificado WHEN resend THEN invalida códigos previos y envía nuevo', async () => {
      // GIVEN
      usersRepo.findOne.mockResolvedValue({ id: 'u1', email: 'test@example.com', is_verified: false });
      verificationsRepo.update.mockResolvedValue({});
      verificationsRepo.save.mockResolvedValue({});

      // WHEN
      const result = await service.resendCode('test@example.com');

      // THEN
      expect(result).toEqual({ ok: true });
      expect(verificationsRepo.update).toHaveBeenCalledWith(
        { user_id: 'u1', used: false },
        { used: true },
      );
      expect(verificationsRepo.create).toHaveBeenCalled();
    });

    test('GIVEN email no registrado WHEN resend THEN lanza NotFoundException', async () => {
      usersRepo.findOne.mockResolvedValue(null);
      await expect(service.resendCode('no@existe.com')).rejects.toThrow(NotFoundException);
    });

    test('GIVEN cuenta ya verificada WHEN resend THEN lanza ConflictException', async () => {
      usersRepo.findOne.mockResolvedValue({ id: 'u1', is_verified: true });
      await expect(service.resendCode('test@example.com')).rejects.toThrow(ConflictException);
    });
  });
});
