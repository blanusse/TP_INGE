import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { User } from '../entities/user.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { Load } from '../entities/load.entity';
import { Offer } from '../entities/offer.entity';
import { Shipper } from '../entities/shipper.entity';

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

  /** Viajes con transportista asignado que todavía no terminaron (para el simulador). */
  async getUnfinishedTrips() {
    const loads = await this.loadsRepo.find({
      where: { status: In(['matched', 'in_transit']) },
      order: { created_at: 'DESC' },
    });
    if (loads.length === 0) return [];

    const manager = this.loadsRepo.manager;
    const loadIds = loads.map((l) => l.id);
    const shipperIds = [...new Set(loads.map((l) => l.shipper_id))];

    const [offers, shippers] = await Promise.all([
      manager.find(Offer, { where: { load_id: In(loadIds), status: 'accepted' } }),
      manager.find(Shipper, { where: { id: In(shipperIds) } }),
    ]);

    const driverIds = [
      ...new Set(offers.map((o) => o.assigned_driver_id ?? o.driver_id)),
    ];
    const userIds = [...new Set([...driverIds, ...shippers.map((s) => s.user_id)])];
    const users = userIds.length
      ? await this.usersRepo.find({ where: { id: In(userIds) } })
      : [];

    const userById = new Map(users.map((u) => [u.id, u]));
    const offerByLoad = new Map(offers.map((o) => [o.load_id, o]));
    const shipperById = new Map(shippers.map((s) => [s.id, s]));

    return loads.map((l) => {
      const offer = offerByLoad.get(l.id);
      const driver = offer
        ? userById.get(offer.assigned_driver_id ?? offer.driver_id)
        : undefined;
      const shipper = shipperById.get(l.shipper_id);
      const shipperUser = shipper ? userById.get(shipper.user_id) : undefined;
      return {
        id: l.id,
        status: l.status,
        cargo_type: l.cargo_type,
        pickup_city: l.pickup_city,
        dropoff_city: l.dropoff_city,
        pickup_lat: l.pickup_lat != null ? Number(l.pickup_lat) : null,
        pickup_lon: l.pickup_lon != null ? Number(l.pickup_lon) : null,
        dropoff_lat: l.dropoff_lat != null ? Number(l.dropoff_lat) : null,
        dropoff_lon: l.dropoff_lon != null ? Number(l.dropoff_lon) : null,
        distance_km: l.distance_km != null ? Number(l.distance_km) : null,
        price: offer ? Number(offer.price) : null,
        driver_name: driver?.name ?? null,
        shipper_name: shipper?.razon_social ?? shipperUser?.name ?? null,
        created_at: l.created_at,
      };
    });
  }
}
