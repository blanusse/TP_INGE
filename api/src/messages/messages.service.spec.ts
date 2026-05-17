import { Test, TestingModule } from '@nestjs/testing';
import { MessagesService } from './messages.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Message } from '../entities/message.entity';
import { Offer } from '../entities/offer.entity';
import { Load } from '../entities/load.entity';
import { Shipper } from '../entities/shipper.entity';
import { User } from '../entities/user.entity';
import { ForbiddenException, BadRequestException } from '@nestjs/common';

const makeRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  count: jest.fn(),
  update: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  createQueryBuilder: jest.fn(),
});

const matchedLoad = { id: 'load-1', status: 'matched', shipper_id: 'shipper-obj-1', pickup_city: 'BA', dropoff_city: 'CBA', cargo_type: 'Pallets' };
const acceptedOffer = { id: 'offer-1', load_id: 'load-1', driver_id: 'driver-1', status: 'accepted', price: 50000 };
const shipperRecord = { id: 'shipper-obj-1', user_id: 'shipper-user-1' };
const driverUser = { id: 'driver-1', name: 'Pedro' };

describe('MessagesService', () => {
  let service: MessagesService;
  let messagesRepo: ReturnType<typeof makeRepo>;
  let offersRepo: ReturnType<typeof makeRepo>;
  let loadsRepo: ReturnType<typeof makeRepo>;
  let shippersRepo: ReturnType<typeof makeRepo>;
  let usersRepo: ReturnType<typeof makeRepo>;

  beforeEach(async () => {
    jest.clearAllMocks();
    messagesRepo = makeRepo();
    offersRepo = makeRepo();
    loadsRepo = makeRepo();
    shippersRepo = makeRepo();
    usersRepo = makeRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagesService,
        { provide: getRepositoryToken(Message), useValue: messagesRepo },
        { provide: getRepositoryToken(Offer), useValue: offersRepo },
        { provide: getRepositoryToken(Load), useValue: loadsRepo },
        { provide: getRepositoryToken(Shipper), useValue: shippersRepo },
        { provide: getRepositoryToken(User), useValue: usersRepo },
      ],
    }).compile();

    service = module.get<MessagesService>(MessagesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── assertAccess (via getMessages) ────────────────────────────────────────

  describe('assertAccess', () => {
    it('throws ForbiddenException when offer not found', async () => {
      offersRepo.findOne.mockResolvedValue(null);
      await expect(service.getMessages('user-1', 'offer-x')).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when load not found', async () => {
      offersRepo.findOne.mockResolvedValue(acceptedOffer);
      loadsRepo.findOne.mockResolvedValue(null);
      await expect(service.getMessages('user-1', 'offer-1')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when load status is not matched/in_transit', async () => {
      offersRepo.findOne.mockResolvedValue(acceptedOffer);
      loadsRepo.findOne.mockResolvedValue({ ...matchedLoad, status: 'pending' });
      await expect(service.getMessages('user-1', 'offer-1')).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException when user is neither driver nor shipper', async () => {
      offersRepo.findOne.mockResolvedValue(acceptedOffer);
      loadsRepo.findOne.mockResolvedValue(matchedLoad);
      shippersRepo.findOne.mockResolvedValue({ id: 'other-shipper', user_id: 'other-user' });
      await expect(service.getMessages('stranger', 'offer-1')).rejects.toThrow(ForbiddenException);
    });

    it('allows access when user is the driver', async () => {
      offersRepo.findOne.mockResolvedValue(acceptedOffer);
      loadsRepo.findOne.mockResolvedValue(matchedLoad);
      shippersRepo.findOne.mockResolvedValue(null);
      messagesRepo.find.mockResolvedValue([]);
      messagesRepo.update.mockResolvedValue({});
      usersRepo.find.mockResolvedValue([]);

      await expect(service.getMessages('driver-1', 'offer-1')).resolves.toEqual([]);
    });

    it('allows access when user is the shipper', async () => {
      offersRepo.findOne.mockResolvedValue(acceptedOffer);
      loadsRepo.findOne.mockResolvedValue(matchedLoad);
      shippersRepo.findOne.mockResolvedValue(shipperRecord);
      messagesRepo.find.mockResolvedValue([]);
      messagesRepo.update.mockResolvedValue({});
      usersRepo.find.mockResolvedValue([]);

      await expect(service.getMessages('shipper-user-1', 'offer-1')).resolves.toEqual([]);
    });
  });

  // ─── getMessages ───────────────────────────────────────────────────────────

  describe('getMessages', () => {
    it('returns messages enriched with sender_name', async () => {
      const msgs = [{ id: 'msg-1', offer_id: 'offer-1', sender_id: 'driver-1', is_read: false, created_at: new Date() }];
      offersRepo.findOne.mockResolvedValue(acceptedOffer);
      loadsRepo.findOne.mockResolvedValue(matchedLoad);
      shippersRepo.findOne.mockResolvedValue(null);
      messagesRepo.find.mockResolvedValue(msgs);
      messagesRepo.update.mockResolvedValue({});
      usersRepo.find.mockResolvedValue([driverUser]);

      const result = await service.getMessages('driver-1', 'offer-1');
      expect(result[0]).toMatchObject({ id: 'msg-1', sender_name: 'Pedro' });
    });
  });

  // ─── sendMessage ───────────────────────────────────────────────────────────

  describe('sendMessage', () => {
    beforeEach(() => {
      offersRepo.findOne.mockResolvedValue(acceptedOffer);
      loadsRepo.findOne.mockResolvedValue(matchedLoad);
      shippersRepo.findOne.mockResolvedValue(null);
    });

    it('creates and saves message, emits via gateway', async () => {
      const saved = { id: 'msg-new', offer_id: 'offer-1', sender_id: 'driver-1', content: 'Hola', is_read: false };
      messagesRepo.create.mockReturnValue(saved);
      messagesRepo.save.mockResolvedValue(saved);
      usersRepo.findOne.mockResolvedValue(driverUser);

      const mockGateway = { emitNewMessage: jest.fn() } as any;
      const result = await service.sendMessage('driver-1', { offer_id: 'offer-1', content: '  Hola  ' }, mockGateway);

      expect(messagesRepo.create).toHaveBeenCalledWith(expect.objectContaining({ content: 'Hola' }));
      expect(mockGateway.emitNewMessage).toHaveBeenCalledWith('offer-1', expect.objectContaining({ sender_name: 'Pedro' }));
      expect(result).toEqual(saved);
    });

    it('works without gateway', async () => {
      const saved = { id: 'msg-2', offer_id: 'offer-1', sender_id: 'driver-1', content: 'Ok', is_read: false };
      messagesRepo.create.mockReturnValue(saved);
      messagesRepo.save.mockResolvedValue(saved);
      usersRepo.findOne.mockResolvedValue(null);

      await expect(
        service.sendMessage('driver-1', { offer_id: 'offer-1', content: 'Ok' }),
      ).resolves.toEqual(saved);
    });
  });

  // ─── getUnreadCount ────────────────────────────────────────────────────────

  describe('getUnreadCount', () => {
    it('returns 0 when user has no accessible offers (driver path)', async () => {
      shippersRepo.findOne.mockResolvedValue(null);
      offersRepo.find.mockResolvedValue([]);

      const result = await service.getUnreadCount('driver-1');
      expect(result).toEqual({ count: 0 });
    });

    it('returns 0 when shipper has no matching loads', async () => {
      shippersRepo.findOne.mockResolvedValue(shipperRecord);
      loadsRepo.find.mockResolvedValue([]);

      const result = await service.getUnreadCount('shipper-user-1');
      expect(result).toEqual({ count: 0 });
    });

    it('returns count when driver has accessible offers', async () => {
      shippersRepo.findOne.mockResolvedValue(null);
      offersRepo.find.mockResolvedValue([{ id: 'offer-1' }]);
      messagesRepo.count.mockResolvedValue(5);

      const result = await service.getUnreadCount('driver-1');
      expect(result).toEqual({ count: 5 });
    });

    it('returns count when shipper has accessible offers', async () => {
      shippersRepo.findOne.mockResolvedValue(shipperRecord);
      loadsRepo.find.mockResolvedValue([matchedLoad]);
      offersRepo.find.mockResolvedValue([{ id: 'offer-1' }]);
      messagesRepo.count.mockResolvedValue(2);

      const result = await service.getUnreadCount('shipper-user-1');
      expect(result).toEqual({ count: 2 });
    });
  });

  // ─── getConversations ──────────────────────────────────────────────────────

  const buildQueryBuilder = (result: any[] = []) => ({
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    distinctOn: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(result),
    getRawMany: jest.fn().mockResolvedValue(result),
  });

  describe('getConversations', () => {
    it('returns empty array when driver has no accepted offers', async () => {
      shippersRepo.findOne.mockResolvedValue(null);
      offersRepo.find.mockResolvedValue([]);

      const result = await service.getConversations('driver-1');
      expect(result).toEqual([]);
    });

    it('returns empty array when shipper has no matching loads', async () => {
      shippersRepo.findOne.mockResolvedValue(shipperRecord);
      loadsRepo.find.mockResolvedValue([]);

      const result = await service.getConversations('shipper-user-1');
      expect(result).toEqual([]);
    });

    it('returns empty array when shipper has loads but no offers', async () => {
      shippersRepo.findOne.mockResolvedValue(shipperRecord);
      loadsRepo.find.mockResolvedValue([matchedLoad]);
      offersRepo.find.mockResolvedValue([]);

      const result = await service.getConversations('shipper-user-1');
      expect(result).toEqual([]);
    });

    it('returns conversations for a driver', async () => {
      shippersRepo.findOne.mockResolvedValue(null);
      offersRepo.find.mockResolvedValue([acceptedOffer]);
      loadsRepo.find.mockResolvedValue([matchedLoad]);
      usersRepo.find
        .mockResolvedValueOnce([driverUser])     // drivers
        .mockResolvedValueOnce([{ id: 'shipper-user-1', name: 'Carlos' }]); // shipperUsers

      const qb = buildQueryBuilder();
      messagesRepo.createQueryBuilder.mockReturnValue(qb);
      shippersRepo.find.mockResolvedValue([shipperRecord]);

      const result = await service.getConversations('driver-1');
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ offer_id: 'offer-1' });
    });

    it('returns conversations for a shipper', async () => {
      shippersRepo.findOne.mockResolvedValue(shipperRecord);
      loadsRepo.find.mockResolvedValue([matchedLoad]);
      offersRepo.find.mockResolvedValue([acceptedOffer]);
      loadsRepo.find.mockResolvedValueOnce([matchedLoad]).mockResolvedValueOnce([matchedLoad]);
      usersRepo.find.mockResolvedValue([driverUser]);

      const qb = buildQueryBuilder();
      messagesRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getConversations('shipper-user-1');
      expect(result).toHaveLength(1);
      expect(result[0].offer_id).toBe('offer-1');
    });
  });
});
