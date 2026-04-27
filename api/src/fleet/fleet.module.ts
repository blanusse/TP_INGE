import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Truck } from '../entities/truck.entity';
import { User } from '../entities/user.entity';
import { FleetInvitation } from '../entities/fleet-invitation.entity';
import { FleetController } from './fleet.controller';
import { FleetService } from './fleet.service';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [TypeOrmModule.forFeature([Truck, User, FleetInvitation]), MailModule],
  controllers: [FleetController],
  providers: [FleetService],
})
export class FleetModule {}
