import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InsurancePolicy } from '../entities/insurance-policy.entity';
import { InsuranceProduct } from '../entities/insurance-product.entity';
import { InsuranceController } from './insurance.controller';
import { InsuranceService } from './insurance.service';
import { INSURANCE_PROVIDER } from './insurance.provider';
import { MockInsuranceProvider } from './providers/mock.provider';

/**
 * To switch to a real provider:
 *   1. Create providers/loadsure.provider.ts implementing InsuranceProvider
 *   2. Replace MockInsuranceProvider below with the new class
 *   3. Done — no other files need to change.
 */
@Module({
  imports: [TypeOrmModule.forFeature([InsurancePolicy, InsuranceProduct])],
  controllers: [InsuranceController],
  providers: [
    InsuranceService,
    { provide: INSURANCE_PROVIDER, useClass: MockInsuranceProvider },
  ],
})
export class InsuranceModule {}
