import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Offer } from '../entities/offer.entity';
import { Load } from '../entities/load.entity';
import { Truck } from '../entities/truck.entity';
import { Rating } from '../entities/rating.entity';
import { User } from '../entities/user.entity';
import { Shipper } from '../entities/shipper.entity';
import { OffersController } from './offers.controller';
import { OffersService } from './offers.service';

@Module({
  imports: [TypeOrmModule.forFeature([Offer, Load, Truck, Rating, User, Shipper])],
  controllers: [OffersController],
  providers: [OffersService],
  exports: [OffersService],
})
export class OffersModule {}
