import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InsurancePolicy } from '../entities/insurance-policy.entity';
import type { InsuranceProvider, QuoteParams } from './insurance.provider';
import { INSURANCE_PROVIDER } from './insurance.provider';

@Injectable()
export class InsuranceService {
  constructor(
    @Inject(INSURANCE_PROVIDER) private provider: InsuranceProvider,
    @InjectRepository(InsurancePolicy)
    private policiesRepo: Repository<InsurancePolicy>,
  ) {}

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
      // premium is re-derived from the quote so it's stored accurately
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
