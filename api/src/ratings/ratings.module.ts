import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Rating } from '../entities/rating.entity';
import { Offer } from '../entities/offer.entity';
import { Load } from '../entities/load.entity';
import { Shipper } from '../entities/shipper.entity';
import { RatingsController } from './ratings.controller';
import { RatingsService } from './ratings.service';

@Module({
  imports: [TypeOrmModule.forFeature([Rating, Offer, Load, Shipper])],
  controllers: [RatingsController],
  providers: [RatingsService],
})
export class RatingsModule {}
