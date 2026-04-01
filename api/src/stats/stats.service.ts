import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { User } from '../entities/user.entity';
import { Shipper } from '../entities/shipper.entity';
import { Load } from '../entities/load.entity';
import { Offer } from '../entities/offer.entity';
import { Rating } from '../entities/rating.entity';

@Injectable()
export class StatsService {
  constructor(
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(Shipper) private shippersRepo: Repository<Shipper>,
    @InjectRepository(Load) private loadsRepo: Repository<Load>,
    @InjectRepository(Offer) private offersRepo: Repository<Offer>,
    @InjectRepository(Rating) private ratingsRepo: Repository<Rating>,
  ) {}

  async getDriverStats(userId: string) {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user || user.role !== 'transportista') throw new ForbiddenException();

    const acceptedOffers = await this.offersRepo.find({
      where: { driver_id: userId, status: 'accepted' },
    });
    const loadIds = acceptedOffers.map((o) => o.load_id);
    const loads = loadIds.length
      ? await this.loadsRepo.find({ where: { id: In(loadIds) } })
      : [];

    const delivered = loads.filter((l) => l.status === 'delivered');
    const viajesCompletados = delivered.length;

    // Monthly revenue (last 6 months)
    const now = new Date();
    const ingresosUltimos6Meses: { mes: string; ingresos: number }[] = [];
    let totalIngresos6m = 0;
    let viajes6m = 0;

    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = date.toLocaleString('es-AR', { month: 'short', year: '2-digit' });
      const monthLoads = delivered.filter((l) => {
        const d = new Date(l.created_at);
        return d.getFullYear() === date.getFullYear() && d.getMonth() === date.getMonth();
      });
      const monthOfferMap = Object.fromEntries(acceptedOffers.map((o) => [o.load_id, o]));
      const ingresos = monthLoads.reduce((sum, l) => sum + Number(monthOfferMap[l.id]?.price ?? 0), 0);
      ingresosUltimos6Meses.push({ mes: monthKey, ingresos });
      totalIngresos6m += ingresos;
      viajes6m += monthLoads.length;
    }

    // Cargo types breakdown
    const cargoCount: Record<string, number> = {};
    for (const l of delivered) {
      const key = l.cargo_type ?? 'Otro';
      cargoCount[key] = (cargoCount[key] ?? 0) + 1;
    }
    const tiposCarga = Object.entries(cargoCount).map(([tipo, cantidad]) => ({ tipo, cantidad }));

    // Top 5 routes
    const routeCount: Record<string, number> = {};
    for (const l of delivered) {
      const key = `${l.pickup_city} → ${l.dropoff_city}`;
      routeCount[key] = (routeCount[key] ?? 0) + 1;
    }
    const rutasFrecuentes = Object.entries(routeCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([ruta, viajes]) => ({ ruta, viajes }));

    const ratingAgg = await this.ratingsRepo
      .createQueryBuilder('r')
      .select('AVG(r.score)', 'avg')
      .where('r.to_user_id = :id', { id: userId })
      .getRawOne();

    return {
      viajesCompletados,
      ingresosUltimos6Meses,
      totalIngresos6m,
      viajes6m,
      tiposCarga,
      rutasFrecuentes,
      calificacionPromedio: ratingAgg?.avg ? Number(ratingAgg.avg).toFixed(1) : null,
      memberSince: user.created_at,
    };
  }

  async getShipperStats(userId: string) {
    const shipper = await this.shippersRepo.findOne({ where: { user_id: userId } });
    if (!shipper) throw new ForbiddenException();

    const [totalCargas, enTransito] = await Promise.all([
      this.loadsRepo.count({ where: { shipper_id: shipper.id } }),
      this.loadsRepo.count({ where: { shipper_id: shipper.id, status: 'in_transit' } }),
    ]);

    const ratingAgg = await this.ratingsRepo
      .createQueryBuilder('r')
      .select('AVG(r.score)', 'avg')
      .where('r.to_user_id = :id', { id: userId })
      .getRawOne();

    const user = await this.usersRepo.findOne({ where: { id: userId } });

    return {
      totalCargas,
      enTransito,
      memberSince: user?.created_at,
      calificacionPromedio: ratingAgg?.avg ? Number(ratingAgg.avg).toFixed(1) : null,
      razonSocial: shipper.razon_social,
      cuit: shipper.cuit,
      cuil: shipper.cuil,
      address: shipper.address,
    };
  }
}
