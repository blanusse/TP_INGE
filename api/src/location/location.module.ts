import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TripLocation } from './trip-location.entity';
import { Offer } from '../entities/offer.entity';
import { Load } from '../entities/load.entity';
import { Shipper } from '../entities/shipper.entity';
import { LocationService } from './location.service';
import { LocationController } from './location.controller';

@Module({
  imports: [TypeOrmModule.forFeature([TripLocation, Offer, Load, Shipper])],
  providers: [LocationService],
  controllers: [LocationController],
})
export class LocationModule {}
