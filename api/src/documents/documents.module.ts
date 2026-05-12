import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { DniVisionService } from './dni-vision.service';
import { AfipVerificationService } from './afip-verification.service';
import { TruckerDocument } from '../entities/trucker-document.entity';
import { User } from '../entities/user.entity';
import { Truck } from '../entities/truck.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([TruckerDocument, User, Truck]),
    HttpModule.register({ timeout: 10000 }),
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService, DniVisionService, AfipVerificationService],
})
export class DocumentsModule {}
