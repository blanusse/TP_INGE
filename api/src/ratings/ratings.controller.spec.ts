import { Test, TestingModule } from '@nestjs/testing';
import { RatingsController } from './ratings.controller';
import { RatingsService } from './ratings.service';

describe('RatingsController', () => {
  let controller: RatingsController;
  let service: { submitRating: jest.Mock };

  const REQ = { user: { id: 'user-1', role: 'transportista', email: 'test@test.com' } };

  beforeEach(async () => {
    service = { submitRating: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RatingsController],
      providers: [{ provide: RatingsService, useValue: service }],
    }).compile();

    controller = module.get<RatingsController>(RatingsController);
  });

  test('GIVEN body con offer_id y score WHEN submitRating THEN delega al service', async () => {
    const body = { offer_id: 'o1', score: 4 };
    service.submitRating.mockResolvedValue({ id: 'r1' });

    const result = await controller.submitRating(REQ, body);

    expect(service.submitRating).toHaveBeenCalledWith('user-1', body);
    expect(result).toEqual({ id: 'r1' });
  });
});
