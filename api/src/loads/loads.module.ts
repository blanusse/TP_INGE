import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Load } from '../entities/load.entity';
import { Shipper } from '../entities/shipper.entity';
import { Offer } from '../entities/offer.entity';
import { User } from '../entities/user.entity';
import { LoadsController } from './loads.controller';
import { LoadsService } from './loads.service';

@Module({
  imports: [TypeOrmModule.forFeature([Load, Shipper, Offer, User])],
  controllers: [LoadsController],
  providers: [LoadsService],
  exports: [LoadsService],
})
export class LoadsModule {}
