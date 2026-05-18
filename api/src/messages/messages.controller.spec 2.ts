import { Test, TestingModule } from '@nestjs/testing';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { MessagesGateway } from './messages.gateway';

const mockService = {
  getUnreadCount: jest.fn(),
  getMessages: jest.fn(),
  sendMessage: jest.fn(),
  getConversations: jest.fn(),
};

const mockGateway = {
  emitNewMessage: jest.fn(),
};

const mockReq = { user: { id: 'user-1', role: 'driver', email: 'a@b.com' } };

describe('MessagesController', () => {
  let controller: MessagesController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MessagesController],
      providers: [
        { provide: MessagesService, useValue: mockService },
        { provide: MessagesGateway, useValue: mockGateway },
      ],
    }).compile();

    controller = module.get<MessagesController>(MessagesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('getUnreadCount delegates to service', () => {
    mockService.getUnreadCount.mockReturnValue({ count: 3 });
    const result = controller.getUnreadCount(mockReq as any);
    expect(mockService.getUnreadCount).toHaveBeenCalledWith('user-1');
    expect(result).toEqual({ count: 3 });
  });

  it('getMessages delegates to service', () => {
    mockService.getMessages.mockReturnValue([]);
    const result = controller.getMessages(mockReq as any, 'offer-1');
    expect(mockService.getMessages).toHaveBeenCalledWith('user-1', 'offer-1');
    expect(result).toEqual([]);
  });

  it('sendMessage delegates to service with gateway', () => {
    const body = { offer_id: 'offer-1', content: 'Hola' };
    mockService.sendMessage.mockReturnValue({ id: 'msg-1' });
    const result = controller.sendMessage(mockReq as any, body);
    expect(mockService.sendMessage).toHaveBeenCalledWith('user-1', body, mockGateway);
    expect(result).toEqual({ id: 'msg-1' });
  });

  it('getConversations delegates to service', () => {
    mockService.getConversations.mockReturnValue([]);
    const result = controller.getConversations(mockReq as any);
    expect(mockService.getConversations).toHaveBeenCalledWith('user-1');
    expect(result).toEqual([]);
  });
});
