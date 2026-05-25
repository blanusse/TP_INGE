import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InsurancePolicy } from '../entities/insurance-policy.entity';
import { InsuranceProduct } from '../entities/insurance-product.entity';
import { Load } from '../entities/load.entity';
import { User } from '../entities/user.entity';
import type { InsuranceProvider, QuoteParams } from './insurance.provider';
import { InsuranceConfirmationMailService } from './insurance-confirmation-mail.service';
import { INSURANCE_PROVIDER } from './insurance.provider';

type PurchasePolicyParams = QuoteParams & {
  quote_id: string;
  load_id?: string;
  product_id?: string;
};

@Injectable()
export class InsuranceService {
  private readonly logger = new Logger(InsuranceService.name);

  constructor(
    @Inject(INSURANCE_PROVIDER) private provider: InsuranceProvider,
    @InjectRepository(InsurancePolicy)
    private policiesRepo: Repository<InsurancePolicy>,
    @InjectRepository(InsuranceProduct)
    private productsRepo: Repository<InsuranceProduct>,
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    @InjectRepository(Load)
    private loadsRepo: Repository<Load>,
    private confirmationMailService: InsuranceConfirmationMailService,
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

  async updateProduct(
    role: string,
    id: string,
    body: Partial<{ name: string; insurer: string; coverage_type: string; price: number; conditions: string; is_active: boolean }>,
  ) {
    if (role !== 'admin') throw new ForbiddenException('Solo administradores.');
    const product = await this.productsRepo.findOne({ where: { id } });
    if (!product) throw new NotFoundException('Seguro no encontrado.');
    Object.assign(product, body);
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
    params: PurchasePolicyParams,
  ) {
    const selectedProduct = await this.resolveProduct(params.product_id);
    const quote = await this.provider.getQuote(params);
    const providerParams = {
      declared_value: params.declared_value,
      cargo_type: params.cargo_type,
      distance_km: params.distance_km,
      pickup_city: params.pickup_city,
      dropoff_city: params.dropoff_city,
      quote_id: params.quote_id,
      load_id: params.load_id,
    };
    const result = await this.provider.purchasePolicy({
      ...providerParams,
      user_id: userId,
    });
    const coverageStartsAt = new Date();

    const policy = this.policiesRepo.create({
      user_id: userId,
      load_id: params.load_id ?? null,
      product_id: selectedProduct?.id ?? null,
      insurance_name: selectedProduct?.name ?? 'Seguro de carga CargaBack',
      insurer_name: selectedProduct?.insurer ?? quote.provider_name,
      coverage_type: selectedProduct?.coverage_type ?? 'Cobertura de carga',
      coverage_starts_at: coverageStartsAt,
      declared_value: params.declared_value,
      cargo_type: params.cargo_type,
      pickup_city: params.pickup_city,
      dropoff_city: params.dropoff_city,
      distance_km: params.distance_km ?? null,
      provider: this.provider.providerKey,
      external_policy_id: result.external_policy_id,
      provider_data: result.provider_data,
      coverage_ends_at: result.coverage_ends_at,
      premium: quote.premium,
    });

    const savedPolicy = await this.policiesRepo.save(policy);
    await this.sendPolicyConfirmationEmail(userId, savedPolicy);
    return savedPolicy;
  }

  getMyPolicies(userId: string, loadId?: string) {
    const where: { user_id: string; load_id?: string } = { user_id: userId };
    if (loadId) where.load_id = loadId;

    return this.policiesRepo.find({
      where,
      order: { created_at: 'DESC' },
    });
  }

  private async resolveProduct(productId?: string) {
    if (!productId) return null;

    const product = await this.productsRepo.findOne({
      where: { id: productId, is_active: true },
    });

    if (!product) throw new NotFoundException('Seguro no encontrado o inactivo.');
    return product;
  }

  private async sendPolicyConfirmationEmail(userId: string, policy: InsurancePolicy) {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user?.email) {
      this.logger.warn(
        `No se envio confirmacion de seguro: usuario ${userId} sin email.`,
      );
      return;
    }

    const load = policy.load_id
      ? await this.loadsRepo.findOne({ where: { id: policy.load_id } })
      : null;

    const coverageStartsAt =
      policy.coverage_starts_at ?? policy.created_at ?? new Date();

    await this.confirmationMailService.sendPolicyConfirmation({
      to: user.email,
      userName: user.name ?? 'usuario',
      insuranceName: policy.insurance_name ?? 'Seguro de carga CargaBack',
      insurerName: policy.insurer_name ?? 'CargaBack Seguros',
      coverageType: policy.coverage_type ?? 'Cobertura de carga',
      tripSummary: this.buildTripSummary(policy, load),
      loadId: policy.load_id ?? null,
      coverageStartsAt,
      coverageEndsAt: policy.coverage_ends_at,
      premium: Number(policy.premium ?? 0),
    });
  }

  private buildTripSummary(policy: InsurancePolicy, load: Load | null) {
    const pickup = load?.pickup_city ?? policy.pickup_city;
    const dropoff = load?.dropoff_city ?? policy.dropoff_city;
    return `${pickup} -> ${dropoff}`;
  }
}
