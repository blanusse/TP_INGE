import { Test, TestingModule } from '@nestjs/testing';
import { InsuranceController } from './insurance.controller';
import { InsuranceService } from './insurance.service';

const mockService = {
  getProducts: jest.fn(),
  getAllProducts: jest.fn(),
  createProduct: jest.fn(),
  updateProduct: jest.fn(),
  deleteProduct: jest.fn(),
  getQuote: jest.fn(),
  purchasePolicy: jest.fn(),
  getMyPolicies: jest.fn(),
};

const mockReq = { user: { id: 'user-1', role: 'admin' } };

describe('InsuranceController', () => {
  let controller: InsuranceController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InsuranceController],
      providers: [{ provide: InsuranceService, useValue: mockService }],
    }).compile();

    controller = module.get<InsuranceController>(InsuranceController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('getProducts delegates to service', () => {
    mockService.getProducts.mockReturnValue([]);
    expect(controller.getProducts()).toEqual([]);
    expect(mockService.getProducts).toHaveBeenCalled();
  });

  it('getAllProducts delegates to service', () => {
    mockService.getAllProducts.mockReturnValue([]);
    expect(controller.getAllProducts(mockReq as any)).toEqual([]);
    expect(mockService.getAllProducts).toHaveBeenCalled();
  });

  it('createProduct delegates to service with role and body', () => {
    const body = { name: 'Plan A', insurer: 'Aseg', coverage_type: 'todo-riesgo', price: 1000, conditions: 'ok' };
    mockService.createProduct.mockReturnValue({ id: '1', ...body });
    controller.createProduct(mockReq as any, body);
    expect(mockService.createProduct).toHaveBeenCalledWith('admin', body);
  });

  it('updateProduct delegates to service with role, id and body', () => {
    const body = { price: 2000 };
    mockService.updateProduct.mockReturnValue({});
    controller.updateProduct(mockReq as any, 'prod-1', body);
    expect(mockService.updateProduct).toHaveBeenCalledWith('admin', 'prod-1', body);
  });

  it('deleteProduct delegates to service with role and id', () => {
    mockService.deleteProduct.mockReturnValue({});
    controller.deleteProduct(mockReq as any, 'prod-1');
    expect(mockService.deleteProduct).toHaveBeenCalledWith('admin', 'prod-1');
  });

  it('getQuote delegates to service', () => {
    const body = { declared_value: 100000, cargo_type: 'granos', pickup_city: 'BA', dropoff_city: 'CBA' };
    mockService.getQuote.mockReturnValue({ premium: 800 });
    controller.getQuote(body);
    expect(mockService.getQuote).toHaveBeenCalledWith(body);
  });

  it('purchasePolicy delegates to service with userId and body', () => {
    const body = {
      declared_value: 100000,
      cargo_type: 'granos',
      pickup_city: 'BA',
      dropoff_city: 'CBA',
      quote_id: 'q-1',
      product_id: 'prod-1',
    };
    mockService.purchasePolicy.mockReturnValue({ id: 'pol-1' });
    controller.purchasePolicy(mockReq as any, body);
    expect(mockService.purchasePolicy).toHaveBeenCalledWith('user-1', body);
  });

  it('getMyPolicies delegates to service with userId', () => {
    mockService.getMyPolicies.mockReturnValue([]);
    controller.getMyPolicies(mockReq as any, undefined);
    expect(mockService.getMyPolicies).toHaveBeenCalledWith('user-1', undefined);
  });

  it('getMyPolicies delegates with load_id when provided', () => {
    mockService.getMyPolicies.mockReturnValue([]);
    controller.getMyPolicies(mockReq as any, 'load-1');
    expect(mockService.getMyPolicies).toHaveBeenCalledWith('user-1', 'load-1');
  });
});
