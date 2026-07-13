import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Load } from '../entities/load.entity';
import { Shipper } from '../entities/shipper.entity';
import { Offer } from '../entities/offer.entity';
import { User } from '../entities/user.entity';
import { AlertsService } from '../alerts/alerts.service';

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const TRUCK_TYPE_MAP: Record<string, string> = {
  'Furgón cerrado': 'camion',
  Plataforma: 'semi',
  Refrigerado: 'frigorifico',
  Cisterna: 'cisterna',
};

@Injectable()
export class LoadsService {
  constructor(
    @InjectRepository(Load) private loadsRepo: Repository<Load>,
    @InjectRepository(Shipper) private shippersRepo: Repository<Shipper>,
    @InjectRepository(Offer) private offersRepo: Repository<Offer>,
    @InjectRepository(User) private usersRepo: Repository<User>,
    private alertsService: AlertsService,
  ) {}

  async getMyLoads(userId: string) {
    const shipper = await this.shippersRepo.findOne({
      where: { user_id: userId },
    });
    if (!shipper)
      throw new ForbiddenException(
        'Solo los dadores de carga pueden ver sus cargas.',
      );

    const loads = await this.loadsRepo.find({
      where: { shipper_id: shipper.id },
      order: { created_at: 'DESC' },
    });

    const loadIds = loads.map((l) => l.id);
    const offers = loadIds.length
      ? await this.offersRepo.find({ where: { load_id: In(loadIds) } })
      : [];

    const acceptedDriverIds = offers
      .filter((o) => o.status === 'accepted')
      .map((o) => o.driver_id);
    const drivers = acceptedDriverIds.length
      ? await this.usersRepo.find({
          where: { id: In(acceptedDriverIds) },
          select: ['id', 'name'],
        })
      : [];
    const driverMap = Object.fromEntries(drivers.map((d) => [d.id, d.name]));

    return loads.map((load) => {
      const loadOffers = offers.filter((o) => o.load_id === load.id);
      const accepted = loadOffers.find((o) => o.status === 'accepted');
      return {
        ...load,
        offer_count: loadOffers.length,
        accepted_offer: accepted
          ? {
              offerId: accepted.id,
              precio: Number(accepted.price),
              driverName: driverMap[accepted.driver_id] ?? null,
            }
          : null,
      };
    });
  }

  async createLoad(
    userId: string,
    body: Partial<Load> & { truck_type_required?: string },
  ) {
    const shipper = await this.shippersRepo.findOne({
      where: { user_id: userId },
    });
    if (!shipper)
      throw new ForbiddenException(
        'Solo los dadores de carga pueden publicar cargas.',
      );

    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user?.dni_verified)
      throw new ForbiddenException(
        'Debés verificar tu DNI antes de publicar cargas.',
      );

    if (
      body.weight_kg !== undefined &&
      body.weight_kg !== null &&
      Number(body.weight_kg) <= 0
    ) {
      throw new BadRequestException('El peso debe ser mayor a 0.');
    }
    if (
      body.price_base !== undefined &&
      body.price_base !== null &&
      Number(body.price_base) <= 0
    ) {
      throw new BadRequestException('El precio base debe ser mayor a 0.');
    }

    const mappedTruckType = body.truck_type_required
      ? (TRUCK_TYPE_MAP[body.truck_type_required] ?? body.truck_type_required)
      : undefined;

    let distance_km: number | undefined;
    if (body.pickup_lat != null && body.pickup_lon != null && body.dropoff_lat != null && body.dropoff_lon != null) {
      distance_km = Math.round(haversineKm(Number(body.pickup_lat), Number(body.pickup_lon), Number(body.dropoff_lat), Number(body.dropoff_lon)));
    }

    const load = this.loadsRepo.create({
      ...body,
      shipper_id: shipper.id,
      truck_type_required: mappedTruckType,
      distance_km,
      status: 'available',
    });

