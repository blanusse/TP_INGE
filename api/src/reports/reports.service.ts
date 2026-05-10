import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import {
  Report,
  ReportReason,
  ReportStatus,
  AdminAction,
} from '../entities/report.entity';
import { User } from '../entities/user.entity';
import { MailService } from '../mail/mail.service';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Report) private reportsRepo: Repository<Report>,
    @InjectRepository(User) private usersRepo: Repository<User>,
    private mailService: MailService,
  ) {}

  async createReport(
    reporterId: string,
    body: {
      reported_id: string;
      reason: ReportReason;
      description: string;
      evidence_url?: string;
    },
  ) {
    if (reporterId === body.reported_id) {
      throw new BadRequestException('No podés reportarte a vos mismo.');
    }

    const reported = await this.usersRepo.findOne({
      where: { id: body.reported_id },
    });
    if (!reported)
      throw new NotFoundException('El usuario reportado no existe.');

    // Check for existing active report from same reporter to same reported
    const existing = await this.reportsRepo.findOne({
      where: {
        reporter_id: reporterId,
        reported_id: body.reported_id,
        status: In(['pending', 'under_review']),
      },
    });
    if (existing) {
      throw new ConflictException(
        'Ya tenés un reporte activo contra este usuario.',
      );
    }

    const reporter = await this.usersRepo.findOne({
      where: { id: reporterId },
    });

    const report = this.reportsRepo.create({
      reporter_id: reporterId,
      reported_id: body.reported_id,
      reason: body.reason,
      description: body.description,
      evidence_url: body.evidence_url ?? undefined,
      status: 'pending' as const,
    });
    await this.reportsRepo.save(report);

    // Send email to admin
    try {
      await this.mailService.sendNuevoReporte({
        reporterName: reporter?.name ?? 'Usuario',
        reportedName: reported.name,
        reason: body.reason,
        description: body.description,
      });
    } catch {
      // ignored
    }

    return report;
  }

  async getPublicProfile(userId: string) {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado.');

    const ratingResult: { avg: string | null; count: string } | undefined =
      await this.reportsRepo.manager
        .createQueryBuilder()
        .select('AVG(r.score)', 'avg')
        .addSelect('COUNT(r.id)', 'count')
        .from('ratings', 'r')
        .where('r.to_user_id = :userId', { userId })
        .getRawOne();

    const tripCount: { count: string } | undefined =
      await this.reportsRepo.manager
        .createQueryBuilder()
        .select('COUNT(DISTINCT o.id)', 'count')
        .from('offers', 'o')
        .innerJoin('loads', 'l', 'l.id = o.load_id')
        .where('(o.driver_id = :userId OR o.assigned_driver_id = :userId)', {
          userId,
        })
        .andWhere('o.status = :status', { status: 'accepted' })
        .andWhere('l.status = :loadStatus', { loadStatus: 'completed' })
        .getRawOne();

    return {
      id: user.id,
      name: user.name,
      role: user.role,
      created_at: user.created_at,
      avg_rating: ratingResult?.avg ? parseFloat(ratingResult.avg) : 0,
      rating_count: parseInt(ratingResult?.count ?? '0'),
      trips_completed: parseInt(tripCount?.count ?? '0'),
    };
  }

  async getAdminReports() {
    return this.reportsRepo.find({
      relations: ['reporter', 'reported'],
      order: { created_at: 'DESC' },
    });
  }

  async updateReport(
    reportId: string,
    body: {
      status?: ReportStatus;
      admin_action?: AdminAction;
      admin_notes?: string;
    },
  ) {
    const report = await this.reportsRepo.findOne({
      where: { id: reportId },
      relations: ['reported'],
    });
    if (!report) throw new NotFoundException('Reporte no encontrado.');

    if (body.status) report.status = body.status;
    if (body.admin_notes !== undefined) report.admin_notes = body.admin_notes;
    if (body.admin_action) {
      report.admin_action = body.admin_action;
      // Update user account_status if suspended or banned
      if (body.admin_action === 'suspended' || body.admin_action === 'banned') {
        await this.usersRepo.update(report.reported_id, {
          account_status: body.admin_action,
        });
      }
    }

    if (body.status === 'resolved' || body.status === 'dismissed') {
      report.resolved_at = new Date();
    }

    await this.reportsRepo.save(report);
    return report;
  }
}
