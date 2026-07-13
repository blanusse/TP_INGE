import { Test, TestingModule } from '@nestjs/testing';
import { MessagesGateway } from './messages.gateway';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Offer } from '../entities/offer.entity';
import { Load } from '../entities/load.entity';
import { Shipper } from '../entities/shipper.entity';
import { Message } from '../entities/message.entity';
import { User } from '../entities/user.entity';

const mockJwtService = {
  verify: jest.fn(),
};

const makeRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
});

const makeClient = (overrides: Partial<any> = {}): any => ({
  handshake: { auth: { token: 'valid-token' }, headers: {} },
  data: {},
  disconnect: jest.fn(),
  join: jest.fn(),
  emit: jest.fn(),
  ...overrides,
});

describe('MessagesGateway', () => {
  let gateway: MessagesGateway;
  let offersRepo: ReturnType<typeof makeRepo>;
  let loadsRepo: ReturnType<typeof makeRepo>;
  let shippersRepo: ReturnType<typeof makeRepo>;

  beforeEach(async () => {
    jest.clearAllMocks();
    offersRepo = makeRepo();
    loadsRepo = makeRepo();
    shippersRepo = makeRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagesGateway,
        { provide: JwtService, useValue: mockJwtService },
        { provide: getRepositoryToken(Offer), useValue: offersRepo },
        { provide: getRepositoryToken(Load), useValue: loadsRepo },
        { provide: getRepositoryToken(Shipper), useValue: shippersRepo },
        { provide: getRepositoryToken(Message), useValue: makeRepo() },
        { provide: getRepositoryToken(User), useValue: makeRepo() },
      ],
    }).compile();

    gateway = module.get<MessagesGateway>(MessagesGateway);
    gateway.server = { to: jest.fn().mockReturnThis(), emit: jest.fn() } as any;
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('handleConnection', () => {
    it('sets userId from JWT token', () => {
      mockJwtService.verify.mockReturnValue({ sub: 'user-1' });
      const client = makeClient();
      gateway.handleConnection(client);
      expect(client.data.userId).toBe('user-1');
      expect(client.disconnect).not.toHaveBeenCalled();
    });

    it('uses id field when sub is missing', () => {
      mockJwtService.verify.mockReturnValue({ id: 'user-2' });
      const client = makeClient();
      gateway.handleConnection(client);
      expect(client.data.userId).toBe('user-2');
    });

    it('disconnects when no token provided', () => {
      const client = makeClient({ handshake: { auth: {}, headers: {} } });
      gateway.handleConnection(client);
      expect(client.disconnect).toHaveBeenCalled();
    });

    it('disconnects when JWT verification fails', () => {
      mockJwtService.verify.mockImplementation(() => { throw new Error('invalid'); });
      const client = makeClient();
      gateway.handleConnection(client);
      expect(client.disconnect).toHaveBeenCalled();
    });

    it('extracts token from Authorization header when auth.token missing', () => {
      mockJwtService.verify.mockReturnValue({ sub: 'user-3' });
      const client = makeClient({
        handshake: {
          auth: {},
          headers: { authorization: 'Bearer header-token' },
        },
      });
      gateway.handleConnection(client);
      expect(mockJwtService.verify).toHaveBeenCalledWith('header-token');
    });
  });

  describe('handleDisconnect', () => {
    it('does not throw', () => {
      expect(() => gateway.handleDisconnect(makeClient())).not.toThrow();
    });
  });

  describe('handleJoin', () => {
    it('disconnects if userId missing', async () => {
      const client = makeClient({ data: { userId: null } });
      await gateway.handleJoin(client, 'offer-1');
      expect(client.disconnect).toHaveBeenCalled();
    });

    it('returns early if offer not found', async () => {
      offersRepo.findOne.mockResolvedValue(null);
      const client = makeClient({ data: { userId: 'user-1' } });
      await gateway.handleJoin(client, 'offer-1');
      expect(client.join).not.toHaveBeenCalled();
    });

    it('returns early if load not found', async () => {
      offersRepo.findOne.mockResolvedValue({ id: 'offer-1', load_id: 'load-1', driver_id: 'user-1' });
      loadsRepo.findOne.mockResolvedValue(null);
      const client = makeClient({ data: { userId: 'user-1' } });
      await gateway.handleJoin(client, 'offer-1');
      expect(client.join).not.toHaveBeenCalled();
    });

    it('returns early if load status is not matched/in_transit', async () => {
      offersRepo.findOne.mockResolvedValue({ id: 'offer-1', load_id: 'load-1', driver_id: 'user-1' });
      loadsRepo.findOne.mockResolvedValue({ id: 'load-1', status: 'pending', shipper_id: 'shipper-1' });
      const client = makeClient({ data: { userId: 'user-1' } });
      await gateway.handleJoin(client, 'offer-1');
      expect(client.join).not.toHaveBeenCalled();
    });

    it('joins room when user is the driver', async () => {
      offersRepo.findOne.mockResolvedValue({ id: 'offer-1', load_id: 'load-1', driver_id: 'user-1' });
      loadsRepo.findOne.mockResolvedValue({ id: 'load-1', status: 'matched', shipper_id: 'shipper-1' });
      shippersRepo.findOne.mockResolvedValue(null);
      const client = makeClient({ data: { userId: 'user-1' } });
      await gateway.handleJoin(client, 'offer-1');
      expect(client.join).toHaveBeenCalledWith('offer-1');
    });

    it('joins room when user is the shipper', async () => {
      offersRepo.findOne.mockResolvedValue({ id: 'offer-1', load_id: 'load-1', driver_id: 'driver-2' });
      loadsRepo.findOne.mockResolvedValue({ id: 'load-1', status: 'in_transit', shipper_id: 'shipper-obj-id' });
      shippersRepo.findOne.mockResolvedValue({ id: 'shipper-obj-id', user_id: 'user-1' });
      const client = makeClient({ data: { userId: 'user-1' } });
      await gateway.handleJoin(client, 'offer-1');
      expect(client.join).toHaveBeenCalledWith('offer-1');
    });

    it('returns without joining if user is neither driver nor shipper', async () => {
      offersRepo.findOne.mockResolvedValue({ id: 'offer-1', load_id: 'load-1', driver_id: 'other' });
      loadsRepo.findOne.mockResolvedValue({ id: 'load-1', status: 'matched', shipper_id: 'shipper-obj-id' });
      shippersRepo.findOne.mockResolvedValue({ id: 'another-shipper', user_id: 'user-1' });
      const client = makeClient({ data: { userId: 'user-1' } });
      await gateway.handleJoin(client, 'offer-1');
      expect(client.join).not.toHaveBeenCalled();
    });
  });

  describe('emitNewMessage', () => {
    it('emits to the correct room', () => {
      const toSpy = jest.fn().mockReturnThis();
      const emitSpy = jest.fn();
      gateway.server = { to: toSpy, emit: emitSpy } as any;

      const msg = { id: 'msg-1' } as any;
      gateway.emitNewMessage('offer-1', msg);

      expect(toSpy).toHaveBeenCalledWith('offer-1');
      expect(emitSpy).toHaveBeenCalledWith('new_message', msg);
    });
  });
});
