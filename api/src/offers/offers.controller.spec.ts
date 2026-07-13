import { Test, TestingModule } from '@nestjs/testing';
import { OffersController } from './offers.controller';
import { OffersService } from './offers.service';
import { RequireOnboardingCompleteGuard } from '../onboarding/require-onboarding-complete.guard';

const mockService = {
  submitOffer: jest.fn(),
  getOffersForLoad: jest.fn(),
  getMyOffers: jest.fn(),
  getFleetOffers: jest.fn(),
  getOfferById: jest.fn(),
  updateOffer: jest.fn(),
};

const mockReq = { user: { id: 'user-1', role: 'transportista', email: 'a@b.com' } };

describe('OffersController', () => {
  let controller: OffersController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OffersController],
      providers: [{ provide: OffersService, useValue: mockService }],
    })
      .overrideGuard(RequireOnboardingCompleteGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get<OffersController>(OffersController);
  });

  it('should be defined', () => expect(controller).toBeDefined());

  it('submitOffer delegates to service', () => {
    const body = { load_id: 'l-1', price: 5000 };
    mockService.submitOffer.mockReturnValue({ id: 'o-1' });
    controller.submitOffer(mockReq as any, body);
    expect(mockService.submitOffer).toHaveBeenCalledWith('user-1', body);
  });

  it('getOffersForLoad delegates to service', () => {
    mockService.getOffersForLoad.mockReturnValue([]);
    controller.getOffersForLoad(mockReq as any, 'load-1');
    expect(mockService.getOffersForLoad).toHaveBeenCalledWith('user-1', 'load-1');
  });

  it('getMyOffers delegates to service', () => {
    mockService.getMyOffers.mockReturnValue([]);
    controller.getMyOffers(mockReq as any);
    expect(mockService.getMyOffers).toHaveBeenCalledWith('user-1');
  });

  it('getFleetOffers delegates to service', () => {
    mockService.getFleetOffers.mockReturnValue([]);
    controller.getFleetOffers(mockReq as any);
    expect(mockService.getFleetOffers).toHaveBeenCalledWith('user-1');
  });

  it('getOfferById delegates to service', () => {
    mockService.getOfferById.mockReturnValue({ id: 'o-1' });
    controller.getOfferById(mockReq as any, 'o-1');
    expect(mockService.getOfferById).toHaveBeenCalledWith('user-1', 'o-1');
  });

  it('updateOffer delegates to service with parsed body', () => {
    const body = { action: 'accept', counter_price: 4000 };
    mockService.updateOffer.mockReturnValue({ id: 'o-1' });
    controller.updateOffer(mockReq as any, 'o-1', body);
    expect(mockService.updateOffer).toHaveBeenCalledWith('user-1', 'o-1', 'accept', 4000);
  });
});
