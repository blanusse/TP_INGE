import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ReportsService } from './reports.service';
import { Report } from '../entities/report.entity';
import { User } from '../entities/user.entity';
import { MailService } from '../mail/mail.service';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRepo() {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    findAndCount: jest.fn(),
    save: jest.fn(),
    create: jest.fn((data) => ({ ...data })),
    update: jest.fn(),
    manager: {
      createQueryBuilder: jest.fn(),
    },
  };
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('ReportsService', () => {
  let service: ReportsService;
  let reportsRepo: ReturnType<typeof makeRepo>;
  let usersRepo: ReturnType<typeof makeRepo>;
  let mailService: { sendNuevoReporte: jest.Mock };

  const REPORTER_ID = 'reporter-1';
  const REPORTED_ID = 'reported-1';

  beforeEach(async () => {
    reportsRepo = makeRepo();
    usersRepo = makeRepo();
    mailService = { sendNuevoReporte: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: getRepositoryToken(Report), useValue: reportsRepo },
        { provide: getRepositoryToken(User), useValue: usersRepo },
        { provide: MailService, useValue: mailService },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── createReport ──────────────────────────────────────────────────────────

  describe('createReport', () => {
    const VALID_BODY = {
      reported_id: REPORTED_ID,
      reason: 'fraud' as const,
      description: 'Datos falsos',
    };

    test('GIVEN auto-reporte WHEN createReport THEN lanza BadRequestException', async () => {
      await expect(
        service.createReport(REPORTER_ID, { ...VALID_BODY, reported_id: REPORTER_ID }),
      ).rejects.toThrow(BadRequestException);
    });

    test('GIVEN usuario reportado no existe WHEN createReport THEN lanza NotFoundException', async () => {
      usersRepo.findOne.mockResolvedValue(null);

      await expect(
        service.createReport(REPORTER_ID, VALID_BODY),
      ).rejects.toThrow(NotFoundException);
    });

    test('GIVEN reporte activo existente WHEN createReport THEN lanza ConflictException', async () => {
      usersRepo.findOne.mockResolvedValueOnce({ id: REPORTED_ID, name: 'Target' }); // reported
      reportsRepo.findOne.mockResolvedValue({ id: 'existing' }); // existing report

      await expect(
        service.createReport(REPORTER_ID, VALID_BODY),
      ).rejects.toThrow(ConflictException);
    });

    test('GIVEN datos válidos WHEN createReport THEN crea reporte y envía email', async () => {
      usersRepo.findOne
        .mockResolvedValueOnce({ id: REPORTED_ID, name: 'Target' })  // reported
        .mockResolvedValueOnce({ id: REPORTER_ID, name: 'Reporter' }); // reporter
      reportsRepo.findOne.mockResolvedValue(null); // no existing
      reportsRepo.save.mockImplementation((r) => Promise.resolve({ id: 'rep-1', ...r }));

      const result = await service.createReport(REPORTER_ID, VALID_BODY);

      expect(reportsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          reporter_id: REPORTER_ID,
          reported_id: REPORTED_ID,
          reason: 'fraud',
          status: 'pending',
        }),
      );
      expect(reportsRepo.save).toHaveBeenCalledTimes(1);
      expect(mailService.sendNuevoReporte).toHaveBeenCalledWith(
        expect.objectContaining({
          reporterName: 'Reporter',
          reportedName: 'Target',
        }),
      );
    });

    test('GIVEN reporter no existe WHEN createReport THEN usa "Usuario" como nombre y no lanza error', async () => {
      usersRepo.findOne
        .mockResolvedValueOnce({ id: REPORTED_ID, name: 'Target' })  // reported
        .mockResolvedValueOnce(null);                                  // reporter not found
      reportsRepo.findOne.mockResolvedValue(null);
      reportsRepo.save.mockImplementation((r) => Promise.resolve({ id: 'rep-2', ...r }));

      await expect(service.createReport(REPORTER_ID, VALID_BODY)).resolves.toBeDefined();
      expect(mailService.sendNuevoReporte).toHaveBeenCalledWith(
        expect.objectContaining({ reporterName: 'Usuario' }),
      );
    });

    test('GIVEN fallo en envío de email WHEN createReport THEN no lanza error', async () => {
      usersRepo.findOne
        .mockResolvedValueOnce({ id: REPORTED_ID, name: 'Target' })
        .mockResolvedValueOnce({ id: REPORTER_ID, name: 'Reporter' });
      reportsRepo.findOne.mockResolvedValue(null);
      reportsRepo.save.mockImplementation((r) => Promise.resolve({ id: 'rep-1', ...r }));
      mailService.sendNuevoReporte.mockRejectedValue(new Error('SMTP fail'));

      await expect(service.createReport(REPORTER_ID, VALID_BODY)).resolves.toBeDefined();
    });
  });

  // ── getPublicProfile ──────────────────────────────────────────────────────

  describe('getPublicProfile', () => {
    test('GIVEN usuario inexistente WHEN getPublicProfile THEN lanza NotFoundException', async () => {
      usersRepo.findOne.mockResolvedValue(null);

      await expect(service.getPublicProfile('no-existe')).rejects.toThrow(NotFoundException);
    });

    test('GIVEN usuario existente WHEN getPublicProfile THEN devuelve perfil con stats', async () => {
      usersRepo.findOne.mockResolvedValue({
        id: 'u1', name: 'Juan', role: 'transportista', created_at: new Date('2025-01-01'),
      });

      const qbRating = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ avg: '4.5', count: '10' }),
      };
      const qbTrips = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ count: '7' }),
      };
      reportsRepo.manager.createQueryBuilder
        .mockReturnValueOnce(qbRating)
        .mockReturnValueOnce(qbTrips);

      const result = await service.getPublicProfile('u1');

      expect(result.name).toBe('Juan');
      expect(result.avg_rating).toBe(4.5);
      expect(result.rating_count).toBe(10);
      expect(result.trips_completed).toBe(7);
    });
  });

    test('GIVEN ratingResult y tripCount nulos WHEN getPublicProfile THEN devuelve 0 para avg y trips', async () => {
      usersRepo.findOne.mockResolvedValue({
        id: 'u2', name: 'Ana', role: 'shipper', created_at: new Date(),
      });

      const qbNull = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue(null),
      };
      reportsRepo.manager.createQueryBuilder
        .mockReturnValueOnce(qbNull)
        .mockReturnValueOnce(qbNull);

      const result = await service.getPublicProfile('u2');

      expect(result.avg_rating).toBe(0);
      expect(result.rating_count).toBe(0);
      expect(result.trips_completed).toBe(0);
    });

  // ── getAdminReports ───────────────────────────────────────────────────────

  describe('getAdminReports', () => {
    test('GIVEN reportes existentes WHEN getAdminReports THEN devuelve lista', async () => {
      const reports = [{ id: 'r1', reason: 'fraud' }];
      reportsRepo.find.mockResolvedValue(reports);

      const result = await service.getAdminReports();

      expect(result).toEqual(reports);
      expect(reportsRepo.find).toHaveBeenCalledWith({
        relations: ['reporter', 'reported'],
        order: { created_at: 'DESC' },
      });
    });
  });

  // ── updateReport ──────────────────────────────────────────────────────────

  describe('updateReport', () => {
    test('GIVEN reporte inexistente WHEN updateReport THEN lanza NotFoundException', async () => {
      reportsRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateReport('bad-id', { status: 'resolved' }),
      ).rejects.toThrow(NotFoundException);
    });

    test('GIVEN status resolved WHEN updateReport THEN setea resolved_at', async () => {
      const report = { id: 'r1', status: 'pending', reported_id: 'u1' };
      reportsRepo.findOne.mockResolvedValue(report);
      reportsRepo.save.mockImplementation((r) => Promise.resolve(r));

      const result = await service.updateReport('r1', { status: 'resolved' });

      expect(result.status).toBe('resolved');
      expect(result.resolved_at).toBeInstanceOf(Date);
    });

    test('GIVEN admin_action suspended WHEN updateReport THEN actualiza account_status del usuario', async () => {
      const report = { id: 'r1', status: 'pending', reported_id: 'u1' };
      reportsRepo.findOne.mockResolvedValue(report);
      reportsRepo.save.mockImplementation((r) => Promise.resolve(r));
      usersRepo.update.mockResolvedValue({});

      await service.updateReport('r1', { admin_action: 'suspended' });

      expect(usersRepo.update).toHaveBeenCalledWith('u1', { account_status: 'suspended' });
    });

    test('GIVEN admin_action banned WHEN updateReport THEN actualiza account_status a banned', async () => {
      const report = { id: 'r1', status: 'pending', reported_id: 'u1' };
      reportsRepo.findOne.mockResolvedValue(report);
      reportsRepo.save.mockImplementation((r) => Promise.resolve(r));
      usersRepo.update.mockResolvedValue({});

      await service.updateReport('r1', { admin_action: 'banned' });

      expect(usersRepo.update).toHaveBeenCalledWith('u1', { account_status: 'banned' });
    });

    test('GIVEN admin_action warned WHEN updateReport THEN NO actualiza account_status', async () => {
      const report = { id: 'r1', status: 'pending', reported_id: 'u1' };
      reportsRepo.findOne.mockResolvedValue(report);
      reportsRepo.save.mockImplementation((r) => Promise.resolve(r));

      await service.updateReport('r1', { admin_action: 'warned' });

      expect(usersRepo.update).not.toHaveBeenCalled();
    });

    test('GIVEN admin_notes WHEN updateReport THEN guarda las notas', async () => {
      const report = { id: 'r1', status: 'pending', reported_id: 'u1' };
      reportsRepo.findOne.mockResolvedValue(report);
      reportsRepo.save.mockImplementation((r) => Promise.resolve(r));

      const result = await service.updateReport('r1', { admin_notes: 'Revisado' });

      expect(result.admin_notes).toBe('Revisado');
    });
  });
});
