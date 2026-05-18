import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Request,
  UseGuards,
  Headers,
  ForbiddenException,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { mkdirSync } from 'fs';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

type AuthReq = { user: { id: string; role: string; email: string } };
import { ReportsService } from './reports.service';
import {
  ReportReason,
  ReportStatus,
  AdminAction,
} from '../entities/report.entity';

const uploadsDir = join(process.cwd(), 'uploads', 'reports');
mkdirSync(uploadsDir, { recursive: true });

@Controller('reports')
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  createReport(
    @Request() req: AuthReq,
    @Body()
    body: {
      reported_id: string;
      reason: ReportReason;
      description: string;
      evidence_url?: string;
    },
  ) {
    return this.reportsService.createReport(req.user.id, body);
  }

  @Post('upload-evidence')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: uploadsDir,
        filename: /* istanbul ignore next */ (_req, file, cb) => {
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
          cb(null, `${unique}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: /* istanbul ignore next */ (_req, file, cb) => {
        if (!file.mimetype.match(/^image\/(jpeg|png|webp)$/)) {
          cb(new Error('Solo se permiten imágenes (jpg, png, webp)'), false);
        } else {
          cb(null, true);
        }
      },
    }),
  )
  uploadEvidence(
    @Request() req: AuthReq,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const backendUrl =
      process.env.BACKEND_URL ?? `http://localhost:${process.env.PORT ?? 3001}`;
    const url = `${backendUrl}/uploads/reports/${file.filename}`;
    return { url };
  }

  @Get('user/:id/public-profile')
  @UseGuards(JwtAuthGuard)
  async getPublicProfile(@Param('id') id: string) {
    return this.reportsService.getPublicProfile(id);
  }

  @Get('admin')
  getAdminReports(@Headers('x-internal-secret') secret: string) {
    if (secret !== process.env.INTERNAL_SECRET) throw new ForbiddenException();
    return this.reportsService.getAdminReports();
  }

  @Patch('admin/:id')
  updateReport(
    @Headers('x-internal-secret') secret: string,
    @Param('id') id: string,
    @Body()
    body: {
      status?: ReportStatus;
      admin_action?: AdminAction;
      admin_notes?: string;
    },
  ) {
    if (secret !== process.env.INTERNAL_SECRET) throw new ForbiddenException();
    return this.reportsService.updateReport(id, body);
  }
}
