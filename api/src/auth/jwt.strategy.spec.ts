import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { User } from '../entities/user.entity';

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let usersRepo: { findOne: jest.Mock };

  beforeEach(async () => {
    usersRepo = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: getRepositoryToken(User), useValue: usersRepo },
        {
          provide: ConfigService,
          useValue: { getOrThrow: jest.fn().mockReturnValue('test-secret') },
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  afterEach(() => jest.clearAllMocks());

  describe('validate', () => {
    test('GIVEN usuario activo WHEN validate THEN devuelve { id, role }', async () => {
      // GIVEN
      usersRepo.findOne.mockResolvedValue({ id: 'u1', account_status: 'active' });

      // WHEN
      const result = await strategy.validate({ sub: 'u1', role: 'transportista' });

      // THEN
      expect(result).toEqual({ id: 'u1', role: 'transportista' });
    });

    test('GIVEN usuario inexistente WHEN validate THEN lanza UnauthorizedException', async () => {
      usersRepo.findOne.mockResolvedValue(null);

      await expect(
        strategy.validate({ sub: 'no-existe', role: 'transportista' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    test('GIVEN usuario suspendido WHEN validate THEN lanza UnauthorizedException', async () => {
      usersRepo.findOne.mockResolvedValue({ id: 'u1', account_status: 'suspended' });

      await expect(
        strategy.validate({ sub: 'u1', role: 'transportista' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    test('GIVEN usuario baneado WHEN validate THEN lanza UnauthorizedException', async () => {
      usersRepo.findOne.mockResolvedValue({ id: 'u1', account_status: 'banned' });

      await expect(
        strategy.validate({ sub: 'u1', role: 'transportista' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
