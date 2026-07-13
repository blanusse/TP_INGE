import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { User } from '../entities/user.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { Load } from '../entities/load.entity';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRepo() {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    save: jest.fn(),
    create: jest.fn((data) => ({ ...data })),
    update: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(),
    manager: { find: jest.fn() },
  };
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('AdminService', () => {
  let service: AdminService;
  let usersRepo: ReturnType<typeof makeRepo>;
  let auditRepo: ReturnType<typeof makeRepo>;
  let loadsRepo: ReturnType<typeof makeRepo>;

  const ADMIN_ID = 'admin-uuid';
  const TARGET_ID = 'target-uuid';
  const MOCK_ADMIN = { id: ADMIN_ID, email: 'admin@test.com', role: 'admin' };
  const MOCK_TARGET = { id: TARGET_ID, email: 'user@test.com', role: 'transportista', account_status: 'active' };

  beforeEach(async () => {
    usersRepo = makeRepo();
    auditRepo = makeRepo();
    loadsRepo = makeRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: getRepositoryToken(User), useValue: usersRepo },
        { provide: getRepositoryToken(AuditLog), useValue: auditRepo },
        { provide: getRepositoryToken(Load), useValue: loadsRepo },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── listUsers ─────────────────────────────────────────────────────────────

  describe('listUsers', () => {
    function mockQb(result: [any[], number]) {
      const qb = {
        select: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue(result),
      };
      usersRepo.createQueryBuilder.mockReturnValue(qb);
      return qb;
    }

    test('GIVEN usuarios existentes WHEN listUsers THEN devuelve paginado', async () => {
      // GIVEN
      const users = [{ id: '1', name: 'Juan' }];
      mockQb([users, 1]);

      // WHEN
      const result = await service.listUsers(1, 50);

      // THEN
      expect(result).toEqual({ users, total: 1, page: 1, limit: 50 });
    });

    test('GIVEN búsqueda con search WHEN listUsers THEN aplica filtro ILIKE', async () => {
      // GIVEN
      const qb = mockQb([[], 0]);

      // WHEN
      await service.listUsers(1, 50, 'juan');

      // THEN
      expect(qb.where).toHaveBeenCalledWith(
        'u.name ILIKE :s OR u.email ILIKE :s',
        { s: '%juan%' },
      );
    });

    test('GIVEN página 2 WHEN listUsers THEN aplica skip correcto', async () => {
      // GIVEN
      const qb = mockQb([[], 0]);

      // WHEN
      await service.listUsers(2, 10);

      // THEN
      expect(qb.skip).toHaveBeenCalledWith(10);
      expect(qb.take).toHaveBeenCalledWith(10);
    });
  });

  // ── updateUserStatus ──────────────────────────────────────────────────────

  describe('updateUserStatus', () => {
    test('GIVEN acción suspend WHEN admin suspende usuario THEN actualiza status y crea audit log', async () => {
      // GIVEN
      usersRepo.findOne
        .mockResolvedValueOnce(MOCK_ADMIN)
        .mockResolvedValueOnce(MOCK_TARGET);
      usersRepo.update.mockResolvedValue({});
      auditRepo.save.mockResolvedValue({});

      // WHEN
      const result = await service.updateUserStatus(ADMIN_ID, TARGET_ID, 'suspend', 'spam');

      // THEN
      expect(result).toEqual({ id: TARGET_ID, account_status: 'suspended' });
      expect(usersRepo.update).toHaveBeenCalledWith({ id: TARGET_ID }, { account_status: 'suspended' });
      expect(auditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          admin_id: ADMIN_ID,
          target_user_id: TARGET_ID,
          action: 'suspend',
          reason: 'spam',
        }),
      );
    });

    test('GIVEN acción ban WHEN admin banea THEN status es banned', async () => {
      usersRepo.findOne
        .mockResolvedValueOnce(MOCK_ADMIN)
        .mockResolvedValueOnce(MOCK_TARGET);
      usersRepo.update.mockResolvedValue({});
      auditRepo.save.mockResolvedValue({});

      const result = await service.updateUserStatus(ADMIN_ID, TARGET_ID, 'ban');
      expect(result.account_status).toBe('banned');
    });

    test('GIVEN acción unsuspend WHEN admin reactiva THEN status es active', async () => {
      usersRepo.findOne
        .mockResolvedValueOnce(MOCK_ADMIN)
        .mockResolvedValueOnce({ ...MOCK_TARGET, account_status: 'suspended' });
      usersRepo.update.mockResolvedValue({});
      auditRepo.save.mockResolvedValue({});

      const result = await service.updateUserStatus(ADMIN_ID, TARGET_ID, 'unsuspend');
      expect(result.account_status).toBe('active');
    });

    test('GIVEN acción inválida WHEN updateUserStatus THEN lanza BadRequestException', async () => {
      await expect(
        service.updateUserStatus(ADMIN_ID, TARGET_ID, 'delete'),
      ).rejects.toThrow(BadRequestException);
    });

    test('GIVEN usuario no es admin WHEN updateUserStatus THEN lanza ForbiddenException', async () => {
      usersRepo.findOne
        .mockResolvedValueOnce({ ...MOCK_ADMIN, role: 'transportista' })
        .mockResolvedValueOnce(MOCK_TARGET);

      await expect(
        service.updateUserStatus(ADMIN_ID, TARGET_ID, 'suspend'),
      ).rejects.toThrow(ForbiddenException);
    });

    test('GIVEN target no existe WHEN updateUserStatus THEN lanza NotFoundException', async () => {
      usersRepo.findOne
        .mockResolvedValueOnce(MOCK_ADMIN)
        .mockResolvedValueOnce(null);

      await expect(
        service.updateUserStatus(ADMIN_ID, TARGET_ID, 'suspend'),
      ).rejects.toThrow(NotFoundException);
    });

    test('GIVEN target es admin WHEN updateUserStatus THEN lanza ForbiddenException', async () => {
      usersRepo.findOne
        .mockResolvedValueOnce(MOCK_ADMIN)
        .mockResolvedValueOnce({ ...MOCK_TARGET, role: 'admin' });

      await expect(
        service.updateUserStatus(ADMIN_ID, TARGET_ID, 'suspend'),
      ).rejects.toThrow(ForbiddenException);
    });

    test('GIVEN sin reason WHEN updateUserStatus THEN reason es null en audit', async () => {
      usersRepo.findOne
        .mockResolvedValueOnce(MOCK_ADMIN)
        .mockResolvedValueOnce(MOCK_TARGET);
      usersRepo.update.mockResolvedValue({});
      auditRepo.save.mockResolvedValue({});

      await service.updateUserStatus(ADMIN_ID, TARGET_ID, 'suspend');

      expect(auditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ reason: null }),
      );
    });
  });

  // ── getAuditLog ───────────────────────────────────────────────────────────

  describe('getAuditLog', () => {
    test('GIVEN logs existentes WHEN getAuditLog THEN devuelve paginado', async () => {
      // GIVEN
      const logs = [{ id: 'log-1', action: 'suspend' }];
      auditRepo.findAndCount.mockResolvedValue([logs, 1]);

      // WHEN
      const result = await service.getAuditLog(1, 50);

      // THEN
      expect(result).toEqual({ logs, total: 1, page: 1, limit: 50 });
      expect(auditRepo.findAndCount).toHaveBeenCalledWith({
        order: { created_at: 'DESC' },
        skip: 0,
        take: 50,
      });
    });

    test('GIVEN sin parámetros WHEN getAuditLog THEN usa defaults page=1 limit=50', async () => {
      auditRepo.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.getAuditLog();

      expect(result).toEqual({ logs: [], total: 0, page: 1, limit: 50 });
      expect(auditRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 50 }),
      );
    });

    test('GIVEN página 3 WHEN getAuditLog THEN skip es correcto', async () => {
      auditRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.getAuditLog(3, 10);

      expect(auditRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });
  });
});
