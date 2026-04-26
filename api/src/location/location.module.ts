import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TripLocation } from './trip-location.entity';
import { LocationService } from './location.service';
import { LocationController } from './location.controller';

@Module({
  imports: [TypeOrmModule.forFeature([TripLocation])],
  providers: [LocationService],
  controllers: [LocationController],
})
export class LocationModule {}
