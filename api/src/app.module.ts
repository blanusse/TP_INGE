import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
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
})
export class AppModule {}
