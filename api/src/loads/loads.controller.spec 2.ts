import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { LoadsController } from './loads.controller';
import { LoadsService } from './loads.service';

describe('LoadsController', () => {
  let controller: LoadsController;
  let service: {
    getMyLoads: jest.Mock;
    createLoad: jest.Mock;
    getAvailableLoads: jest.Mock;
    markInTransitByOffer: jest.Mock;
    updateLoad: jest.Mock;
    deleteLoad: jest.Mock;
    markInTransit: jest.Mock;
  };

  const REQ = { user: { id: 'user-1', role: 'shipper', email: 'test@test.com' } };

  beforeEach(async () => {
    service = {
      getMyLoads: jest.fn(),
      createLoad: jest.fn(),
      getAvailableLoads: jest.fn(),
      markInTransitByOffer: jest.fn(),
      updateLoad: jest.fn(),
      deleteLoad: jest.fn(),
      markInTransit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LoadsController],
      providers: [{ provide: LoadsService, useValue: service }],
    }).compile();

    controller = module.get<LoadsController>(LoadsController);
  });

  afterEach(() => jest.clearAllMocks());

  test('GIVEN usuario WHEN getMyLoads THEN delega con userId', async () => {
    service.getMyLoads.mockResolvedValue([]);
    const result = await controller.getMyLoads(REQ);
    expect(service.getMyLoads).toHaveBeenCalledWith('user-1');
    expect(result).toEqual([]);
  });

  test('GIVEN body WHEN createLoad THEN delega con userId y body', async () => {
    const body = { cargo_type: 'General' };
    service.createLoad.mockResolvedValue({ id: 'l1' });
    const result = await controller.createLoad(REQ, body);
    expect(service.createLoad).toHaveBeenCalledWith('user-1', body);
  });

  test('GIVEN filtros WHEN getAvailableLoads THEN delega con params', async () => {
    service.getAvailableLoads.mockResolvedValue([]);
    await controller.getAvailableLoads('Granos', 'Buenos');
    expect(service.getAvailableLoads).toHaveBeenCalledWith('Granos', 'Buenos');
  });

  test('GIVEN secret válido WHEN markInTransitByOffer THEN delega', async () => {
    process.env.INTERNAL_SECRET = 'secret123';
    service.markInTransitByOffer.mockResolvedValue({ id: 'l1' });
    const result = await controller.markInTransitByOffer('o1', 'secret123');
    expect(service.markInTransitByOffer).toHaveBeenCalledWith('o1');
  });

  test('GIVEN secret inválido WHEN markInTransitByOffer THEN lanza UnauthorizedException', () => {
    process.env.INTERNAL_SECRET = 'secret123';
    expect(() => controller.markInTransitByOffer('o1', 'wrong')).toThrow(UnauthorizedException);
  });

  test('GIVEN usuario y body WHEN updateLoad THEN delega', async () => {
    service.updateLoad.mockResolvedValue({ id: 'l1' });
    await controller.updateLoad(REQ, 'l1', { cargo_type: 'Granos' });
    expect(service.updateLoad).toHaveBeenCalledWith('user-1', 'l1', { cargo_type: 'Granos' });
  });

  test('GIVEN usuario WHEN deleteLoad THEN delega', async () => {
    service.deleteLoad.mockResolvedValue({ deleted: true });
    const result = await controller.deleteLoad(REQ, 'l1');
    expect(service.deleteLoad).toHaveBeenCalledWith('user-1', 'l1');
    expect(result).toEqual({ deleted: true });
  });

  test('GIVEN usuario WHEN markInTransit THEN delega', async () => {
    service.markInTransit.mockResolvedValue({ id: 'l1', status: 'in_transit' });
    await controller.markInTransit(REQ, 'l1');
    expect(service.markInTransit).toHaveBeenCalledWith('user-1', 'l1');
  });
});
