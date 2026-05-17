import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { RatingsService } from './ratings.service';
import { Rating } from '../entities/rating.entity';
import { Offer } from '../entities/offer.entity';
import { Load } from '../entities/load.entity';
import { Shipper } from '../entities/shipper.entity';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRepo() {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    create: jest.fn((data) => ({ ...data })),
  };
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('RatingsService', () => {
  let service: RatingsService;
  let ratingsRepo: ReturnType<typeof makeRepo>;
  let offersRepo: ReturnType<typeof makeRepo>;
  let loadsRepo: ReturnType<typeof makeRepo>;
  let shippersRepo: ReturnType<typeof makeRepo>;

  const DRIVER_ID = 'driver-1';
  const SHIPPER_USER_ID = 'shipper-user-1';
  const SHIPPER_ID = 'shipper-1';
  const OFFER_ID = 'offer-1';
  const LOAD_ID = 'load-1';

  const MOCK_OFFER = { id: OFFER_ID, load_id: LOAD_ID, driver_id: DRIVER_ID };
  const MOCK_LOAD = { id: LOAD_ID, status: 'delivered', shipper_id: SHIPPER_ID };
  const MOCK_SHIPPER = { id: SHIPPER_ID, user_id: SHIPPER_USER_ID };

  beforeEach(async () => {
    ratingsRepo = makeRepo();
    offersRepo = makeRepo();
    loadsRepo = makeRepo();
    shippersRepo = makeRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RatingsService,
        { provide: getRepositoryToken(Rating), useValue: ratingsRepo },
        { provide: getRepositoryToken(Offer), useValue: offersRepo },
        { provide: getRepositoryToken(Load), useValue: loadsRepo },
        { provide: getRepositoryToken(Shipper), useValue: shippersRepo },
      ],
    }).compile();

    service = module.get<RatingsService>(RatingsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('submitRating', () => {
    test('GIVEN score < 1 WHEN submitRating THEN lanza BadRequestException', async () => {
      await expect(
        service.submitRating(DRIVER_ID, { offer_id: OFFER_ID, score: 0 }),
      ).rejects.toThrow(BadRequestException);
    });

    test('GIVEN score > 5 WHEN submitRating THEN lanza BadRequestException', async () => {
      await expect(
        service.submitRating(DRIVER_ID, { offer_id: OFFER_ID, score: 6 }),
      ).rejects.toThrow(BadRequestException);
    });

    test('GIVEN oferta inexistente WHEN submitRating THEN lanza ForbiddenException', async () => {
      offersRepo.findOne.mockResolvedValue(null);

      await expect(
        service.submitRating(DRIVER_ID, { offer_id: 'bad', score: 4 }),
      ).rejects.toThrow(ForbiddenException);
    });

    test('GIVEN carga no entregada WHEN submitRating THEN lanza BadRequestException', async () => {
      offersRepo.findOne.mockResolvedValue(MOCK_OFFER);
      loadsRepo.findOne.mockResolvedValue({ ...MOCK_LOAD, status: 'in_transit' });

      await expect(
        service.submitRating(DRIVER_ID, { offer_id: OFFER_ID, score: 4 }),
      ).rejects.toThrow(BadRequestException);
    });

    test('GIVEN usuario no es driver ni shipper de la carga WHEN submitRating THEN lanza ForbiddenException', async () => {
      offersRepo.findOne.mockResolvedValue(MOCK_OFFER);
      loadsRepo.findOne.mockResolvedValue(MOCK_LOAD);
      shippersRepo.findOne.mockResolvedValue(null); // no es shipper

      await expect(
        service.submitRating('random-user', { offer_id: OFFER_ID, score: 4 }),
      ).rejects.toThrow(ForbiddenException);
    });

    test('GIVEN driver ya calificó WHEN submitRating THEN lanza ConflictException', async () => {
      offersRepo.findOne.mockResolvedValue(MOCK_OFFER);
      loadsRepo.findOne.mockResolvedValue(MOCK_LOAD);
      shippersRepo.findOne
        .mockResolvedValueOnce(null)    // check if user is shipper
        .mockResolvedValueOnce(MOCK_SHIPPER); // lookup shipper record
      ratingsRepo.findOne.mockResolvedValue({ id: 'existing-rating' });

      await expect(
        service.submitRating(DRIVER_ID, { offer_id: OFFER_ID, score: 4 }),
      ).rejects.toThrow(ConflictException);
    });

    test('GIVEN driver califica pero shipperRecord no existe WHEN submitRating THEN lanza ForbiddenException', async () => {
      offersRepo.findOne.mockResolvedValue(MOCK_OFFER);
      loadsRepo.findOne.mockResolvedValue(MOCK_LOAD);
      shippersRepo.findOne
        .mockResolvedValueOnce(null)   // user is not a shipper
        .mockResolvedValueOnce(null);  // shipperRecord not found

      await expect(
        service.submitRating(DRIVER_ID, { offer_id: OFFER_ID, score: 4 }),
      ).rejects.toThrow(ForbiddenException);
    });

    test('GIVEN driver califica shipper WHEN submitRating THEN crea rating con to_user_id del shipper', async () => {
      offersRepo.findOne.mockResolvedValue(MOCK_OFFER);
      loadsRepo.findOne.mockResolvedValue(MOCK_LOAD);
      shippersRepo.findOne
        .mockResolvedValueOnce(null)         // user is not a shipper
        .mockResolvedValueOnce(MOCK_SHIPPER); // lookup shipper for toUserId
      ratingsRepo.findOne.mockResolvedValue(null); // no existing rating
      ratingsRepo.save.mockImplementation((r) => Promise.resolve({ id: 'r1', ...r }));

      const result = await service.submitRating(DRIVER_ID, { offer_id: OFFER_ID, score: 5 });

      expect(ratingsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          from_user_id: DRIVER_ID,
          to_user_id: SHIPPER_USER_ID,
          score: 5,
        }),
      );
      expect(ratingsRepo.save).toHaveBeenCalledTimes(1);
    });

    test('GIVEN shipper califica driver WHEN submitRating THEN crea rating con to_user_id del driver', async () => {
      offersRepo.findOne.mockResolvedValue(MOCK_OFFER);
      loadsRepo.findOne.mockResolvedValue(MOCK_LOAD);
      shippersRepo.findOne.mockResolvedValueOnce(MOCK_SHIPPER); // user IS the shipper
      ratingsRepo.findOne.mockResolvedValue(null);
      ratingsRepo.save.mockImplementation((r) => Promise.resolve({ id: 'r2', ...r }));

      await service.submitRating(SHIPPER_USER_ID, { offer_id: OFFER_ID, score: 3 });

      expect(ratingsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          from_user_id: SHIPPER_USER_ID,
          to_user_id: DRIVER_ID,
          score: 3,
        }),
      );
    });
  });
});
