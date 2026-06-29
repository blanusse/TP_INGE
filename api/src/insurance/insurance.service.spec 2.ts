import { Test, TestingModule } from '@nestjs/testing';
import { InsuranceService } from './insurance.service';
import { INSURANCE_PROVIDER } from './insurance.provider';
import { getRepositoryToken } from '@nestjs/typeorm';
import { InsurancePolicy } from '../entities/insurance-policy.entity';
import { InsuranceProduct } from '../entities/insurance-product.entity';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

const mockProvider = {
  providerKey: 'mock',
  getQuote: jest.fn(),
  purchasePolicy: jest.fn(),
};

const mockPoliciesRepo = {
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
};

const mockProductsRepo = {
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
};

const baseQuoteParams = {
  declared_value: 100000,
  cargo_type: 'granos',
  pickup_city: 'Buenos Aires',
  dropoff_city: 'Córdoba',
};

describe('InsuranceService', () => {
  let service: InsuranceService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InsuranceService,
        { provide: INSURANCE_PROVIDER, useValue: mockProvider },
        { provide: getRepositoryToken(InsurancePolicy), useValue: mockPoliciesRepo },
        { provide: getRepositoryToken(InsuranceProduct), useValue: mockProductsRepo },
      ],
    }).compile();

    service = module.get<InsuranceService>(InsuranceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ── Catálogo ──────────────────────────────────────────────────────────────

  it('getProducts returns active products ordered by created_at DESC', () => {
    mockProductsRepo.find.mockReturnValue([{ id: '1', is_active: true }]);
    const result = service.getProducts();
    expect(mockProductsRepo.find).toHaveBeenCalledWith({
      where: { is_active: true },
      order: { created_at: 'DESC' },
    });
    expect(result).toBeDefined();
  });

  it('getAllProducts returns all products ordered by created_at DESC', () => {
    mockProductsRepo.find.mockReturnValue([]);
    service.getAllProducts();
    expect(mockProductsRepo.find).toHaveBeenCalledWith({ order: { created_at: 'DESC' } });
  });

  describe('createProduct', () => {
    const body = { name: 'Plan A', insurer: 'Seg SA', coverage_type: 'todo-riesgo', price: 1500, conditions: 'Ninguna' };

    it('throws ForbiddenException when role is not admin', async () => {
      await expect(service.createProduct('transportista', body)).rejects.toThrow(ForbiddenException);
    });

    it('creates and saves product when role is admin', async () => {
      const product = { id: '1', ...body, is_active: true };
      mockProductsRepo.create.mockReturnValue(product);
      mockProductsRepo.save.mockResolvedValue(product);

      const result = await service.createProduct('admin', body);
      expect(mockProductsRepo.create).toHaveBeenCalledWith({ ...body, is_active: true });
      expect(result).toEqual(product);
    });
  });

  describe('updateProduct', () => {
    it('throws ForbiddenException when role is not admin', async () => {
      await expect(service.updateProduct('dador', 'p-1', {})).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when product does not exist', async () => {
      mockProductsRepo.findOne.mockResolvedValue(null);
      await expect(service.updateProduct('admin', 'p-1', {})).rejects.toThrow(NotFoundException);
    });

    it('updates and saves product when admin and product exists', async () => {
      const existing = { id: 'p-1', price: 1000, is_active: true };
      mockProductsRepo.findOne.mockResolvedValue(existing);
      mockProductsRepo.save.mockResolvedValue({ ...existing, price: 2000 });

      const result = await service.updateProduct('admin', 'p-1', { price: 2000 });
      expect(result.price).toBe(2000);
    });
  });

  describe('deleteProduct', () => {
    it('throws ForbiddenException when role is not admin', async () => {
      await expect(service.deleteProduct('dador', 'p-1')).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when product does not exist', async () => {
      mockProductsRepo.findOne.mockResolvedValue(null);
      await expect(service.deleteProduct('admin', 'p-1')).rejects.toThrow(NotFoundException);
    });

    it('sets is_active to false and saves when admin and product exists', async () => {
      const existing = { id: 'p-1', is_active: true };
      mockProductsRepo.findOne.mockResolvedValue(existing);
      mockProductsRepo.save.mockResolvedValue({ ...existing, is_active: false });

      await service.deleteProduct('admin', 'p-1');
      expect(existing.is_active).toBe(false);
      expect(mockProductsRepo.save).toHaveBeenCalledWith(existing);
    });
  });

  // ── Cotización / compra ───────────────────────────────────────────────────

  it('getQuote delegates to provider', () => {
    const quote = { quote_id: 'q-1', premium: 800 };
    mockProvider.getQuote.mockResolvedValue(quote);
    const result = service.getQuote(baseQuoteParams);
    expect(mockProvider.getQuote).toHaveBeenCalledWith(baseQuoteParams);
    expect(result).resolves;
  });

  describe('purchasePolicy', () => {
    const purchaseResult = {
      external_policy_id: null,
      provider_data: { note: 'mock' },
      coverage_ends_at: new Date('2025-06-01'),
    };
    const quoteResult = { quote_id: 'q-1', premium: 800, coverage_amount: 100000, provider_name: 'Mock', coverage_days: 30, details: [] };

    it('purchases policy with load_id and distance_km', async () => {
      mockProvider.purchasePolicy.mockResolvedValue(purchaseResult);
      mockProvider.getQuote.mockResolvedValue(quoteResult);
      const savedPolicy = { id: 'pol-1' };
      mockPoliciesRepo.create.mockReturnValue(savedPolicy);
      mockPoliciesRepo.save.mockResolvedValue(savedPolicy);

      const result = await service.purchasePolicy('user-1', {
        ...baseQuoteParams,
        distance_km: 700,
        quote_id: 'q-1',
        load_id: 'load-1',
      });

      expect(mockPoliciesRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        user_id: 'user-1',
        load_id: 'load-1',
        distance_km: 700,
        provider: 'mock',
      }));
      expect(result).toEqual(savedPolicy);
    });

    it('purchases policy without load_id or distance_km (nulls)', async () => {
      mockProvider.purchasePolicy.mockResolvedValue(purchaseResult);
      mockProvider.getQuote.mockResolvedValue(quoteResult);
      const savedPolicy = { id: 'pol-2' };
      mockPoliciesRepo.create.mockReturnValue(savedPolicy);
      mockPoliciesRepo.save.mockResolvedValue(savedPolicy);

      await service.purchasePolicy('user-1', { ...baseQuoteParams, quote_id: 'q-1' });

      expect(mockPoliciesRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        load_id: null,
        distance_km: null,
      }));
    });
  });

  it('getMyPolicies returns policies for userId', () => {
    mockPoliciesRepo.find.mockReturnValue([]);
    service.getMyPolicies('user-1');
    expect(mockPoliciesRepo.find).toHaveBeenCalledWith({
      where: { user_id: 'user-1' },
      order: { created_at: 'DESC' },
    });
  });
});
