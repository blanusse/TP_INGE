import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { Shipper } from '../entities/shipper.entity';
import { Truck } from '../entities/truck.entity';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';
import { RequireOnboardingCompleteGuard } from './require-onboarding-complete.guard';

@Module({
  imports: [TypeOrmModule.forFeature([User, Shipper, Truck])],
  controllers: [OnboardingController],
  providers: [OnboardingService, RequireOnboardingCompleteGuard],
  exports: [OnboardingService, RequireOnboardingCompleteGuard],
})
export class OnboardingModule {}
