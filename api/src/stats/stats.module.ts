import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { Shipper } from '../entities/shipper.entity';
import { Load } from '../entities/load.entity';
import { Offer } from '../entities/offer.entity';
import { Rating } from '../entities/rating.entity';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Shipper, Load, Offer, Rating])],
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}
