import { Test, TestingModule } from '@nestjs/testing';
import { LocationController } from './location.controller';
import { LocationService } from './location.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TripLocation } from './trip-location.entity';
import { Offer } from '../entities/offer.entity';
import { Load } from '../entities/load.entity';
import { Shipper } from '../entities/shipper.entity';
import { of } from 'rxjs';

const mockRepo = {
  upsert: jest.fn(),
  findOne: jest.fn(),
};

const mockOffersRepo = { findOne: jest.fn() };
const mockLoadsRepo = { findOne: jest.fn() };
const mockShippersRepo = { findOne: jest.fn() };

const mockLocationService = {
  emit: jest.fn(),
  stream: jest.fn(),
};

const driverReq = { user: { id: 'driver-1', role: 'transportista' } } as any;

describe('LocationController', () => {
  let controller: LocationController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LocationController],
      providers: [
        { provide: LocationService, useValue: mockLocationService },
        { provide: getRepositoryToken(TripLocation), useValue: mockRepo },
        { provide: getRepositoryToken(Offer), useValue: mockOffersRepo },
        { provide: getRepositoryToken(Load), useValue: mockLoadsRepo },
        { provide: getRepositoryToken(Shipper), useValue: mockShippersRepo },
      ],
    }).compile();

    controller = module.get<LocationController>(LocationController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('update', () => {
    it('upserts position and emits, returns ok', async () => {
      mockOffersRepo.findOne.mockResolvedValue({ id: 'o-1' });
      mockRepo.upsert.mockResolvedValue(undefined);

      const result = await controller.update(driverReq, 'load-1', {
        lat: 10,
        lng: 20,
      });

      expect(mockRepo.upsert).toHaveBeenCalledWith(
        { load_id: 'load-1', lat: 10, lng: 20 },
        ['load_id'],
      );
      expect(mockLocationService.emit).toHaveBeenCalledWith('load-1', 10, 20);
      expect(result).toEqual({ ok: true });
    });
  });

  describe('getLast', () => {
    it('returns the found location', async () => {
      mockLoadsRepo.findOne.mockResolvedValue({ id: 'load-1', shipper_id: 's-1' });
      mockOffersRepo.findOne.mockResolvedValue({ id: 'o-1' });
      const loc = { load_id: 'load-1', lat: 10, lng: 20 };
      mockRepo.findOne.mockResolvedValue(loc);

      const result = await controller.getLast(driverReq, 'load-1');
      expect(result).toEqual(loc);
    });

    it('returns null when not found', async () => {
      mockLoadsRepo.findOne.mockResolvedValue({ id: 'load-X', shipper_id: 's-1' });
      mockOffersRepo.findOne.mockResolvedValue({ id: 'o-1' });
      mockRepo.findOne.mockResolvedValue(null);

      const result = await controller.getLast(driverReq, 'load-X');
      expect(result).toBeNull();
    });
  });

  describe('stream', () => {
    it('returns the observable from locationService', async () => {
      mockLoadsRepo.findOne.mockResolvedValue({ id: 'load-1', shipper_id: 's-1' });
      mockOffersRepo.findOne.mockResolvedValue({ id: 'o-1' });
      const obs = of({ data: { lat: 1, lng: 2 } });
      mockLocationService.stream.mockReturnValue(obs);

      const result = await controller.stream(driverReq, 'load-1');
      expect(mockLocationService.stream).toHaveBeenCalledWith('load-1');
      expect(result).toBe(obs);
    });
  });
});
