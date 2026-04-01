import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Truck } from '../entities/truck.entity';
import { User } from '../entities/user.entity';
import { FleetController } from './fleet.controller';
import { FleetService } from './fleet.service';

@Module({
  imports: [TypeOrmModule.forFeature([Truck, User])],
  controllers: [FleetController],
  providers: [FleetService],
})
export class FleetModule {}
