import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { CustomThrottlerGuard } from './common/guards/custom-throttler.guard';
import { AuthModule } from './auth/auth.module';
import { LoadsModule } from './loads/loads.module';
import { OffersModule } from './offers/offers.module';
import { FleetModule } from './fleet/fleet.module';
import { MessagesModule } from './messages/messages.module';
import { RatingsModule } from './ratings/ratings.module';
import { StatsModule } from './stats/stats.module';
import { PaymentsModule } from './payments/payments.module';
import { LocationModule } from './location/location.module';
import { DocumentsModule } from './documents/documents.module';
import { ReportsModule } from './reports/reports.module';
import { AdminModule } from './admin/admin.module';
import { AlertsModule } from './alerts/alerts.module';
import { InsuranceModule } from './insurance/insurance.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { VerificationModule } from './verification/verification.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      { name: 'public', ttl: 60_000, limit: 60 },        // 60 req/min - endpoints públicos (sin auth)
      { name: 'authenticated', ttl: 60_000, limit: 120 }, // 120 req/min - endpoints autenticados
      // 'auth' no es global — solo se activa vía @Throttle() en login/register
    ]),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: /* istanbul ignore next */ (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        autoLoadEntities: true,
        // `synchronize` solo en desarrollo: en prod debería usarse migrations.
        synchronize: config.get<string>('NODE_ENV') !== 'production',
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    LoadsModule,
    OffersModule,
    FleetModule,
    MessagesModule,
    RatingsModule,
    StatsModule,
    PaymentsModule,
    LocationModule,
    DocumentsModule,
    ReportsModule,
    AdminModule,
    AlertsModule,
    InsuranceModule,
    OnboardingModule,
    VerificationModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: CustomThrottlerGuard }],
})
export class AppModule {}
