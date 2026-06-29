import { Test, TestingModule } from '@nestjs/testing';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('AlertsController', () => {
  let controller: AlertsController;
  let service: {
    getUserAlerts: jest.Mock;
    createAlert: jest.Mock;
    deleteAlert: jest.Mock;
    getNotifications: jest.Mock;
    getUnreadCount: jest.Mock;
    markAllRead: jest.Mock;
  };

  const REQ = { user: { id: 'user-1' } };

  beforeEach(async () => {
    service = {
      getUserAlerts: jest.fn(),
      createAlert: jest.fn(),
      deleteAlert: jest.fn(),
      getNotifications: jest.fn(),
      getUnreadCount: jest.fn(),
      markAllRead: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AlertsController],
      providers: [{ provide: AlertsService, useValue: service }],
    }).compile();

    controller = module.get<AlertsController>(AlertsController);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getUserAlerts', () => {
    test('GIVEN usuario autenticado WHEN getUserAlerts THEN delega con userId', async () => {
      service.getUserAlerts.mockResolvedValue([]);
      const result = await controller.getUserAlerts(REQ);
      expect(service.getUserAlerts).toHaveBeenCalledWith('user-1');
      expect(result).toEqual([]);
    });
  });

  describe('createAlert', () => {
    test('GIVEN body con filtros WHEN createAlert THEN delega con userId y body', async () => {
      const body = { cargo_types: ['Granos'], origin_city: 'Buenos Aires' };
      service.createAlert.mockResolvedValue({ id: 'a1' });

      const result = await controller.createAlert(REQ, body);

      expect(service.createAlert).toHaveBeenCalledWith('user-1', body);
      expect(result).toEqual({ id: 'a1' });
    });
  });

  describe('deleteAlert', () => {
    test('GIVEN alertId WHEN deleteAlert THEN delega con userId y alertId', async () => {
      service.deleteAlert.mockResolvedValue({ ok: true });

      const result = await controller.deleteAlert(REQ, 'alert-1');

      expect(service.deleteAlert).toHaveBeenCalledWith('user-1', 'alert-1');
      expect(result).toEqual({ ok: true });
    });
  });

  describe('getNotifications', () => {
    test('GIVEN usuario autenticado WHEN getNotifications THEN delega con userId', async () => {
      service.getNotifications.mockResolvedValue([]);
      const result = await controller.getNotifications(REQ);
      expect(service.getNotifications).toHaveBeenCalledWith('user-1');
      expect(result).toEqual([]);
    });
  });

  describe('getUnreadCount', () => {
    test('GIVEN usuario autenticado WHEN getUnreadCount THEN devuelve conteo', async () => {
      service.getUnreadCount.mockResolvedValue({ count: 5 });
      const result = await controller.getUnreadCount(REQ);
      expect(service.getUnreadCount).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ count: 5 });
    });
  });

  describe('markAllRead', () => {
    test('GIVEN usuario autenticado WHEN markAllRead THEN delega con userId', async () => {
      service.markAllRead.mockResolvedValue({ ok: true });
      const result = await controller.markAllRead(REQ);
      expect(service.markAllRead).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ ok: true });
    });
  });
});
