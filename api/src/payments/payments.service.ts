import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from '../entities/payment.entity';
import { Offer } from '../entities/offer.entity';
import { Shipper } from '../entities/shipper.entity';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment) private paymentsRepo: Repository<Payment>,
    @InjectRepository(Offer) private offersRepo: Repository<Offer>,
    @InjectRepository(Shipper) private shippersRepo: Repository<Shipper>,
  ) {}

  async createPayment(offerId: string, amount: number, mpPreferenceId: string) {
    const offer = await this.offersRepo.findOne({ where: { id: offerId } });
    if (!offer) throw new NotFoundException('Oferta no encontrada.');

    const payment = this.paymentsRepo.create({
      offer_id: offerId,
      load_id: offer.load_id,
      amount,
      mp_preference_id: mpPreferenceId,
      status: 'pending',
    });

    return this.paymentsRepo.save(payment);
  }

  async confirmPayment(offerId: string, mpPaymentId?: string) {
    const payment = await this.paymentsRepo.findOne({ where: { offer_id: offerId } });
    if (!payment) throw new NotFoundException('Pago no encontrado.');

    payment.status = 'confirmed';
    if (mpPaymentId) payment.mp_payment_id = mpPaymentId;

    return this.paymentsRepo.save(payment);
  }

  async getMyPayments(userId: string) {
    const shipper = await this.shippersRepo.findOne({ where: { user_id: userId } });
    if (!shipper) throw new ForbiddenException();

    const payments = await this.paymentsRepo.find({
      where: { load: { shipper_id: shipper.id } },
      relations: ['load', 'offer', 'offer.driver'],
      order: { created_at: 'DESC' },
    });

    return payments.map((p) => ({
      id:               p.id,
      offer_id:         p.offer_id,
      amount:           Number(p.amount),
      status:           p.status,
      mp_preference_id: p.mp_preference_id,
      mp_payment_id:    p.mp_payment_id,
      created_at:       p.created_at,
      cargo_type:       p.load?.cargo_type,
      pickup_city:      p.load?.pickup_city,
      dropoff_city:     p.load?.dropoff_city,
      driver_name:      p.offer?.driver?.name ?? null,
    }));
  }
}
