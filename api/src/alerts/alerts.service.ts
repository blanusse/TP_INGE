import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LoadAlert } from '../entities/load-alert.entity';
import { Notification } from '../entities/notification.entity';
import { Load } from '../entities/load.entity';

@Injectable()
export class AlertsService {
  constructor(
    @InjectRepository(LoadAlert) private alertsRepo: Repository<LoadAlert>,
    @InjectRepository(Notification) private notifRepo: Repository<Notification>,
  ) {}

  async getUserAlerts(userId: string) {
    return this.alertsRepo.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
    });
  }

  async createAlert(
    userId: string,
    body: {
      cargo_types?: string[];
      truck_types?: string[];
      origin_city?: string;
      dest_city?: string;
      price_min?: number;
      price_max?: number;
    },
  ) {
    const parts: string[] = [];
    if (body.cargo_types?.length) parts.push(body.cargo_types.join('/'));
    if (body.origin_city) parts.push(`desde ${body.origin_city}`);
    if (body.dest_city) parts.push(`hacia ${body.dest_city}`);
    const name = parts.length ? parts.join(' · ') : 'Alerta general';

    const alert = this.alertsRepo.create({
      user_id: userId,
      name,
      cargo_types: body.cargo_types?.length ? body.cargo_types.join(',') : null,
      truck_types: body.truck_types?.length ? body.truck_types.join(',') : null,
      origin_city: body.origin_city || null,
      dest_city: body.dest_city || null,
      price_min: body.price_min ?? null,
      price_max: body.price_max ?? null,
    });
    return this.alertsRepo.save(alert);
  }

  async deleteAlert(userId: string, alertId: string) {
    const alert = await this.alertsRepo.findOne({ where: { id: alertId } });
    if (!alert) throw new NotFoundException('Alerta no encontrada.');
    if (alert.user_id !== userId) throw new ForbiddenException();
    await this.alertsRepo.delete({ id: alertId });
    return { ok: true };
  }

  async getNotifications(userId: string) {
    return this.notifRepo.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
      take: 50,
    });
  }

  async getUnreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.notifRepo.count({
      where: { user_id: userId, is_read: false },
    });
    return { count };
  }

  async markAllRead(userId: string) {
    await this.notifRepo.update({ user_id: userId, is_read: false }, { is_read: true });
    return { ok: true };
  }

  /** Llamado tras publicar una carga — busca alertas que coincidan y crea notificaciones */
  async checkAndNotify(load: Load): Promise<void> {
    try {
      const qb = this.alertsRepo.createQueryBuilder('a').where('1=1');

      if (load.cargo_type) {
        qb.andWhere(
          '(a.cargo_types IS NULL OR a.cargo_types ILIKE :ct)',
          { ct: `%${load.cargo_type}%` },
        );
      }
      if (load.truck_type_required) {
        qb.andWhere(
          '(a.truck_types IS NULL OR a.truck_types ILIKE :tt)',
          { tt: `%${load.truck_type_required}%` },
        );
      }
      if (load.pickup_city) {
        qb.andWhere(
          "(a.origin_city IS NULL OR :oc ILIKE '%' || a.origin_city || '%')",
          { oc: load.pickup_city },
        );
      }
      if (load.dropoff_city) {
        qb.andWhere(
          "(a.dest_city IS NULL OR :dc ILIKE '%' || a.dest_city || '%')",
          { dc: load.dropoff_city },
        );
      }
      if (load.price_base != null) {
        qb.andWhere('(a.price_min IS NULL OR a.price_min <= :price)', { price: load.price_base });
        qb.andWhere('(a.price_max IS NULL OR a.price_max >= :price2)', { price2: load.price_base });
      }

      const matches = await qb.getMany();
      if (!matches.length) return;

      const desc = [load.cargo_type, load.pickup_city, load.dropoff_city]
        .filter(Boolean)
        .join(' · ');
      const priceStr = load.price_base != null
        ? ` · $${Number(load.price_base).toLocaleString('es-AR')}`
        : '';

      const notifications = matches.map((a) =>
        this.notifRepo.create({
          user_id: a.user_id,
          title: 'Nueva carga disponible',
          body: `${desc}${priceStr}`,
          load_id: load.id,
          is_read: false,
        }),
      );
      await this.notifRepo.save(notifications);
    } catch {
      // No interrumpir la publicación de la carga si falla el sistema de alertas
    }
  }
}
