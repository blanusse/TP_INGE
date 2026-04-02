import { Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Message } from '../entities/message.entity';
import { Offer } from '../entities/offer.entity';
import { Load } from '../entities/load.entity';
import { Shipper } from '../entities/shipper.entity';
import { User } from '../entities/user.entity';

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message) private messagesRepo: Repository<Message>,
    @InjectRepository(Offer) private offersRepo: Repository<Offer>,
    @InjectRepository(Load) private loadsRepo: Repository<Load>,
    @InjectRepository(Shipper) private shippersRepo: Repository<Shipper>,
    @InjectRepository(User) private usersRepo: Repository<User>,
  ) {}

  private async assertAccess(userId: string, offerId: string) {
    const offer = await this.offersRepo.findOne({ where: { id: offerId } });
    if (!offer) throw new ForbiddenException();

    const load = await this.loadsRepo.findOne({ where: { id: offer.load_id } });
    if (!load || !['matched', 'in_transit'].includes(load.status)) {
      throw new BadRequestException('La mensajería solo está disponible cuando hay una oferta aceptada.');
    }

    const shipper = await this.shippersRepo.findOne({ where: { user_id: userId } });
    const isDriver = offer.driver_id === userId;
    const isShipper = shipper && load.shipper_id === shipper.id;

    if (!isDriver && !isShipper) throw new ForbiddenException();
    return offer;
  }

  async getMessages(userId: string, offerId: string) {
    await this.assertAccess(userId, offerId);

    const messages = await this.messagesRepo.find({
      where: { offer_id: offerId },
      order: { created_at: 'ASC' },
    });

    const senderIds = [...new Set(messages.map((m) => m.sender_id))];
    const senders = senderIds.length
      ? await this.usersRepo.find({ where: { id: In(senderIds) } })
      : [];
    const senderMap = Object.fromEntries(senders.map((s) => [s.id, s.name]));

    return messages.map((m) => ({ ...m, sender_name: senderMap[m.sender_id] }));
  }

  async sendMessage(userId: string, body: { offer_id: string; content: string }) {
    await this.assertAccess(userId, body.offer_id);
    const msg = this.messagesRepo.create({
      offer_id: body.offer_id,
      sender_id: userId,
      content: body.content.trim(),
    });
    return this.messagesRepo.save(msg);
  }

  async getConversations(userId: string) {
    const shipper = await this.shippersRepo.findOne({ where: { user_id: userId } });

    let offers: Offer[];
    if (shipper) {
      const loads = await this.loadsRepo.find({
        where: [
          { shipper_id: shipper.id, status: 'matched' },
          { shipper_id: shipper.id, status: 'in_transit' },
        ],
      });
      const loadIds = loads.map((l) => l.id);
      offers = loadIds.length
        ? await this.offersRepo.find({ where: { load_id: In(loadIds), status: 'accepted' } })
        : [];
    } else {
      offers = await this.offersRepo.find({ where: { driver_id: userId, status: 'accepted' } });
    }

    if (!offers.length) return [];

    const offerIds = offers.map((o) => o.id);
    const loadIds = [...new Set(offers.map((o) => o.load_id))];
    const driverIds = [...new Set(offers.map((o) => o.driver_id))];

    const [loads, drivers, lastMessages] = await Promise.all([
      this.loadsRepo.find({ where: { id: In(loadIds) } }),
      this.usersRepo.find({ where: { id: In(driverIds) } }),
      this.messagesRepo.createQueryBuilder('m')
        .select(['m.offer_id', 'm.content', 'm.created_at'])
        .where('m.offer_id IN (:...ids)', { ids: offerIds })
        .orderBy('m.created_at', 'DESC')
        .distinctOn(['m.offer_id'])
        .getMany(),
    ]);

    const loadMap = Object.fromEntries(loads.map((l) => [l.id, l]));
    const driverMap = Object.fromEntries(drivers.map((d) => [d.id, d]));
    const lastMsgMap = Object.fromEntries(lastMessages.map((m) => [m.offer_id, m]));

    return offers.map((offer) => {
      const load = loadMap[offer.load_id];
      const driver = driverMap[offer.driver_id];
      const lastMsg = lastMsgMap[offer.id];
      return {
        offer_id: offer.id,
        load_title: load ? `${load.cargo_type} — ${load.pickup_city} → ${load.dropoff_city}` : '',
        other_party: shipper ? driver?.name : null,
        price: offer.price,
        last_message: lastMsg?.content ?? null,
        last_message_at: lastMsg?.created_at ?? null,
      };
    });
  }
}
