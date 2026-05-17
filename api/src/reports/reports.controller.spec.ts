import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

describe('ReportsController', () => {
  let controller: ReportsController;
  let service: {
    createReport: jest.Mock;
    getPublicProfile: jest.Mock;
    getAdminReports: jest.Mock;
    updateReport: jest.Mock;
  };

  const REQ = { user: { id: 'user-1', role: 'transportista', email: 'test@test.com' } };

  beforeEach(async () => {
    service = {
      createReport: jest.fn(),
      getPublicProfile: jest.fn(),
      getAdminReports: jest.fn(),
      updateReport: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [{ provide: ReportsService, useValue: service }],
    }).compile();

    controller = module.get<ReportsController>(ReportsController);
  });

  afterEach(() => jest.clearAllMocks());

  describe('createReport', () => {
    test('GIVEN body válido WHEN createReport THEN delega al service', async () => {
      const body = { reported_id: 'u2', reason: 'fraud' as const, description: 'test' };
      service.createReport.mockResolvedValue({ id: 'r1' });

      const result = await controller.createReport(REQ, body);

      expect(service.createReport).toHaveBeenCalledWith('user-1', body);
      expect(result).toEqual({ id: 'r1' });
    });
  });

  describe('getPublicProfile', () => {
    test('GIVEN userId WHEN getPublicProfile THEN delega al service', async () => {
      service.getPublicProfile.mockResolvedValue({ id: 'u1', name: 'Juan' });

      const result = await controller.getPublicProfile('u1');

      expect(service.getPublicProfile).toHaveBeenCalledWith('u1');
      expect(result.name).toBe('Juan');
    });
  });

  describe('getAdminReports', () => {
    test('GIVEN secret válido WHEN getAdminReports THEN devuelve reportes', async () => {
      process.env.INTERNAL_SECRET = 'secret123';
      service.getAdminReports.mockResolvedValue([]);

      const result = await controller.getAdminReports('secret123');

      expect(service.getAdminReports).toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    test('GIVEN secret inválido WHEN getAdminReports THEN lanza ForbiddenException', () => {
      process.env.INTERNAL_SECRET = 'secret123';

      expect(() => controller.getAdminReports('wrong')).toThrow(ForbiddenException);
    });
  });

  describe('updateReport', () => {
    test('GIVEN secret válido WHEN updateReport THEN delega al service', async () => {
      process.env.INTERNAL_SECRET = 'secret123';
      service.updateReport.mockResolvedValue({ id: 'r1', status: 'resolved' });

      const result = await controller.updateReport('secret123', 'r1', { status: 'resolved' });

      expect(service.updateReport).toHaveBeenCalledWith('r1', { status: 'resolved' });
    });

    test('GIVEN secret inválido WHEN updateReport THEN lanza ForbiddenException', () => {
      process.env.INTERNAL_SECRET = 'secret123';

      expect(() => controller.updateReport('wrong', 'r1', {})).toThrow(ForbiddenException);
    });
  });
});
