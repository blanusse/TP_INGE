import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Report } from '../entities/report.entity';
import { User } from '../entities/user.entity';
import { MailModule } from '../mail/mail.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [TypeOrmModule.forFeature([Report, User]), MailModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
