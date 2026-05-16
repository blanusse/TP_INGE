import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { OffersService } from './offers.service';
import { Offer } from '../entities/offer.entity';
import { Load } from '../entities/load.entity';
import { Truck } from '../entities/truck.entity';
import { Rating } from '../entities/rating.entity';
import { User } from '../entities/user.entity';
import { Shipper } from '../entities/shipper.entity';
import { TruckerDocument } from '../entities/trucker-document.entity';
import { MailService } from '../mail/mail.service';

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

/** Construye un mock para el query builder chaineable de TypeORM */
function makeQueryBuilder() {
  const qb = {
    update: jest.fn(),
    set: jest.fn(),
    where: jest.fn(),
    execute: jest.fn().mockResolvedValue({ affected: 0 }),
    select: jest.fn(),
    addSelect: jest.fn(),
    groupBy: jest.fn(),
    getRawMany: jest.fn().mockResolvedValue([]),
  };
  qb.update.mockReturnValue(qb);
  qb.set.mockReturnValue(qb);
  qb.where.mockReturnValue(qb);
  qb.select.mockReturnValue(qb);
  qb.addSelect.mockReturnValue(qb);
  qb.groupBy.mockReturnValue(qb);
  return qb;
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('OffersService', () => {
  let service: OffersService;
  let offersRepo: ReturnType<typeof makeRepo>;
  let loadsRepo: ReturnType<typeof makeRepo>;
  let trucksRepo: ReturnType<typeof makeRepo>;
  let ratingsRepo: ReturnType<typeof makeRepo>;
  let usersRepo: ReturnType<typeof makeRepo>;
  let shippersRepo: ReturnType<typeof makeRepo>;
  let documentsRepo: ReturnType<typeof makeRepo>;
  let mailService: { [k: string]: jest.Mock };

  const DRIVER_ID = 'driver-uuid-1';
  const LOAD_ID = 'load-uuid-1';
  const TRUCK_ID = 'truck-uuid-1';
  const SHIPPER_ID = 'shipper-uuid-1';
  const SHIPPER_USER_ID = 'shipper-user-uuid-1';

  const MOCK_DRIVER = { id: DRIVER_ID, is_fleet_owner: false, fleet_id: null, dni_verified: true };
  const MOCK_TRUCK_VERIFIED = { id: TRUCK_ID, owner_id: DRIVER_ID, vtv_verified: true, seguro_verified: true };
  const MOCK_TRUCK_UNVERIFIED = { id: TRUCK_ID, owner_id: DRIVER_ID, vtv_verified: false, seguro_verified: false };
  const MOCK_LOAD_AVAILABLE = { id: LOAD_ID, status: 'available', shipper_id: SHIPPER_ID, pickup_city: 'BsAs', dropoff_city: 'CBA' };
  const MOCK_LOAD_MATCHED = { id: LOAD_ID, status: 'matched', shipper_id: SHIPPER_ID };
  const MOCK_SHIPPER_RECORD = { id: SHIPPER_ID, user_id: SHIPPER_USER_ID };
  const MOCK_DADOR_USER = { id: SHIPPER_USER_ID, email: 'dador@test.com', name: 'Dador Test' };

  beforeEach(async () => {
    offersRepo = makeRepo();
    loadsRepo = makeRepo();
    trucksRepo = makeRepo();
    ratingsRepo = makeRepo();
    usersRepo = makeRepo();
    shippersRepo = makeRepo();
    documentsRepo = makeRepo();
    mailService = {
      sendNuevaOferta: jest.fn(),
      sendOfertaAceptada: jest.fn(),
      sendOfertaRechazada: jest.fn(),
      sendContraofertaRecibida: jest.fn(),
      sendContraofertaAceptada: jest.fn(),
      sendContraofertaRechazada: jest.fn(),
      sendOfertaRetirada: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OffersService,
        { provide: getRepositoryToken(Offer), useValue: offersRepo },
        { provide: getRepositoryToken(Load), useValue: loadsRepo },
        { provide: getRepositoryToken(Truck), useValue: trucksRepo },
        { provide: getRepositoryToken(Rating), useValue: ratingsRepo },
        { provide: getRepositoryToken(User), useValue: usersRepo },
        { provide: getRepositoryToken(Shipper), useValue: shippersRepo },
        { provide: getRepositoryToken(TruckerDocument), useValue: documentsRepo },
        { provide: MailService, useValue: mailService },
      ],
    }).compile();

    service = module.get<OffersService>(OffersService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── d) Camionero sin ofertas previas puede ofertar ─────────────────────────

  describe('submitOffer — happy path', () => {
    test('GIVEN camionero verificado con camión habilitado WHEN oferta en carga disponible THEN se guarda con status pending', async () => {
      const OFFER_BODY = { load_id: LOAD_ID, price: 50_000, truck_id: TRUCK_ID };
      const MOCK_OFFER = { id: 'offer-1', ...OFFER_BODY, driver_id: DRIVER_ID, status: 'pending' };

      // GIVEN
      // 1. get driver user
      usersRepo.findOne.mockResolvedValueOnce(MOCK_DRIVER);
      // 2. verifiedSelf count & verifiedFleet count (Promise.all)
      usersRepo.count.mockResolvedValueOnce(1); // self verified
      usersRepo.count.mockResolvedValueOnce(0); // fleet verified
      // 3. get truck (truck_id specified)
      trucksRepo.findOne.mockResolvedValueOnce(MOCK_TRUCK_VERIFIED);
      // 4. truck count (always checked)
      trucksRepo.count.mockResolvedValueOnce(1);
      // 5. get load
      loadsRepo.findOne.mockResolvedValueOnce(MOCK_LOAD_AVAILABLE);
      // 6. check existing offer
      offersRepo.findOne.mockResolvedValueOnce(null);
      // 7. create & save
      offersRepo.create.mockReturnValue(MOCK_OFFER);
      offersRepo.save.mockResolvedValueOnce(MOCK_OFFER);
      // 8. post-save: get shipper & driverUser (Promise.all)
      shippersRepo.findOne.mockResolvedValueOnce(MOCK_SHIPPER_RECORD);
      usersRepo.findOne.mockResolvedValueOnce(MOCK_DRIVER); // driverUser in Promise.all
      // 9. get dador user
      usersRepo.findOne.mockResolvedValueOnce(MOCK_DADOR_USER);

      // WHEN
      const result = await service.submitOffer(DRIVER_ID, OFFER_BODY);

      // THEN
      expect(result.status).toBe('pending');
      expect(result.driver_id).toBe(DRIVER_ID);
      expect(offersRepo.save).toHaveBeenCalledTimes(1);
      expect(offersRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ load_id: LOAD_ID, price: 50_000 }),
      );
    });
  });

  // ── c) Carga ya asignada → excepción ──────────────────────────────────────

  describe('submitOffer — carga no disponible', () => {
    test('GIVEN carga con status matched WHEN camionero intenta ofertar THEN lanza BadRequestException', async () => {
      const OFFER_BODY = { load_id: LOAD_ID, price: 50_000, truck_id: TRUCK_ID };

      // GIVEN
      usersRepo.findOne.mockResolvedValueOnce(MOCK_DRIVER);
      usersRepo.count.mockResolvedValueOnce(1);
      usersRepo.count.mockResolvedValueOnce(0);
      trucksRepo.findOne.mockResolvedValueOnce(MOCK_TRUCK_VERIFIED);
      trucksRepo.count.mockResolvedValueOnce(1);
      loadsRepo.findOne.mockResolvedValueOnce(MOCK_LOAD_MATCHED); // ← status matched

      // WHEN / THEN
      await expect(service.submitOffer(DRIVER_ID, OFFER_BODY))
        .rejects.toThrow(BadRequestException);
      expect(offersRepo.save).not.toHaveBeenCalled();
    });

    test('GIVEN camionero con oferta existente en esa carga WHEN intenta ofertar de nuevo THEN lanza ConflictException', async () => {
      const OFFER_BODY = { load_id: LOAD_ID, price: 50_000, truck_id: TRUCK_ID };
      const EXISTING_OFFER = { id: 'offer-existing', load_id: LOAD_ID, driver_id: DRIVER_ID };

      // GIVEN
      usersRepo.findOne.mockResolvedValueOnce(MOCK_DRIVER);
      usersRepo.count.mockResolvedValueOnce(1);
      usersRepo.count.mockResolvedValueOnce(0);
      trucksRepo.findOne.mockResolvedValueOnce(MOCK_TRUCK_VERIFIED);
      trucksRepo.count.mockResolvedValueOnce(1);
      loadsRepo.findOne.mockResolvedValueOnce(MOCK_LOAD_AVAILABLE);
      offersRepo.findOne.mockResolvedValueOnce(EXISTING_OFFER); // ← ya existe

      // WHEN / THEN
      await expect(service.submitOffer(DRIVER_ID, OFFER_BODY))
        .rejects.toThrow(ConflictException);
      expect(offersRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('submitOffer — validaciones', () => {
    test('GIVEN precio igual a 0 WHEN envía oferta THEN lanza BadRequestException sin consultar DB', async () => {
      // GIVEN
      const OFFER_BODY = { load_id: LOAD_ID, price: 0 };

      // WHEN / THEN
      await expect(service.submitOffer(DRIVER_ID, OFFER_BODY))
        .rejects.toThrow(BadRequestException);
      expect(usersRepo.findOne).not.toHaveBeenCalled();
    });

    test('GIVEN camionero sin DNI verificado WHEN oferta THEN lanza BadRequestException', async () => {
      const OFFER_BODY = { load_id: LOAD_ID, price: 50_000, truck_id: TRUCK_ID };

      // GIVEN: ningún conductor verificado (self=0, fleet=0)
      usersRepo.findOne.mockResolvedValueOnce({ ...MOCK_DRIVER, dni_verified: false });
      usersRepo.count.mockResolvedValueOnce(0); // self not verified
      usersRepo.count.mockResolvedValueOnce(0); // fleet not verified

      // WHEN / THEN
      await expect(service.submitOffer(DRIVER_ID, OFFER_BODY))
        .rejects.toThrow(BadRequestException);
      expect(offersRepo.save).not.toHaveBeenCalled();
    });

    test('GIVEN camión sin VTV ni seguro WHEN oferta THEN lanza BadRequestException', async () => {
      const OFFER_BODY = { load_id: LOAD_ID, price: 50_000, truck_id: TRUCK_ID };

      // GIVEN
      usersRepo.findOne.mockResolvedValueOnce(MOCK_DRIVER);
      usersRepo.count.mockResolvedValueOnce(1);
      usersRepo.count.mockResolvedValueOnce(0);
      trucksRepo.findOne.mockResolvedValueOnce(MOCK_TRUCK_UNVERIFIED); // ← sin verificar

      // WHEN / THEN
      await expect(service.submitOffer(DRIVER_ID, OFFER_BODY))
        .rejects.toThrow(BadRequestException);
      expect(offersRepo.save).not.toHaveBeenCalled();
    });
  });

  // ── b) Aceptar oferta → estado correcto ───────────────────────────────────

  describe('updateOffer — accept', () => {
    const OFFER_ID = 'offer-uuid-1';

    test('GIVEN shipper acepta oferta pendiente WHEN ejecuta accept THEN oferta queda accepted y carga matched', async () => {
      const MOCK_OFFER = { id: OFFER_ID, load_id: LOAD_ID, driver_id: DRIVER_ID, status: 'pending', price: 50_000 };
      const MOCK_LOAD = { id: LOAD_ID, shipper_id: SHIPPER_ID, status: 'available' };
      const MOCK_SHIPPER = { id: SHIPPER_ID, user_id: SHIPPER_USER_ID };
      const MOCK_DRIVER_USER = { id: DRIVER_ID, email: 'driver@test.com', name: 'Driver Test' };
      const qb = makeQueryBuilder();

      // GIVEN
      offersRepo.findOne.mockResolvedValueOnce(MOCK_OFFER);
      loadsRepo.findOne.mockResolvedValueOnce(MOCK_LOAD);
      shippersRepo.findOne.mockResolvedValueOnce(MOCK_SHIPPER);
      loadsRepo.save.mockResolvedValueOnce({ ...MOCK_LOAD, status: 'matched' });
      // bulk reject query builder
      offersRepo.find.mockResolvedValueOnce([]); // sin otras ofertas pendientes
      offersRepo.createQueryBuilder.mockReturnValue(qb);
      const savedOffer = { ...MOCK_OFFER, status: 'accepted' };
      offersRepo.save.mockResolvedValueOnce(savedOffer);
      // post-save: mail
      usersRepo.findOne.mockResolvedValueOnce(MOCK_DRIVER_USER);

      // WHEN
      const result = await service.updateOffer(SHIPPER_USER_ID, OFFER_ID, 'accept');

      // THEN
      expect(result.status).toBe('accepted');
      expect(loadsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'matched' }),
      );
      expect(mailService.sendOfertaAceptada).toHaveBeenCalledTimes(1);
    });

    test('GIVEN oferta rechazada WHEN shipper intenta aceptarla THEN lanza BadRequestException', async () => {
      const MOCK_OFFER_REJECTED = { id: OFFER_ID, load_id: LOAD_ID, driver_id: DRIVER_ID, status: 'rejected', price: 50_000 };
      const MOCK_LOAD = { id: LOAD_ID, shipper_id: SHIPPER_ID, status: 'available' };
      const MOCK_SHIPPER = { id: SHIPPER_ID, user_id: SHIPPER_USER_ID };

      // GIVEN
      offersRepo.findOne.mockResolvedValueOnce(MOCK_OFFER_REJECTED);
      loadsRepo.findOne.mockResolvedValueOnce(MOCK_LOAD);
      shippersRepo.findOne.mockResolvedValueOnce(MOCK_SHIPPER);

      // WHEN / THEN
      await expect(service.updateOffer(SHIPPER_USER_ID, OFFER_ID, 'accept'))
        .rejects.toThrow(BadRequestException);
    });

    test('GIVEN oferta inexistente WHEN shipper intenta aceptar THEN lanza NotFoundException', async () => {
      // GIVEN
      offersRepo.findOne.mockResolvedValueOnce(null);

      // WHEN / THEN
      await expect(service.updateOffer(SHIPPER_USER_ID, OFFER_ID, 'accept'))
        .rejects.toThrow(NotFoundException);
    });
  });
});
