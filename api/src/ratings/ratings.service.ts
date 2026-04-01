import { Injectable, ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Rating } from '../entities/rating.entity';
import { Offer } from '../entities/offer.entity';
import { Load } from '../entities/load.entity';
import { Shipper } from '../entities/shipper.entity';

@Injectable()
export class RatingsService {
  constructor(
    @InjectRepository(Rating) private ratingsRepo: Repository<Rating>,
    @InjectRepository(Offer) private offersRepo: Repository<Offer>,
    @InjectRepository(Load) private loadsRepo: Repository<Load>,
    @InjectRepository(Shipper) private shippersRepo: Repository<Shipper>,
  ) {}

  async submitRating(userId: string, body: { offer_id: string; score: number }) {
    if (body.score < 1 || body.score > 5) {
      throw new BadRequestException('El score debe ser entre 1 y 5.');
    }

    const offer = await this.offersRepo.findOne({ where: { id: body.offer_id } });
    if (!offer) throw new ForbiddenException();

    const load = await this.loadsRepo.findOne({ where: { id: offer.load_id } });
    if (!load || load.status !== 'delivered') {
      throw new BadRequestException('Solo se puede calificar después de que el viaje fue entregado.');
    }

    const shipper = await this.shippersRepo.findOne({ where: { user_id: userId } });
    const isDriver = offer.driver_id === userId;
    const isShipper = shipper && load.shipper_id === shipper.id;

    if (!isDriver && !isShipper) throw new ForbiddenException();

    // Driver rates shipper (user of shipper), shipper rates driver
    let toUserId: string;
    if (isDriver) {
      const shipperRecord = await this.shippersRepo.findOne({ where: { id: load.shipper_id } });
      if (!shipperRecord) throw new ForbiddenException();
      toUserId = shipperRecord.user_id;
    } else {
      toUserId = offer.driver_id;
    }

    const existing = await this.ratingsRepo.findOne({
      where: { offer_id: body.offer_id, from_user_id: userId },
    });
    if (existing) throw new ConflictException('Ya calificaste este viaje.');

    const rating = this.ratingsRepo.create({
      load_id: load.id,
      offer_id: body.offer_id,
      from_user_id: userId,
      to_user_id: toUserId,
      score: body.score,
    });
    return this.ratingsRepo.save(rating);
  }
}
