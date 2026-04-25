import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from '../entities/payment.entity';
import { Offer } from '../entities/offer.entity';
import { Shipper } from '../entities/shipper.entity';
import { User } from '../entities/user.entity';
import { Load } from '../entities/load.entity';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [TypeOrmModule.forFeature([Payment, Offer, Shipper, User, Load])],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
