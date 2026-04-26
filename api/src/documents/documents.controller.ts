import {
  Controller, Post, Get, Patch, Body, Param, Request, UseGuards,
  ForbiddenException, UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { mkdirSync } from 'fs';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DocumentsService } from './documents.service';
import { DocumentTipo, DocumentStatus } from '../entities/trucker-document.entity';

const uploadsDir = join(process.cwd(), 'uploads', 'documents');
mkdirSync(uploadsDir, { recursive: true });

@Controller('documents')
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(private documentsService: DocumentsService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: uploadsDir,
      filename: (_req, file, cb) => {
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
        cb(null, `${unique}${extname(file.originalname)}`);
      },
    }),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  }))
  async uploadDocument(
    @Request() req,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { tipo: DocumentTipo },
  ) {
    const backendUrl = process.env.BACKEND_URL ?? `http://localhost:${process.env.PORT ?? 3001}`;
    const url = `${backendUrl}/uploads/documents/${file.filename}`;
    return this.documentsService.createDocument(req.user.id, body.tipo, url);
  }

  @Get('mine')
  getMyDocuments(@Request() req) {
    return this.documentsService.getMyDocuments(req.user.id);
  }

  @Get('pending')
  getPending(@Request() req) {
    if (req.user.role !== 'admin') throw new ForbiddenException();
    return this.documentsService.getPendingDocuments();
  }

  @Get('all')
  getAll(@Request() req) {
    if (req.user.role !== 'admin') throw new ForbiddenException();
    return this.documentsService.getAllDocuments();
  }

  @Patch(':id')
  updateStatus(
    @Request() req,
    @Param('id') id: string,
    @Body() body: { status: DocumentStatus; admin_note?: string },
  ) {
    if (req.user.role !== 'admin') throw new ForbiddenException();
    return this.documentsService.updateStatus(id, req.user.id, body.status, body.admin_note);
  }
}
