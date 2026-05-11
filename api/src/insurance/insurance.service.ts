import { Inject, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InsurancePolicy } from '../entities/insurance-policy.entity';
import { InsuranceProduct } from '../entities/insurance-product.entity';
import type { InsuranceProvider, QuoteParams } from './insurance.provider';
import { INSURANCE_PROVIDER } from './insurance.provider';

@Injectable()
export class InsuranceService {
  constructor(
    @Inject(INSURANCE_PROVIDER) private provider: InsuranceProvider,
    @InjectRepository(InsurancePolicy)
    private policiesRepo: Repository<InsurancePolicy>,
    @InjectRepository(InsuranceProduct)
    private productsRepo: Repository<InsuranceProduct>,
  ) {}

  // ── Catálogo (admin gestiona, dadores ven) ────────────────────────────────

  getProducts() {
    return this.productsRepo.find({
      where: { is_active: true },
      order: { created_at: 'DESC' },
    });
  }

  getAllProducts() {
    return this.productsRepo.find({ order: { created_at: 'DESC' } });
  }

  async createProduct(
    role: string,
    body: {
      name: string;
      insurer: string;
      coverage_type: string;
      price: number;
      conditions: string;
    },
  ) {
    if (role !== 'admin') throw new ForbiddenException('Solo administradores.');
    const product = this.productsRepo.create({ ...body, is_active: true });
    return this.productsRepo.save(product);
  }

  async deleteProduct(role: string, id: string) {
    if (role !== 'admin') throw new ForbiddenException('Solo administradores.');
    const product = await this.productsRepo.findOne({ where: { id } });
    if (!product) throw new NotFoundException('Seguro no encontrado.');
    product.is_active = false;
    return this.productsRepo.save(product);
  }

  // ── Cotización / compra (flujo simulado) ──────────────────────────────────

  getQuote(params: QuoteParams) {
    return this.provider.getQuote(params);
  }

  async purchasePolicy(
    userId: string,
    params: QuoteParams & { quote_id: string; load_id?: string },
  ) {
    const result = await this.provider.purchasePolicy({
      ...params,
      user_id: userId,
    });

    const policy = this.policiesRepo.create({
      user_id: userId,
      load_id: params.load_id ?? null,
      declared_value: params.declared_value,
      cargo_type: params.cargo_type,
      pickup_city: params.pickup_city,
      dropoff_city: params.dropoff_city,
      distance_km: params.distance_km ?? null,
      provider: this.provider.providerKey,
      external_policy_id: result.external_policy_id,
      provider_data: result.provider_data,
      coverage_ends_at: result.coverage_ends_at,
      premium: (await this.provider.getQuote(params)).premium,
    });

    return this.policiesRepo.save(policy);
  }

  getMyPolicies(userId: string) {
    return this.policiesRepo.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
    });
  }
}
