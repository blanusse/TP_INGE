import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { LoadsModule } from './loads/loads.module';
import { OffersModule } from './offers/offers.module';
import { FleetModule } from './fleet/fleet.module';
import { MessagesModule } from './messages/messages.module';
import { RatingsModule } from './ratings/ratings.module';
import { StatsModule } from './stats/stats.module';
import { PaymentsModule } from './payments/payments.module';
import { LocationModule } from './location/location.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 60_000, limit: 10 },   // 10 req/min por IP
      { name: 'auth',  ttl: 900_000, limit: 20 },   // 20 intentos de auth cada 15 min
    ]),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize: true,
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
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
