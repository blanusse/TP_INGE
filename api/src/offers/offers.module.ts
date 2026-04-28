import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Offer } from '../entities/offer.entity';
import { Load } from '../entities/load.entity';
import { Truck } from '../entities/truck.entity';
import { Rating } from '../entities/rating.entity';
import { User } from '../entities/user.entity';
import { Shipper } from '../entities/shipper.entity';
import { TruckerDocument } from '../entities/trucker-document.entity';
import { OffersController } from './offers.controller';
import { OffersService } from './offers.service';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [TypeOrmModule.forFeature([Offer, Load, Truck, Rating, User, Shipper, TruckerDocument]), MailModule],
  controllers: [OffersController],
  providers: [OffersService],
  exports: [OffersService],
})
export class OffersModule {}
