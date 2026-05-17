import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { LoadsService } from './loads.service';
import { Load } from '../entities/load.entity';
import { Shipper } from '../entities/shipper.entity';
import { Offer } from '../entities/offer.entity';
import { User } from '../entities/user.entity';
import { AlertsService } from '../alerts/alerts.service';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRepo() {
  return {
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    find: jest.fn(),
    findBy: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    remove: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('LoadsService', () => {
  let service: LoadsService;
  let loadsRepo: ReturnType<typeof makeRepo>;
  let shippersRepo: ReturnType<typeof makeRepo>;
  let offersRepo: ReturnType<typeof makeRepo>;
  let usersRepo: ReturnType<typeof makeRepo>;
  let alertsService: { checkAndNotify: jest.Mock };

  const USER_ID = 'user-uuid-1';
  const SHIPPER_ID = 'shipper-uuid-1';

  const MOCK_SHIPPER = { id: SHIPPER_ID, user_id: USER_ID };
  const MOCK_USER_VERIFIED = { id: USER_ID, dni_verified: true };
  const MOCK_USER_UNVERIFIED = { id: USER_ID, dni_verified: false };

  const VALID_BODY = {
    pickup_city: 'Buenos Aires',
    dropoff_city: 'Córdoba',
    cargo_type: 'General',
    weight_kg: 5000,
    price_base: 80_000,
  };

  beforeEach(async () => {
    loadsRepo = makeRepo();
    shippersRepo = makeRepo();
    offersRepo = makeRepo();
    usersRepo = makeRepo();
    alertsService = { checkAndNotify: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoadsService,
        { provide: getRepositoryToken(Load), useValue: loadsRepo },
        { provide: getRepositoryToken(Shipper), useValue: shippersRepo },
        { provide: getRepositoryToken(Offer), useValue: offersRepo },
        { provide: getRepositoryToken(User), useValue: usersRepo },
        { provide: AlertsService, useValue: alertsService },
      ],
    }).compile();

    service = module.get<LoadsService>(LoadsService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── a) Publicar una carga → se persiste con estado correcto ────────────────

  describe('createLoad', () => {
    test('GIVEN dador verificado WHEN publica carga válida THEN se guarda con status available', async () => {
      // GIVEN
      shippersRepo.findOne.mockResolvedValue(MOCK_SHIPPER);
      usersRepo.findOne.mockResolvedValue(MOCK_USER_VERIFIED);
      const savedLoad = { id: 'load-1', ...VALID_BODY, shipper_id: SHIPPER_ID, status: 'available' };
      loadsRepo.create.mockReturnValue(savedLoad);
      loadsRepo.save.mockResolvedValue(savedLoad);
      alertsService.checkAndNotify.mockReturnValue(undefined);

      // WHEN
      const result = await service.createLoad(USER_ID, VALID_BODY);

      // THEN
      expect(result.status).toBe('available');
      expect(result.shipper_id).toBe(SHIPPER_ID);
      expect(loadsRepo.save).toHaveBeenCalledTimes(1);
      expect(loadsRepo.save).toHaveBeenCalledWith(savedLoad);
    });

    test('GIVEN usuario sin perfil de shipper WHEN intenta publicar THEN lanza ForbiddenException', async () => {
      // GIVEN
      shippersRepo.findOne.mockResolvedValue(null);

      // WHEN / THEN
      await expect(service.createLoad(USER_ID, VALID_BODY)).rejects.toThrow(ForbiddenException);
      expect(loadsRepo.save).not.toHaveBeenCalled();
    });

    test('GIVEN dador con DNI no verificado WHEN intenta publicar THEN lanza ForbiddenException', async () => {
      // GIVEN
      shippersRepo.findOne.mockResolvedValue(MOCK_SHIPPER);
      usersRepo.findOne.mockResolvedValue(MOCK_USER_UNVERIFIED);

      // WHEN / THEN
      await expect(service.createLoad(USER_ID, VALID_BODY)).rejects.toThrow(ForbiddenException);
      expect(loadsRepo.save).not.toHaveBeenCalled();
    });

    test('GIVEN precio base igual a 0 WHEN publica carga THEN lanza BadRequestException', async () => {
      // GIVEN
      shippersRepo.findOne.mockResolvedValue(MOCK_SHIPPER);
      usersRepo.findOne.mockResolvedValue(MOCK_USER_VERIFIED);

      // WHEN / THEN
      await expect(service.createLoad(USER_ID, { ...VALID_BODY, price_base: 0 }))
        .rejects.toThrow(BadRequestException);
      expect(loadsRepo.save).not.toHaveBeenCalled();
    });

    test('GIVEN peso igual a 0 WHEN publica carga THEN lanza BadRequestException', async () => {
      // GIVEN
      shippersRepo.findOne.mockResolvedValue(MOCK_SHIPPER);
      usersRepo.findOne.mockResolvedValue(MOCK_USER_VERIFIED);

      // WHEN / THEN
      await expect(service.createLoad(USER_ID, { ...VALID_BODY, weight_kg: 0 }))
        .rejects.toThrow(BadRequestException);
      expect(loadsRepo.save).not.toHaveBeenCalled();
    });
  });

  // ── getMyLoads ─────────────────────────────────────────────────────────────

  describe('getMyLoads', () => {
    test('GIVEN usuario que no es shipper WHEN consulta sus cargas THEN lanza ForbiddenException', async () => {
      // GIVEN
      shippersRepo.findOne.mockResolvedValue(null);

      // WHEN / THEN
      await expect(service.getMyLoads(USER_ID)).rejects.toThrow(ForbiddenException);
    });

    test('GIVEN shipper sin cargas WHEN consulta sus cargas THEN devuelve lista vacía', async () => {
      // GIVEN
      shippersRepo.findOne.mockResolvedValue(MOCK_SHIPPER);
      loadsRepo.find.mockResolvedValue([]);
      offersRepo.find.mockResolvedValue([]);

      // WHEN
      const result = await service.getMyLoads(USER_ID);

      // THEN
      expect(result).toEqual([]);
    });

    test('GIVEN shipper con cargas y ofertas aceptadas WHEN getMyLoads THEN incluye accepted_offer con driverName', async () => {
      // GIVEN
      shippersRepo.findOne.mockResolvedValue(MOCK_SHIPPER);
      loadsRepo.find.mockResolvedValue([
        { id: 'load-1', shipper_id: SHIPPER_ID },
      ]);
      offersRepo.find.mockResolvedValue([
        { id: 'off-1', load_id: 'load-1', driver_id: 'driver-1', status: 'accepted', price: 50000 },
        { id: 'off-2', load_id: 'load-1', driver_id: 'driver-2', status: 'pending', price: 40000 },
      ]);
      usersRepo.find.mockResolvedValue([{ id: 'driver-1', name: 'Carlos' }]);

      // WHEN
      const result = await service.getMyLoads(USER_ID);

      // THEN
      expect(result[0].offer_count).toBe(2);
      expect(result[0].accepted_offer).toEqual({
        offerId: 'off-1',
        precio: 50000,
        driverName: 'Carlos',
      });
    });
  });

  // ── getAvailableLoads ───────────────────────────────────────────────────

  describe('getAvailableLoads', () => {
    function mockQb(results: any[]) {
      const qb = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(results),
      };
      loadsRepo.createQueryBuilder.mockReturnValue(qb);
      return qb;
    }

    test('GIVEN cargas disponibles WHEN getAvailableLoads sin filtros THEN devuelve todas', async () => {
      const loads = [{ id: 'l1', status: 'available' }];
      const qb = mockQb(loads);

      const result = await service.getAvailableLoads();

      expect(result).toEqual(loads);
      expect(qb.andWhere).not.toHaveBeenCalled();
    });

    test('GIVEN filtro cargo_type WHEN getAvailableLoads THEN aplica filtro', async () => {
      const qb = mockQb([]);

      await service.getAvailableLoads('Granos');

      expect(qb.andWhere).toHaveBeenCalledWith('l.cargo_type = :cargoType', { cargoType: 'Granos' });
    });

    test('GIVEN filtro origin WHEN getAvailableLoads THEN aplica ILIKE', async () => {
      const qb = mockQb([]);

      await service.getAvailableLoads(undefined, 'Buenos');

      expect(qb.andWhere).toHaveBeenCalledWith('l.pickup_city ILIKE :origin', { origin: '%Buenos%' });
    });
  });

  // ── markInTransitByOffer ──────────────────────────────────────────────────

  describe('markInTransitByOffer', () => {
    test('GIVEN oferta inexistente WHEN markInTransitByOffer THEN lanza NotFoundException', async () => {
      offersRepo.findOne.mockResolvedValue(null);

      await expect(service.markInTransitByOffer('bad')).rejects.toThrow();
    });

    test('GIVEN carga en matched WHEN markInTransitByOffer THEN cambia a in_transit', async () => {
      offersRepo.findOne.mockResolvedValue({ id: 'o1', load_id: 'l1' });
      const load = { id: 'l1', status: 'matched' };
      loadsRepo.findOne.mockResolvedValue(load);
      loadsRepo.save.mockImplementation((l) => Promise.resolve(l));

      const result = await service.markInTransitByOffer('o1');

      expect(result.status).toBe('in_transit');
    });

    test('GIVEN carga ya en in_transit WHEN markInTransitByOffer THEN es idempotente', async () => {
      offersRepo.findOne.mockResolvedValue({ id: 'o1', load_id: 'l1' });
      const load = { id: 'l1', status: 'in_transit' };
      loadsRepo.findOne.mockResolvedValue(load);

      const result = await service.markInTransitByOffer('o1');

      expect(result.status).toBe('in_transit');
      expect(loadsRepo.save).not.toHaveBeenCalled();
    });
  });

  // ── markInTransit ─────────────────────────────────────────────────────────

  describe('markInTransit', () => {
    test('GIVEN usuario no shipper WHEN markInTransit THEN lanza ForbiddenException', async () => {
      shippersRepo.findOne.mockResolvedValue(null);

      await expect(service.markInTransit(USER_ID, 'l1')).rejects.toThrow(ForbiddenException);
    });

    test('GIVEN carga de otro shipper WHEN markInTransit THEN lanza ForbiddenException', async () => {
      shippersRepo.findOne.mockResolvedValue(MOCK_SHIPPER);
      loadsRepo.findOne.mockResolvedValue({ id: 'l1', shipper_id: 'otro-shipper', status: 'matched' });

      await expect(service.markInTransit(USER_ID, 'l1')).rejects.toThrow(ForbiddenException);
    });

    test('GIVEN carga no en matched WHEN markInTransit THEN lanza BadRequestException', async () => {
      shippersRepo.findOne.mockResolvedValue(MOCK_SHIPPER);
      loadsRepo.findOne.mockResolvedValue({ id: 'l1', shipper_id: SHIPPER_ID, status: 'available' });

      await expect(service.markInTransit(USER_ID, 'l1')).rejects.toThrow(BadRequestException);
    });

    test('GIVEN carga matched propia WHEN markInTransit THEN cambia a in_transit', async () => {
      shippersRepo.findOne.mockResolvedValue(MOCK_SHIPPER);
      const load = { id: 'l1', shipper_id: SHIPPER_ID, status: 'matched' };
      loadsRepo.findOne.mockResolvedValue(load);
      loadsRepo.save.mockImplementation((l) => Promise.resolve(l));

      const result = await service.markInTransit(USER_ID, 'l1');
      expect(result.status).toBe('in_transit');
    });
  });

  // ── updateLoad ────────────────────────────────────────────────────────────

  describe('updateLoad', () => {
    test('GIVEN usuario no shipper WHEN updateLoad THEN lanza ForbiddenException', async () => {
      shippersRepo.findOne.mockResolvedValue(null);

      await expect(service.updateLoad(USER_ID, 'l1', {})).rejects.toThrow(ForbiddenException);
    });

    test('GIVEN carga inexistente WHEN updateLoad THEN lanza NotFoundException', async () => {
      shippersRepo.findOne.mockResolvedValue(MOCK_SHIPPER);
      loadsRepo.findOne.mockResolvedValue(null);

      await expect(service.updateLoad(USER_ID, 'l1', {})).rejects.toThrow();
    });

    test('GIVEN carga de otro shipper WHEN updateLoad THEN lanza ForbiddenException', async () => {
      shippersRepo.findOne.mockResolvedValue(MOCK_SHIPPER);
      loadsRepo.findOne.mockResolvedValue({ id: 'l1', shipper_id: 'otro', status: 'available' });

      await expect(service.updateLoad(USER_ID, 'l1', {})).rejects.toThrow(ForbiddenException);
    });

    test('GIVEN carga no available WHEN updateLoad THEN lanza BadRequestException', async () => {
      shippersRepo.findOne.mockResolvedValue(MOCK_SHIPPER);
      loadsRepo.findOne.mockResolvedValue({ id: 'l1', shipper_id: SHIPPER_ID, status: 'matched' });

      await expect(service.updateLoad(USER_ID, 'l1', {})).rejects.toThrow(BadRequestException);
    });

    test('GIVEN peso 0 WHEN updateLoad THEN lanza BadRequestException', async () => {
      shippersRepo.findOne.mockResolvedValue(MOCK_SHIPPER);
      loadsRepo.findOne.mockResolvedValue({ id: 'l1', shipper_id: SHIPPER_ID, status: 'available' });

      await expect(
        service.updateLoad(USER_ID, 'l1', { weight_kg: 0 }),
      ).rejects.toThrow(BadRequestException);
    });

    test('GIVEN precio 0 WHEN updateLoad THEN lanza BadRequestException', async () => {
      shippersRepo.findOne.mockResolvedValue(MOCK_SHIPPER);
      loadsRepo.findOne.mockResolvedValue({ id: 'l1', shipper_id: SHIPPER_ID, status: 'available' });

      await expect(
        service.updateLoad(USER_ID, 'l1', { price_base: 0 }),
      ).rejects.toThrow(BadRequestException);
    });

    test('GIVEN datos válidos WHEN updateLoad THEN actualiza campos', async () => {
      shippersRepo.findOne.mockResolvedValue(MOCK_SHIPPER);
      const load = { id: 'l1', shipper_id: SHIPPER_ID, status: 'available', cargo_type: 'General', description: 'old' };
      loadsRepo.findOne.mockResolvedValue(load);
      loadsRepo.save.mockImplementation((l) => Promise.resolve(l));

      const result = await service.updateLoad(USER_ID, 'l1', {
        cargo_type: 'Granos',
        description: 'updated',
      });

      expect(result.cargo_type).toBe('Granos');
      expect(result.description).toBe('updated');
    });
  });

  // ── deleteLoad ────────────────────────────────────────────────────────────

  describe('deleteLoad', () => {
    test('GIVEN carga available propia WHEN deleteLoad THEN elimina y devuelve { deleted: true }', async () => {
      shippersRepo.findOne.mockResolvedValue(MOCK_SHIPPER);
      const load = { id: 'l1', shipper_id: SHIPPER_ID, status: 'available' };
      loadsRepo.findOne.mockResolvedValue(load);
      loadsRepo.remove.mockResolvedValue(load);

      const result = await service.deleteLoad(USER_ID, 'l1');

      expect(result).toEqual({ deleted: true });
      expect(loadsRepo.remove).toHaveBeenCalledWith(load);
    });

    test('GIVEN carga no available WHEN deleteLoad THEN lanza BadRequestException', async () => {
      shippersRepo.findOne.mockResolvedValue(MOCK_SHIPPER);
      loadsRepo.findOne.mockResolvedValue({ id: 'l1', shipper_id: SHIPPER_ID, status: 'in_transit' });

      await expect(service.deleteLoad(USER_ID, 'l1')).rejects.toThrow(BadRequestException);
    });

    test('GIVEN carga de otro shipper WHEN deleteLoad THEN lanza ForbiddenException', async () => {
      shippersRepo.findOne.mockResolvedValue(MOCK_SHIPPER);
      loadsRepo.findOne.mockResolvedValue({ id: 'l1', shipper_id: 'otro', status: 'available' });

      await expect(service.deleteLoad(USER_ID, 'l1')).rejects.toThrow(ForbiddenException);
    });
  });

  // ── confirmDelivery ───────────────────────────────────────────────────────

  describe('confirmDelivery', () => {
    test('GIVEN carga in_transit propia WHEN confirmDelivery THEN cambia a delivered', async () => {
      shippersRepo.findOne.mockResolvedValue(MOCK_SHIPPER);
      const load = { id: 'l1', shipper_id: SHIPPER_ID, status: 'in_transit' };
      loadsRepo.findOne.mockResolvedValue(load);
      loadsRepo.save.mockImplementation((l) => Promise.resolve(l));

      const result = await service.confirmDelivery(USER_ID, 'l1');

      expect(result.status).toBe('delivered');
    });

    test('GIVEN carga no in_transit WHEN confirmDelivery THEN lanza BadRequestException', async () => {
      shippersRepo.findOne.mockResolvedValue(MOCK_SHIPPER);
      loadsRepo.findOne.mockResolvedValue({ id: 'l1', shipper_id: SHIPPER_ID, status: 'available' });

      await expect(service.confirmDelivery(USER_ID, 'l1')).rejects.toThrow(BadRequestException);
    });

    test('GIVEN carga de otro shipper WHEN confirmDelivery THEN lanza ForbiddenException', async () => {
      shippersRepo.findOne.mockResolvedValue(MOCK_SHIPPER);
      loadsRepo.findOne.mockResolvedValue({ id: 'l1', shipper_id: 'otro', status: 'in_transit' });

      await expect(service.confirmDelivery(USER_ID, 'l1')).rejects.toThrow(ForbiddenException);
    });

    test('GIVEN usuario no shipper WHEN confirmDelivery THEN lanza ForbiddenException', async () => {
      shippersRepo.findOne.mockResolvedValue(null);

      await expect(service.confirmDelivery(USER_ID, 'l1')).rejects.toThrow(ForbiddenException);
    });
  });
});