    const saved = await this.loadsRepo.save(load);
    // fire-and-forget: un fallo acá no debe voltear la publicación ni el proceso
    Promise.resolve(this.alertsService.checkAndNotify(saved)).catch(() => {});
    this.checkPriceAnomaly(saved).catch(() => {});
    return saved;
  }

  private async checkPriceAnomaly(load: Load): Promise<void> {
    if (!load.price_base || !load.cargo_type) return;

    const lowPct = Number(process.env.PRICE_ALERT_LOW_PCT ?? 40) / 100;
    const highPct = Number(process.env.PRICE_ALERT_HIGH_PCT ?? 250) / 100;

    const row = await this.loadsRepo
      .createQueryBuilder('l')
      .select('AVG(l.price_base)', 'avg')
      .addSelect('COUNT(*)', 'count')
      .where('l.cargo_type = :type', { type: load.cargo_type })
      .andWhere('l.id != :id', { id: load.id })
      .andWhere('l.price_base IS NOT NULL')
      .getRawOne<{ avg: string; count: string }>();

    if (!row || Number(row.count) < 5) return;

    const market = Number(row.avg);
    const price = Number(load.price_base);
    let reason: string | null = null;

    if (price < market * lowPct) {
      reason = `Precio $${price} es menor al ${lowPct * 100}% del promedio de mercado ($${market.toFixed(0)}) para cargas de tipo "${load.cargo_type}"`;
    } else if (price > market * highPct) {
      reason = `Precio $${price} supera el ${highPct * 100}% del promedio de mercado ($${market.toFixed(0)}) para cargas de tipo "${load.cargo_type}"`;
    }

    if (reason) {
      await this.loadsRepo.update(load.id, { is_suspicious: true, suspicious_reason: reason });
    }
  }

  async getAvailableLoads(cargoType?: string, origin?: string) {
    const qb = this.loadsRepo
      .createQueryBuilder('l')
      .select([
        'l.id',
        'l.shipper_id',
        'l.pickup_city',
        'l.dropoff_city',
        'l.cargo_type',
        'l.truck_type_required',
        'l.weight_kg',
        'l.price_base',
        'l.ready_at',
        'l.description',
        'l.status',
        'l.created_at',
        'l.distance_km',
        'l.pickup_lat',
        'l.pickup_lon',
        'l.dropoff_lat',
        'l.dropoff_lon',
      ])
      .where('l.status = :status', { status: 'available' });

    if (cargoType) qb.andWhere('l.cargo_type = :cargoType', { cargoType });
    if (origin)
      qb.andWhere('l.pickup_city ILIKE :origin', { origin: `%${origin}%` });

    const loads = await qb.orderBy('l.created_at', 'DESC').getMany();
    if (loads.length === 0) return loads;

    // Enriquecer con datos del dador (nombre y calificación) para las cards de búsqueda
    const shipperIds = [...new Set(loads.map((l) => l.shipper_id))];
    const shippers = await this.shippersRepo.find({ where: { id: In(shipperIds) } });
    const shipperById = new Map(shippers.map((s) => [s.id, s]));
    const userIds = shippers.map((s) => s.user_id);
    const users = userIds.length
      ? await this.usersRepo.find({ where: { id: In(userIds) } })
      : [];
    const userById = new Map(users.map((u) => [u.id, u]));

    const ratingRows: { to_user_id: string; avg: string; count: string }[] =
      userIds.length
        ? await this.loadsRepo.manager
            .createQueryBuilder()
            .select('r.to_user_id', 'to_user_id')
            .addSelect('AVG(r.score)', 'avg')
            .addSelect('COUNT(*)', 'count')
            .from('ratings', 'r')
            .where('r.to_user_id IN (:...userIds)', { userIds })
            .groupBy('r.to_user_id')
            .getRawMany()
        : [];
    const ratingByUser = new Map(ratingRows.map((r) => [r.to_user_id, r]));

    return loads.map((l) => {
      const shipper = shipperById.get(l.shipper_id);
      const user = shipper ? userById.get(shipper.user_id) : undefined;
      const rating = user ? ratingByUser.get(user.id) : undefined;
      return {
        ...l,
        shipper: shipper
          ? { razon_social: shipper.razon_social ?? user?.name ?? null }
          : null,
        shipper_rating: rating ? Math.round(Number(rating.avg) * 10) / 10 : null,
        shipper_rating_count: rating ? Number(rating.count) : 0,
      };
    });
  }

  async markInTransitByOffer(offerId: string) {
    const offer = await this.offersRepo.findOne({ where: { id: offerId } });
    if (!offer) throw new NotFoundException('Oferta no encontrada.');

    const load = await this.loadsRepo.findOne({ where: { id: offer.load_id } });
    if (!load) throw new NotFoundException('Carga no encontrada.');
    if (load.status !== 'matched') return load; // idempotente: si ya avanzó, no rompe

    load.status = 'in_transit';
    return this.loadsRepo.save(load);
  }

  async markInTransit(userId: string, loadId: string) {
    const shipper = await this.shippersRepo.findOne({
      where: { user_id: userId },
    });
    if (!shipper) throw new ForbiddenException();

    const load = await this.loadsRepo.findOne({ where: { id: loadId } });
    if (!load) throw new NotFoundException('Carga no encontrada.');
    if (load.shipper_id !== shipper.id) throw new ForbiddenException();
    if (load.status !== 'matched') {
      throw new BadRequestException('La carga no está en estado matched.');
    }

    load.status = 'in_transit';
    return this.loadsRepo.save(load);
  }

  async updateLoad(
    userId: string,
    loadId: string,
    body: Partial<
      Pick<
        Load,
        | 'cargo_type'
        | 'truck_type_required'
        | 'weight_kg'
        | 'price_base'
        | 'ready_at'
        | 'description'
      >
    >,
  ) {
    const shipper = await this.shippersRepo.findOne({
      where: { user_id: userId },
    });
    if (!shipper) throw new ForbiddenException();

    const load = await this.loadsRepo.findOne({ where: { id: loadId } });
    if (!load) throw new NotFoundException('Carga no encontrada.');
    if (load.shipper_id !== shipper.id) throw new ForbiddenException();
    if (load.status !== 'available')
      throw new BadRequestException(
        'Solo se pueden editar cargas sin ofertas aceptadas.',
      );

    if (body.cargo_type !== undefined) load.cargo_type = body.cargo_type;
    if (body.truck_type_required !== undefined) {
      load.truck_type_required =
        TRUCK_TYPE_MAP[body.truck_type_required] ?? body.truck_type_required;
    }
    if (body.weight_kg !== undefined) {
      if (Number(body.weight_kg) <= 0)
        throw new BadRequestException('El peso debe ser mayor a 0.');
      load.weight_kg = body.weight_kg;
    }
    if (body.price_base !== undefined) {
      if (Number(body.price_base) <= 0)
        throw new BadRequestException('El precio base debe ser mayor a 0.');
      load.price_base = body.price_base;
    }
    if (body.ready_at !== undefined) load.ready_at = body.ready_at;
    if (body.description !== undefined) load.description = body.description;

    return this.loadsRepo.save(load);
  }

  async deleteLoad(userId: string, loadId: string) {
    const shipper = await this.shippersRepo.findOne({
      where: { user_id: userId },
    });
    if (!shipper) throw new ForbiddenException();

    const load = await this.loadsRepo.findOne({ where: { id: loadId } });
    if (!load) throw new NotFoundException('Carga no encontrada.');
    if (load.shipper_id !== shipper.id) throw new ForbiddenException();
    if (load.status !== 'available')
      throw new BadRequestException(
        'Solo se pueden eliminar cargas sin ofertas aceptadas.',
      );

    await this.loadsRepo.remove(load);
    return { deleted: true };
  }

  async confirmDelivery(userId: string, loadId: string) {
    const shipper = await this.shippersRepo.findOne({
      where: { user_id: userId },
    });
    if (!shipper) throw new ForbiddenException();

    const load = await this.loadsRepo.findOne({ where: { id: loadId } });
    if (!load) throw new NotFoundException('Carga no encontrada.');
    if (load.shipper_id !== shipper.id) throw new ForbiddenException();
    if (load.status !== 'in_transit') {
      throw new BadRequestException('La carga no está en tránsito.');
    }

    load.status = 'delivered';
    return this.loadsRepo.save(load);
  }
}
