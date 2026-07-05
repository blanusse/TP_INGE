import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
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
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn(async (cb: any) => {
              // Simple in-test stub: la transacción ejecuta el callback con un
              // EntityManager que reusa los repos mockeados arriba.
              const tx = {
                getRepository: (entity: any) => {
                  if (entity === Offer) return offersRepo;
                  if (entity === Load) return loadsRepo;
                  return {};
                },
              };
              return cb(tx);
            }),
          },
        },
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
      offersRepo.findOne.mockResolvedValueOnce(MOCK_OFFER); // pre-tx lookup
      loadsRepo.findOne.mockResolvedValueOnce(MOCK_LOAD); // pre-tx lookup
      shippersRepo.findOne.mockResolvedValueOnce(MOCK_SHIPPER);
      // dentro de la transacción: lock load + lock offer
      loadsRepo.findOne.mockResolvedValueOnce(MOCK_LOAD);
      offersRepo.findOne.mockResolvedValueOnce(MOCK_OFFER);
      loadsRepo.save.mockResolvedValueOnce({ ...MOCK_LOAD, status: 'matched' });
      // bulk reject: query builder + listado de ofertas afectadas
      offersRepo.find.mockResolvedValueOnce([]);
      offersRepo.createQueryBuilder.mockReturnValue(qb);
      const savedOffer = { ...MOCK_OFFER, status: 'accepted' };
      offersRepo.save.mockResolvedValue(savedOffer);
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
      // tx: re-lock load + re-lock offer
      loadsRepo.findOne.mockResolvedValueOnce(MOCK_LOAD);
      offersRepo.findOne.mockResolvedValueOnce(MOCK_OFFER_REJECTED);

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

  // ── submitOffer — assigned_driver_id ──────────────────────────────────────

  describe('submitOffer — assigned_driver_id', () => {
    test('non-fleet-owner assigning driver throws ForbiddenException', async () => {
      usersRepo.findOne.mockResolvedValueOnce({ ...MOCK_DRIVER, is_fleet_owner: false });
      await expect(
        service.submitOffer(DRIVER_ID, { load_id: LOAD_ID, price: 1000, assigned_driver_id: 'other' }),
      ).rejects.toThrow(ForbiddenException);
    });

    test('assigned driver not found throws BadRequestException', async () => {
      usersRepo.findOne
        .mockResolvedValueOnce({ ...MOCK_DRIVER, id: 'fleet-owner', is_fleet_owner: true })
        .mockResolvedValueOnce(null);
      await expect(
        service.submitOffer('fleet-owner', { load_id: LOAD_ID, price: 1000, assigned_driver_id: 'ghost' }),
      ).rejects.toThrow(BadRequestException);
    });

    test('assigned driver not in fleet throws ForbiddenException', async () => {
      usersRepo.findOne
        .mockResolvedValueOnce({ id: 'fleet-owner', is_fleet_owner: true, fleet_id: null })
        .mockResolvedValueOnce({ id: 'rogue', fleet_id: 'other-fleet', is_verified: false, dni_verified: false, license_verified: false });
      await expect(
        service.submitOffer('fleet-owner', { load_id: LOAD_ID, price: 1000, assigned_driver_id: 'rogue' }),
      ).rejects.toThrow(ForbiddenException);
    });

    test('unverified assigned driver throws BadRequestException', async () => {
      usersRepo.findOne
        .mockResolvedValueOnce({ id: 'fleet-owner', is_fleet_owner: true, fleet_id: null })
        .mockResolvedValueOnce({ id: 'fleet-driver', fleet_id: 'fleet-owner', is_verified: false, dni_verified: false, license_verified: false });
      await expect(
        service.submitOffer('fleet-owner', { load_id: LOAD_ID, price: 1000, assigned_driver_id: 'fleet-driver' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── submitOffer — sin truck_id ────────────────────────────────────────────

  describe('submitOffer — sin truck_id', () => {
    test('no verified trucks throws BadRequestException', async () => {
      usersRepo.findOne.mockResolvedValueOnce(MOCK_DRIVER);
      usersRepo.count.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
      trucksRepo.count.mockResolvedValueOnce(0); // no verified trucks
      await expect(
        service.submitOffer(DRIVER_ID, { load_id: LOAD_ID, price: 5000 }),
      ).rejects.toThrow(BadRequestException);
    });

    test('no trucks at all throws BadRequestException', async () => {
      usersRepo.findOne.mockResolvedValueOnce(MOCK_DRIVER);
      usersRepo.count.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
      trucksRepo.count
        .mockResolvedValueOnce(1)  // verified trucks → passes
        .mockResolvedValueOnce(0); // total trucks → fails
      await expect(
        service.submitOffer(DRIVER_ID, { load_id: LOAD_ID, price: 5000 }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── getOffersForLoad ──────────────────────────────────────────────────────

  describe('getOffersForLoad', () => {
    test('shipper not found throws ForbiddenException', async () => {
      shippersRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.getOffersForLoad('u-1', LOAD_ID)).rejects.toThrow(ForbiddenException);
    });

    test('load shipper mismatch throws ForbiddenException', async () => {
      shippersRepo.findOne.mockResolvedValueOnce({ id: 'other', user_id: 'u-1' });
      loadsRepo.findOne.mockResolvedValueOnce({ id: LOAD_ID, shipper_id: SHIPPER_ID });
      await expect(service.getOffersForLoad('u-1', LOAD_ID)).rejects.toThrow(ForbiddenException);
    });

    test('returns offers enriched with driver and rating', async () => {
      shippersRepo.findOne.mockResolvedValueOnce(MOCK_SHIPPER_RECORD);
      loadsRepo.findOne.mockResolvedValueOnce(MOCK_LOAD_AVAILABLE);
      offersRepo.find.mockResolvedValueOnce([{ id: 'o-1', driver_id: DRIVER_ID, load_id: LOAD_ID }]);
      usersRepo.find.mockResolvedValueOnce([{ id: DRIVER_ID, name: 'Pedro' }]);
      const qb = makeQueryBuilder();
      qb.getRawMany.mockResolvedValueOnce([{ to_user_id: DRIVER_ID, avg_score: '4.5', count: '2' }]);
      ratingsRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getOffersForLoad(SHIPPER_USER_ID, LOAD_ID);
      expect(result[0].avg_rating).toBe('4.5');
      expect(result[0].driver).toMatchObject({ name: 'Pedro' });
    });
  });

  // ── getMyOffers ───────────────────────────────────────────────────────────

  describe('getMyOffers', () => {
    test('returns offers with loads when offer list is non-empty', async () => {
      offersRepo.find.mockResolvedValueOnce([{ id: 'o-1', driver_id: DRIVER_ID, load_id: LOAD_ID }]);
      loadsRepo.find.mockResolvedValueOnce([MOCK_LOAD_AVAILABLE]);
      const result = await service.getMyOffers(DRIVER_ID);
      expect(result[0].load).toEqual(MOCK_LOAD_AVAILABLE);
    });

    test('returns empty array without querying loads when no offers', async () => {
      offersRepo.find.mockResolvedValueOnce([]);
      const result = await service.getMyOffers(DRIVER_ID);
      expect(loadsRepo.find).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  // ── getOfferById ──────────────────────────────────────────────────────────

  describe('getOfferById', () => {
    test('offer not found throws NotFoundException', async () => {
      offersRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.getOfferById('u-1', 'o-1')).rejects.toThrow(NotFoundException);
    });

    test('shipper not matching load throws ForbiddenException', async () => {
      offersRepo.findOne.mockResolvedValueOnce({ id: 'o-1', load_id: LOAD_ID, driver_id: DRIVER_ID });
      loadsRepo.findOne.mockResolvedValueOnce(MOCK_LOAD_AVAILABLE);
      shippersRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.getOfferById('stranger', 'o-1')).rejects.toThrow(ForbiddenException);
    });

    test('returns offer when shipper matches', async () => {
      const offer = { id: 'o-1', load_id: LOAD_ID };
      offersRepo.findOne.mockResolvedValueOnce(offer);
      loadsRepo.findOne.mockResolvedValueOnce(MOCK_LOAD_AVAILABLE);
      shippersRepo.findOne.mockResolvedValueOnce(MOCK_SHIPPER_RECORD);
      const result = await service.getOfferById(SHIPPER_USER_ID, 'o-1');
      expect(result).toEqual(offer);
    });
  });

  // ── updateOffer — remaining actions ──────────────────────────────────────

  describe('updateOffer — reject / counter / driver actions', () => {
    const OFFER_ID = 'offer-uuid-1';

    const setupShipper = (status = 'pending') => {
      const offer = { id: OFFER_ID, load_id: LOAD_ID, driver_id: DRIVER_ID, status, price: 5000, counter_price: 4000 };
      offersRepo.findOne.mockResolvedValueOnce(offer);
      loadsRepo.findOne.mockResolvedValueOnce(MOCK_LOAD_AVAILABLE);
      shippersRepo.findOne.mockResolvedValueOnce(MOCK_SHIPPER_RECORD);
      // tx re-lookups (sólo se consumen si la acción es 'accept')
      loadsRepo.findOne.mockResolvedValueOnce(MOCK_LOAD_AVAILABLE);
      offersRepo.findOne.mockResolvedValueOnce(offer);
      loadsRepo.save.mockResolvedValue({ ...MOCK_LOAD_AVAILABLE, status: 'matched' });
      offersRepo.save.mockImplementation((o) => Promise.resolve(o));
      return offer;
    };

    const setupDriver = (status = 'countered') => {
      const offer = { id: OFFER_ID, load_id: LOAD_ID, driver_id: DRIVER_ID, status, price: 5000, counter_price: 4000 };
      offersRepo.findOne.mockResolvedValueOnce(offer);
      loadsRepo.findOne.mockResolvedValueOnce({ ...MOCK_LOAD_AVAILABLE });
      shippersRepo.findOne.mockResolvedValueOnce(null); // not a shipper
      offersRepo.save.mockImplementation((o) => Promise.resolve(o));
      return offer;
    };

    test('load not found throws NotFoundException', async () => {
      offersRepo.findOne.mockResolvedValueOnce({ id: OFFER_ID, load_id: LOAD_ID });
      loadsRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.updateOffer('u-1', OFFER_ID, 'accept')).rejects.toThrow(NotFoundException);
    });

    test('neither shipper nor driver throws ForbiddenException', async () => {
      offersRepo.findOne.mockResolvedValueOnce({ id: OFFER_ID, load_id: LOAD_ID, driver_id: 'other' });
      loadsRepo.findOne.mockResolvedValueOnce(MOCK_LOAD_AVAILABLE);
      shippersRepo.findOne.mockResolvedValueOnce({ id: 'diff-shipper', user_id: 'diff-user' });
      await expect(service.updateOffer('stranger', OFFER_ID, 'reject')).rejects.toThrow(ForbiddenException);
    });

    test('shipper reject sets status rejected and sends mail', async () => {
      setupShipper('pending');
      usersRepo.findOne.mockResolvedValueOnce(MOCK_DADOR_USER);
      await service.updateOffer(SHIPPER_USER_ID, OFFER_ID, 'reject');
      expect(mailService.sendOfertaRechazada).toHaveBeenCalled();
    });

    test('shipper counter without counter_price throws BadRequestException', async () => {
      setupShipper('pending');
      await expect(service.updateOffer(SHIPPER_USER_ID, OFFER_ID, 'counter')).rejects.toThrow(BadRequestException);
    });

    test('shipper counter sets countered status and sends mail', async () => {
      setupShipper('pending');
      usersRepo.findOne.mockResolvedValueOnce(MOCK_DADOR_USER);
      await service.updateOffer(SHIPPER_USER_ID, OFFER_ID, 'counter', 4500);
      expect(mailService.sendContraofertaRecibida).toHaveBeenCalled();
    });

    test('shipper accept with bulk-rejected other drivers sends rejection mails', async () => {
      setupShipper('pending');
      const otherDriver = { id: 'driver-2', email: 'd2@e.com', name: 'Maria' };
      offersRepo.find.mockResolvedValueOnce([{ id: 'o-2', driver_id: 'driver-2' }]);
      const qb = makeQueryBuilder();
      offersRepo.createQueryBuilder.mockReturnValue(qb);
      loadsRepo.save.mockResolvedValueOnce({});
      usersRepo.findOne.mockResolvedValueOnce({ id: DRIVER_ID, email: 'd@e.com', name: 'Pedro' });
      usersRepo.find.mockResolvedValueOnce([otherDriver]);
      await service.updateOffer(SHIPPER_USER_ID, OFFER_ID, 'accept');
      expect(mailService.sendOfertaAceptada).toHaveBeenCalledTimes(1);
      expect(mailService.sendOfertaRechazada).toHaveBeenCalledTimes(1); // solo el bulk-rejected
    });

    test('driver withdraw on invalid status throws BadRequestException', async () => {
      setupDriver('accepted');
      await expect(service.updateOffer(DRIVER_ID, OFFER_ID, 'withdraw')).rejects.toThrow(BadRequestException);
    });

    test('driver withdraw sets withdrawn and sends mail', async () => {
      setupDriver('pending');
      shippersRepo.findOne.mockResolvedValueOnce(MOCK_SHIPPER_RECORD); // loadShipper
      usersRepo.findOne
        .mockResolvedValueOnce(MOCK_DADOR_USER)
        .mockResolvedValueOnce({ id: DRIVER_ID, name: 'Pedro' });
      await service.updateOffer(DRIVER_ID, OFFER_ID, 'withdraw');
      expect(mailService.sendOfertaRetirada).toHaveBeenCalled();
    });

    test('driver accept_counter on non-countered throws BadRequestException', async () => {
      setupDriver('pending');
      await expect(service.updateOffer(DRIVER_ID, OFFER_ID, 'accept_counter')).rejects.toThrow(BadRequestException);
    });

    test('driver accept_counter sets accepted and sends mail', async () => {
      setupDriver('countered');
      shippersRepo.findOne.mockResolvedValueOnce(MOCK_SHIPPER_RECORD);
      loadsRepo.save.mockResolvedValueOnce({});
      usersRepo.findOne
        .mockResolvedValueOnce(MOCK_DADOR_USER)
        .mockResolvedValueOnce({ id: DRIVER_ID, name: 'Pedro' });
      await service.updateOffer(DRIVER_ID, OFFER_ID, 'accept_counter');
      expect(mailService.sendContraofertaAceptada).toHaveBeenCalled();
    });

    test('driver reject_counter on non-countered throws BadRequestException', async () => {
      setupDriver('pending');
      await expect(service.updateOffer(DRIVER_ID, OFFER_ID, 'reject_counter')).rejects.toThrow(BadRequestException);
    });

    test('driver reject_counter sets rejected and sends mail', async () => {
      setupDriver('countered');
      shippersRepo.findOne.mockResolvedValueOnce(MOCK_SHIPPER_RECORD);
      usersRepo.findOne
        .mockResolvedValueOnce(MOCK_DADOR_USER)
        .mockResolvedValueOnce({ id: DRIVER_ID, name: 'Pedro' });
      await service.updateOffer(DRIVER_ID, OFFER_ID, 'reject_counter');
      expect(mailService.sendContraofertaRechazada).toHaveBeenCalled();
    });

    test('driver action: no mail when dadorUser not found', async () => {
      setupDriver('pending');
      shippersRepo.findOne.mockResolvedValueOnce(MOCK_SHIPPER_RECORD);
      usersRepo.findOne
        .mockResolvedValueOnce(null)  // dadorUser not found
        .mockResolvedValueOnce(null);
      await service.updateOffer(DRIVER_ID, OFFER_ID, 'withdraw');
      expect(mailService.sendOfertaRetirada).not.toHaveBeenCalled();
    });
  });

  // ── getFleetOffers ────────────────────────────────────────────────────────

  describe('getFleetOffers', () => {
    test('returns enriched offers with driverName for fleet members', async () => {
      const fleetDriver = { id: 'fleet-d-1', name: 'Ana' };
      usersRepo.find
        .mockResolvedValueOnce([fleetDriver])  // fleet drivers
        .mockResolvedValueOnce([]);
      usersRepo.findOne.mockResolvedValueOnce({ id: 'owner-1', name: 'Owner' });
      offersRepo.find.mockResolvedValueOnce([
        { id: 'o-1', driver_id: 'owner-1', assigned_driver_id: null, load_id: LOAD_ID },
        { id: 'o-2', driver_id: 'fleet-d-1', assigned_driver_id: null, load_id: LOAD_ID },
      ]);
      loadsRepo.find.mockResolvedValueOnce([MOCK_LOAD_AVAILABLE]);

      const result = await service.getFleetOffers('owner-1');
      expect(result).toHaveLength(2);
      expect(result[0].driverName).toBe('Owner');
      expect(result[1].driverName).toBe('Ana');
    });

    test('returns empty array without querying loads when no offers', async () => {
      usersRepo.find.mockResolvedValueOnce([]);
      usersRepo.findOne.mockResolvedValueOnce({ id: 'owner-1', name: 'Owner' });
      offersRepo.find.mockResolvedValueOnce([]);
      const result = await service.getFleetOffers('owner-1');
      expect(loadsRepo.find).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    test('uses assigned_driver_id as effectiveDriverId when present', async () => {
      const sub = { id: 'sub-1', name: 'Sub' };
      usersRepo.find.mockResolvedValueOnce([sub]);
      usersRepo.findOne.mockResolvedValueOnce({ id: 'owner-1', name: 'Owner' });
      offersRepo.find.mockResolvedValueOnce([
        { id: 'o-1', driver_id: 'owner-1', assigned_driver_id: 'sub-1', load_id: LOAD_ID },
      ]);
      loadsRepo.find.mockResolvedValueOnce([MOCK_LOAD_AVAILABLE]);
      const result = await service.getFleetOffers('owner-1');
      expect(result[0].effectiveDriverId).toBe('sub-1');
      expect(result[0].driverName).toBe('Sub');
    });

    test('uses Conductor fallback when driver not in map and ownerUser null', async () => {
      usersRepo.find.mockResolvedValueOnce([]);
      usersRepo.findOne.mockResolvedValueOnce(null);
      offersRepo.find.mockResolvedValueOnce([
        { id: 'o-1', driver_id: 'unknown', assigned_driver_id: null, load_id: LOAD_ID },
      ]);
      loadsRepo.find.mockResolvedValueOnce([MOCK_LOAD_AVAILABLE]);
      const result = await service.getFleetOffers('owner-1');
      expect(result[0].driverName).toBe('Conductor');
    });
  });
});
