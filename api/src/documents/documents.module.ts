import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { DniVisionService } from './dni-vision.service';
import { TruckerDocument } from '../entities/trucker-document.entity';
import { User } from '../entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([TruckerDocument, User])],
  controllers: [DocumentsController],
  providers: [DocumentsService, DniVisionService],
})
export class DocumentsModule {}
