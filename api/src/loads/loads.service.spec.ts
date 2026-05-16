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
  });
});
