import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('AdminController', () => {
  let controller: AdminController;
  let service: {
    listUsers: jest.Mock;
    updateUserStatus: jest.Mock;
    getAuditLog: jest.Mock;
  };

  const REQ = { user: { id: 'admin-1', role: 'admin' } };

  beforeEach(async () => {
    service = {
      listUsers: jest.fn(),
      updateUserStatus: jest.fn(),
      getAuditLog: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [{ provide: AdminService, useValue: service }],
    }).compile();

    controller = module.get<AdminController>(AdminController);
  });

  afterEach(() => jest.clearAllMocks());

  describe('listUsers', () => {
    test('GIVEN params de paginación WHEN listUsers THEN delega al service con parseInt', async () => {
      // GIVEN
      service.listUsers.mockResolvedValue({ users: [], total: 0, page: 2, limit: 10 });

      // WHEN
      await controller.listUsers(REQ, '2', '10', 'juan');

      // THEN
      expect(service.listUsers).toHaveBeenCalledWith(2, 10, 'juan');
    });

    test('GIVEN sin params WHEN listUsers THEN usa defaults (page=1, limit=50)', async () => {
      service.listUsers.mockResolvedValue({ users: [], total: 0, page: 1, limit: 50 });

      await controller.listUsers(REQ);

      expect(service.listUsers).toHaveBeenCalledWith(1, 50, undefined);
    });
  });

  describe('updateUserStatus', () => {
    test('GIVEN acción suspend WHEN updateUserStatus THEN delega al service', async () => {
      service.updateUserStatus.mockResolvedValue({ id: 'target-1', account_status: 'suspended' });

      const result = await controller.updateUserStatus(REQ, 'target-1', 'suspend', 'motivo');

      expect(service.updateUserStatus).toHaveBeenCalledWith('admin-1', 'target-1', 'suspend', 'motivo');
      expect(result.account_status).toBe('suspended');
    });
  });

  describe('getAuditLog', () => {
    test('GIVEN params WHEN getAuditLog THEN delega con parseInt', async () => {
      service.getAuditLog.mockResolvedValue({ logs: [], total: 0, page: 1, limit: 50 });

      await controller.getAuditLog('1', '50');

      expect(service.getAuditLog).toHaveBeenCalledWith(1, 50);
    });

    test('GIVEN sin params WHEN getAuditLog THEN usa defaults', async () => {
      service.getAuditLog.mockResolvedValue({ logs: [], total: 0, page: 1, limit: 50 });

      await controller.getAuditLog();

      expect(service.getAuditLog).toHaveBeenCalledWith(1, 50);
    });
  });
});
