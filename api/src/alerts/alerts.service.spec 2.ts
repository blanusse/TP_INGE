import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { LoadAlert } from '../entities/load-alert.entity';
import { Notification } from '../entities/notification.entity';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRepo() {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('AlertsService', () => {
  let service: AlertsService;
  let alertsRepo: ReturnType<typeof makeRepo>;
  let notifRepo: ReturnType<typeof makeRepo>;

  const USER_ID = 'user-uuid-1';

  beforeEach(async () => {
    alertsRepo = makeRepo();
    notifRepo = makeRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertsService,
        { provide: getRepositoryToken(LoadAlert), useValue: alertsRepo },
        { provide: getRepositoryToken(Notification), useValue: notifRepo },
      ],
    }).compile();

    service = module.get<AlertsService>(AlertsService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── getUserAlerts ─────────────────────────────────────────────────────────

  describe('getUserAlerts', () => {
    test('GIVEN usuario con alertas WHEN consulta sus alertas THEN devuelve la lista ordenada por fecha', async () => {
      // GIVEN
      const alerts = [{ id: 'a1', user_id: USER_ID }];
      alertsRepo.find.mockResolvedValue(alerts);

      // WHEN
      const result = await service.getUserAlerts(USER_ID);

      // THEN
      expect(result).toEqual(alerts);
      expect(alertsRepo.find).toHaveBeenCalledWith({
        where: { user_id: USER_ID },
        order: { created_at: 'DESC' },
      });
    });
  });

  // ── createAlert ───────────────────────────────────────────────────────────

  describe('createAlert', () => {
    test('GIVEN body con cargo_types y ciudades WHEN crea alerta THEN genera nombre descriptivo', async () => {
      // GIVEN
      const body = {
        cargo_types: ['Granos', 'Hacienda'],
        origin_city: 'Buenos Aires',
        dest_city: 'Córdoba',
      };
      const created = { id: 'a1', user_id: USER_ID, name: 'Granos/Hacienda · desde Buenos Aires · hacia Córdoba' };
      alertsRepo.create.mockReturnValue(created);
      alertsRepo.save.mockResolvedValue(created);

      // WHEN
      const result = await service.createAlert(USER_ID, body);

      // THEN
      expect(result).toEqual(created);
      expect(alertsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: USER_ID,
          name: 'Granos/Hacienda · desde Buenos Aires · hacia Córdoba',
          cargo_types: 'Granos,Hacienda',
          origin_city: 'Buenos Aires',
          dest_city: 'Córdoba',
        }),
      );
    });

    test('GIVEN body vacío WHEN crea alerta THEN nombre es "Alerta general"', async () => {
      // GIVEN
      const body = {};
      const created = { id: 'a2', user_id: USER_ID, name: 'Alerta general' };
      alertsRepo.create.mockReturnValue(created);
      alertsRepo.save.mockResolvedValue(created);

      // WHEN
      await service.createAlert(USER_ID, body);

      // THEN
      expect(alertsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Alerta general' }),
      );
    });

    test('GIVEN body con price_min y price_max WHEN crea alerta THEN se guardan los rangos', async () => {
      // GIVEN
      const body = { price_min: 50000, price_max: 100000 };
      const created = { id: 'a3', user_id: USER_ID, name: 'Alerta general' };
      alertsRepo.create.mockReturnValue(created);
      alertsRepo.save.mockResolvedValue(created);

      // WHEN
      await service.createAlert(USER_ID, body);

      // THEN
      expect(alertsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          price_min: 50000,
          price_max: 100000,
        }),
      );
    });
  });

  // ── deleteAlert ───────────────────────────────────────────────────────────

  describe('deleteAlert', () => {
    test('GIVEN alerta propia WHEN elimina THEN devuelve ok', async () => {
      // GIVEN
      alertsRepo.findOne.mockResolvedValue({ id: 'a1', user_id: USER_ID });

      // WHEN
      const result = await service.deleteAlert(USER_ID, 'a1');

      // THEN
      expect(result).toEqual({ ok: true });
      expect(alertsRepo.delete).toHaveBeenCalledWith({ id: 'a1' });
    });

    test('GIVEN alerta inexistente WHEN elimina THEN lanza NotFoundException', async () => {
      // GIVEN
      alertsRepo.findOne.mockResolvedValue(null);

      // WHEN / THEN
      await expect(service.deleteAlert(USER_ID, 'xxx')).rejects.toThrow(NotFoundException);
    });

    test('GIVEN alerta de otro usuario WHEN elimina THEN lanza ForbiddenException', async () => {
      // GIVEN
      alertsRepo.findOne.mockResolvedValue({ id: 'a1', user_id: 'otro-user' });

      // WHEN / THEN
      await expect(service.deleteAlert(USER_ID, 'a1')).rejects.toThrow(ForbiddenException);
      expect(alertsRepo.delete).not.toHaveBeenCalled();
    });
  });

  // ── getNotifications ──────────────────────────────────────────────────────

  describe('getNotifications', () => {
    test('GIVEN usuario con notificaciones WHEN consulta THEN devuelve hasta 50 ordenadas', async () => {
      // GIVEN
      const notifs = [{ id: 'n1', user_id: USER_ID, title: 'Nueva carga' }];
      notifRepo.find.mockResolvedValue(notifs);

      // WHEN
      const result = await service.getNotifications(USER_ID);

      // THEN
      expect(result).toEqual(notifs);
      expect(notifRepo.find).toHaveBeenCalledWith({
        where: { user_id: USER_ID },
        order: { created_at: 'DESC' },
        take: 50,
      });
    });
  });

  // ── getUnreadCount ────────────────────────────────────────────────────────

  describe('getUnreadCount', () => {
    test('GIVEN 3 notificaciones no leídas WHEN consulta conteo THEN devuelve { count: 3 }', async () => {
      // GIVEN
      notifRepo.count.mockResolvedValue(3);

      // WHEN
      const result = await service.getUnreadCount(USER_ID);

      // THEN
      expect(result).toEqual({ count: 3 });
      expect(notifRepo.count).toHaveBeenCalledWith({
        where: { user_id: USER_ID, is_read: false },
      });
    });
  });

  // ── markAllRead ───────────────────────────────────────────────────────────

  describe('markAllRead', () => {
    test('GIVEN notificaciones no leídas WHEN marca todas THEN actualiza is_read a true', async () => {
      // GIVEN
      notifRepo.update.mockResolvedValue({ affected: 5 });

      // WHEN
      const result = await service.markAllRead(USER_ID);

      // THEN
      expect(result).toEqual({ ok: true });
      expect(notifRepo.update).toHaveBeenCalledWith(
        { user_id: USER_ID, is_read: false },
        { is_read: true },
      );
    });
  });

  // ── checkAndNotify ────────────────────────────────────────────────────────

  describe('checkAndNotify', () => {
    function mockQb(matches: any[]) {
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(matches),
      };
      alertsRepo.createQueryBuilder.mockReturnValue(qb);
      return qb;
    }

    test('GIVEN alertas que matchean WHEN se publica carga THEN crea notificaciones', async () => {
      // GIVEN
      const load = {
        id: 'load-1',
        cargo_type: 'Granos',
        pickup_city: 'Buenos Aires',
        dropoff_city: 'Córdoba',
        price_base: 80000,
      };
      const matchingAlerts = [
        { user_id: 'user-a', id: 'alert-1' },
        { user_id: 'user-b', id: 'alert-2' },
      ];
      mockQb(matchingAlerts);
      notifRepo.create.mockImplementation((data) => data);
      notifRepo.save.mockResolvedValue([]);

      // WHEN
      await service.checkAndNotify(load as any);

      // THEN
      expect(notifRepo.create).toHaveBeenCalledTimes(2);
      expect(notifRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-a',
          title: 'Nueva carga disponible',
          load_id: 'load-1',
        }),
      );
      expect(notifRepo.save).toHaveBeenCalledTimes(1);
    });

    test('GIVEN carga con truck_type_required WHEN checkAndNotify THEN agrega andWhere de truck_types', async () => {
      // GIVEN
      const load = { id: 'load-4', cargo_type: 'Granos', truck_type_required: 'Semirremolque', pickup_city: 'BA', dropoff_city: 'CBA', price_base: 80000 };
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      alertsRepo.createQueryBuilder.mockReturnValue(qb);

      // WHEN
      await service.checkAndNotify(load as any);

      // THEN
      const calls = qb.andWhere.mock.calls.map((c: any[]) => c[0]);
      expect(calls.some((s: string) => s.includes('truck_types'))).toBe(true);
    });

    test('GIVEN ninguna alerta matchea WHEN se publica carga THEN no crea notificaciones', async () => {
      // GIVEN
      const load = { id: 'load-2', cargo_type: 'Químicos' };
      mockQb([]);

      // WHEN
      await service.checkAndNotify(load as any);

      // THEN
      expect(notifRepo.create).not.toHaveBeenCalled();
      expect(notifRepo.save).not.toHaveBeenCalled();
    });

    test('GIVEN error en query WHEN checkAndNotify THEN no lanza excepción (silencioso)', async () => {
      // GIVEN
      const load = { id: 'load-3', cargo_type: 'General' };
      alertsRepo.createQueryBuilder.mockImplementation(() => {
        throw new Error('DB error');
      });

      // WHEN / THEN — no debe lanzar
      await expect(service.checkAndNotify(load as any)).resolves.toBeUndefined();
    });
  });
});
