import { Test, TestingModule } from '@nestjs/testing';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';

describe('StatsController', () => {
  let controller: StatsController;
  let service: {
    getDriverStats: jest.Mock;
    getShipperStats: jest.Mock;
    getDriverCobros: jest.Mock;
    getFleetStats: jest.Mock;
  };

  const REQ = { user: { id: 'user-1', role: 'transportista', email: 'test@test.com' } };

  beforeEach(async () => {
    service = {
      getDriverStats: jest.fn(),
      getShipperStats: jest.fn(),
      getDriverCobros: jest.fn(),
      getFleetStats: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StatsController],
      providers: [{ provide: StatsService, useValue: service }],
    }).compile();

    controller = module.get<StatsController>(StatsController);
  });

  afterEach(() => jest.clearAllMocks());

  test('GIVEN usuario WHEN getDriverStats THEN delega con userId', async () => {
    service.getDriverStats.mockResolvedValue({ viajesCompletados: 5 });
    const result = await controller.getDriverStats(REQ);
    expect(service.getDriverStats).toHaveBeenCalledWith('user-1');
    expect(result.viajesCompletados).toBe(5);
  });

  test('GIVEN usuario WHEN getShipperStats THEN delega con userId', async () => {
    service.getShipperStats.mockResolvedValue({ totalCargas: 3 });
    const result = await controller.getShipperStats(REQ);
    expect(service.getShipperStats).toHaveBeenCalledWith('user-1');
    expect(result.totalCargas).toBe(3);
  });

  test('GIVEN usuario con filtros WHEN getDriverCobros THEN delega con params', async () => {
    service.getDriverCobros.mockResolvedValue({ cobros: [] });
    const result = await controller.getDriverCobros(REQ, '2025-01-01', '2025-12-31');
    expect(service.getDriverCobros).toHaveBeenCalledWith('user-1', '2025-01-01', '2025-12-31');
  });

  test('GIVEN usuario con filtros WHEN getFleetStats THEN delega con params', async () => {
    service.getFleetStats.mockResolvedValue({ totalViajes: 0 });
    const result = await controller.getFleetStats(REQ, '2025-01-01', '2025-12-31', 'driver-2');
    expect(service.getFleetStats).toHaveBeenCalledWith('user-1', '2025-01-01', '2025-12-31', 'driver-2');
  });
});
