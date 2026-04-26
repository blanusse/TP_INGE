import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Load } from '../entities/load.entity';
import { Shipper } from '../entities/shipper.entity';
import { Offer } from '../entities/offer.entity';
import { User } from '../entities/user.entity';

const TRUCK_TYPE_MAP: Record<string, string> = {
  'Furgón cerrado': 'camion',
  'Plataforma': 'semi',
  'Refrigerado': 'frigorifico',
  'Cisterna': 'cisterna',
};


@Injectable()
export class LoadsService {
  constructor(
    @InjectRepository(Load) private loadsRepo: Repository<Load>,
    @InjectRepository(Shipper) private shippersRepo: Repository<Shipper>,
    @InjectRepository(Offer) private offersRepo: Repository<Offer>,
    @InjectRepository(User) private usersRepo: Repository<User>,
  ) {}

  async getMyLoads(userId: string) {
    const shipper = await this.shippersRepo.findOne({ where: { user_id: userId } });
    if (!shipper) throw new ForbiddenException('Solo los dadores de carga pueden ver sus cargas.');

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
      ? await this.usersRepo.find({ where: { id: In(acceptedDriverIds) }, select: ['id', 'name'] })
      : [];
    const driverMap = Object.fromEntries(drivers.map((d) => [d.id, d.name]));

    return loads.map((load) => {
      const loadOffers = offers.filter((o) => o.load_id === load.id);
      const accepted = loadOffers.find((o) => o.status === 'accepted');
      return {
        ...load,
        offer_count: loadOffers.length,
        accepted_offer: accepted
          ? { offerId: accepted.id, precio: Number(accepted.price), driverName: driverMap[accepted.driver_id] ?? null }
          : null,
      };
    });
  }

  async createLoad(userId: string, body: Partial<Load> & { truck_type_required?: string }) {
    const shipper = await this.shippersRepo.findOne({ where: { user_id: userId } });
    if (!shipper) throw new ForbiddenException('Solo los dadores de carga pueden publicar cargas.');

    const mappedTruckType = body.truck_type_required
      ? (TRUCK_TYPE_MAP[body.truck_type_required] ?? body.truck_type_required)
      : undefined;

    const load = this.loadsRepo.create({
      ...body,
      shipper_id: shipper.id,
      truck_type_required: mappedTruckType,
      status: 'available',
    });

    return this.loadsRepo.save(load);
  }

  async getAvailableLoads(cargoType?: string, origin?: string) {
    const qb = this.loadsRepo.createQueryBuilder('l')
      .select([
        'l.id', 'l.pickup_city', 'l.dropoff_city', 'l.cargo_type',
        'l.truck_type_required', 'l.weight_kg', 'l.price_base',
        'l.ready_at', 'l.description', 'l.status', 'l.created_at',
      ])
      .where('l.status = :status', { status: 'available' });

    if (cargoType) qb.andWhere('l.cargo_type = :cargoType', { cargoType });
    if (origin) qb.andWhere('l.pickup_city ILIKE :origin', { origin: `%${origin}%` });

    return qb.orderBy('l.created_at', 'DESC').getMany();
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
    const shipper = await this.shippersRepo.findOne({ where: { user_id: userId } });
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

  async confirmDelivery(userId: string, loadId: string) {
    const shipper = await this.shippersRepo.findOne({ where: { user_id: userId } });
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
