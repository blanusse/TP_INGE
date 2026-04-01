import {
  Injectable, NotFoundException, ForbiddenException,
  BadRequestException, ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Offer } from '../entities/offer.entity';
import { Load } from '../entities/load.entity';
import { Truck } from '../entities/truck.entity';
import { Rating } from '../entities/rating.entity';
import { User } from '../entities/user.entity';
import { Shipper } from '../entities/shipper.entity';

@Injectable()
export class OffersService {
  constructor(
    @InjectRepository(Offer) private offersRepo: Repository<Offer>,
    @InjectRepository(Load) private loadsRepo: Repository<Load>,
    @InjectRepository(Truck) private trucksRepo: Repository<Truck>,
    @InjectRepository(Rating) private ratingsRepo: Repository<Rating>,
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(Shipper) private shippersRepo: Repository<Shipper>,
  ) {}

  async submitOffer(userId: string, body: { load_id: string; price: number; truck_id?: string; note?: string }) {
    const truckCount = await this.trucksRepo.count({ where: { owner_id: userId } });
    if (truckCount === 0) throw new BadRequestException('Debés registrar al menos un camión antes de ofertar.');

    const load = await this.loadsRepo.findOne({ where: { id: body.load_id } });
    if (!load || load.status !== 'available') throw new BadRequestException('La carga no está disponible.');

    const existing = await this.offersRepo.findOne({
      where: { load_id: body.load_id, driver_id: userId },
    });
    if (existing) throw new ConflictException('Ya tenés una oferta en esta carga.');

    const offer = this.offersRepo.create({
      load_id: body.load_id,
      driver_id: userId,
      truck_id: body.truck_id,
      price: body.price,
      note: body.note,
      status: 'pending',
    });
    return this.offersRepo.save(offer);
  }

  async getOffersForLoad(userId: string, loadId: string) {
    const shipper = await this.shippersRepo.findOne({ where: { user_id: userId } });
    if (!shipper) throw new ForbiddenException();

    const load = await this.loadsRepo.findOne({ where: { id: loadId } });
    if (!load || load.shipper_id !== shipper.id) throw new ForbiddenException();

    const offers = await this.offersRepo.find({
      where: { load_id: loadId },
      order: { created_at: 'DESC' },
    });

    const driverIds = [...new Set(offers.map((o) => o.driver_id))];
    const [drivers, ratings] = await Promise.all([
      this.usersRepo.find({ where: { id: In(driverIds) }, select: ['id', 'name', 'email', 'phone', 'role', 'created_at'] }),
      this.ratingsRepo.createQueryBuilder('r')
        .select(['r.to_user_id', 'AVG(r.score) as avg_score', 'COUNT(*) as count'])
        .where('r.to_user_id IN (:...ids)', { ids: driverIds.length ? driverIds : ['none'] })
        .groupBy('r.to_user_id')
        .getRawMany(),
    ]);

    const driverMap = Object.fromEntries(drivers.map((d) => [d.id, d]));
    const ratingMap = Object.fromEntries(ratings.map((r) => [r.r_to_user_id, r]));

    return offers.map((offer) => ({
      ...offer,
      driver: driverMap[offer.driver_id],
      avg_rating: ratingMap[offer.driver_id]?.avg_score ?? null,
    }));
  }

  async getMyOffers(userId: string) {
    const offers = await this.offersRepo.find({
      where: { driver_id: userId },
      order: { created_at: 'DESC' },
    });

    const loadIds = [...new Set(offers.map((o) => o.load_id))];
    const loads = loadIds.length
      ? await this.loadsRepo.find({ where: { id: In(loadIds) } })
      : [];
    const loadMap = Object.fromEntries(loads.map((l) => [l.id, l]));

    return offers.map((offer) => ({
      ...offer,
      load: loadMap[offer.load_id],
    }));
  }

  async updateOffer(userId: string, offerId: string, action: string, counter_price?: number) {
    const offer = await this.offersRepo.findOne({ where: { id: offerId } });
    if (!offer) throw new NotFoundException('Oferta no encontrada.');

    const load = await this.loadsRepo.findOne({ where: { id: offer.load_id } });
    if (!load) throw new NotFoundException();

    const shipper = await this.shippersRepo.findOne({ where: { user_id: userId } });
    const isShipper = shipper && load.shipper_id === shipper.id;
    const isDriver = offer.driver_id === userId;

    if (!isShipper && !isDriver) throw new ForbiddenException();

    if (isShipper) {
      if (action === 'accept') {
        if (offer.status !== 'pending' && offer.status !== 'countered') {
          throw new BadRequestException('La oferta no se puede aceptar en su estado actual.');
        }
        offer.status = 'accepted';
        load.status = 'matched';
        await this.loadsRepo.save(load);
        // Reject all other pending offers
        await this.offersRepo.createQueryBuilder()
          .update(Offer)
          .set({ status: 'rejected' })
          .where('load_id = :loadId AND id != :offerId AND status IN (:...statuses)', {
            loadId: load.id, offerId, statuses: ['pending', 'countered'],
          })
          .execute();
      } else if (action === 'reject') {
        offer.status = 'rejected';
      } else if (action === 'counter') {
        if (!counter_price) throw new BadRequestException('counter_price requerido.');
        offer.status = 'countered';
        offer.counter_price = counter_price;
      }
    }

    if (isDriver) {
      if (action === 'withdraw') {
        if (!['pending', 'countered'].includes(offer.status)) {
          throw new BadRequestException();
        }
        offer.status = 'withdrawn';
      } else if (action === 'accept_counter') {
        if (offer.status !== 'countered') throw new BadRequestException();
        offer.price = offer.counter_price;
        offer.status = 'accepted';
        load.status = 'matched';
        await this.loadsRepo.save(load);
      } else if (action === 'reject_counter') {
        if (offer.status !== 'countered') throw new BadRequestException();
        offer.status = 'rejected';
      }
    }

    return this.offersRepo.save(offer);
  }
}
