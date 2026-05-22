import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { Load } from '../entities/load.entity';

const VALID_ACTIONS = ['suspend', 'unsuspend', 'ban', 'unban'] as const;
type AdminAction = typeof VALID_ACTIONS[number];

const ACTION_TO_STATUS: Record<AdminAction, 'active' | 'suspended' | 'banned'> = {
  suspend:   'suspended',
  unsuspend: 'active',
  ban:       'banned',
  unban:     'active',
};

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)    private usersRepo: Repository<User>,
    @InjectRepository(AuditLog) private auditRepo: Repository<AuditLog>,
    @InjectRepository(Load)    private loadsRepo: Repository<Load>,
  ) {}

  async listUsers(page = 1, limit = 50, search?: string) {
    const qb = this.usersRepo
      .createQueryBuilder('u')
      .select(['u.id', 'u.name', 'u.email', 'u.role', 'u.account_status', 'u.created_at', 'u.is_verified'])
      .orderBy('u.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (search) {
      qb.where('u.name ILIKE :s OR u.email ILIKE :s', { s: `%${search}%` });
    }

    const [users, total] = await qb.getManyAndCount();
    return { users, total, page, limit };
  }

  async updateUserStatus(adminId: string, targetId: string, action: string, reason?: string) {
    if (!VALID_ACTIONS.includes(action as AdminAction)) {
      throw new BadRequestException(`Acción inválida. Usar: ${VALID_ACTIONS.join(', ')}`);
    }

    const [admin, target] = await Promise.all([
      this.usersRepo.findOne({ where: { id: adminId } }),
      this.usersRepo.findOne({ where: { id: targetId } }),
    ]);

    if (!admin || admin.role !== 'admin') throw new ForbiddenException();
    if (!target) throw new NotFoundException('Usuario no encontrado.');
    if (target.role === 'admin') throw new ForbiddenException('No se puede modificar a otro administrador.');

    const newStatus = ACTION_TO_STATUS[action as AdminAction];
    await this.usersRepo.update({ id: targetId }, { account_status: newStatus });

    await this.auditRepo.save(
      this.auditRepo.create({
        admin_id: adminId,
        admin_email: admin.email,
        target_user_id: targetId,
        target_user_email: target.email,
        action,
        reason: reason ?? null,
      }),
    );

    return { id: targetId, account_status: newStatus };
  }

  async getAuditLog(page = 1, limit = 50) {
    const [logs, total] = await this.auditRepo.findAndCount({
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { logs, total, page, limit };
  }

  async getSuspiciousLoads(page = 1, limit = 20) {
    const [loads, total] = await this.loadsRepo.findAndCount({
      where: { is_suspicious: true },
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { loads, total, page, limit };
  }

  async approveLoad(loadId: string) {
    const load = await this.loadsRepo.findOne({ where: { id: loadId } });
    if (!load) throw new NotFoundException('Carga no encontrada.');
    await this.loadsRepo.update(loadId, { is_suspicious: false, suspicious_reason: null });
    return { id: loadId, is_suspicious: false };
  }

  async deleteLoad(loadId: string) {
    const load = await this.loadsRepo.findOne({ where: { id: loadId } });
    if (!load) throw new NotFoundException('Carga no encontrada.');
    await this.loadsRepo.remove(load);
    return { id: loadId, deleted: true };
  }
}
