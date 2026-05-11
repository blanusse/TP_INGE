import {
  Injectable,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Not } from 'typeorm';
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
      throw new BadRequestException(
        'La mensajería solo está disponible cuando hay una oferta aceptada.',
      );
    }

    const shipper = await this.shippersRepo.findOne({
      where: { user_id: userId },
    });
    const isDriver = offer.driver_id === userId;
    const isShipper = shipper && load.shipper_id === shipper.id;

    if (!isDriver && !isShipper) throw new ForbiddenException();
    return offer;
  }

  /** Devuelve los offer_ids de conversaciones activas del usuario */
  private async getAccessibleOfferIds(userId: string): Promise<string[]> {
    const shipper = await this.shippersRepo.findOne({ where: { user_id: userId } });

    if (shipper) {
      const loads = await this.loadsRepo.find({
        where: [
          { shipper_id: shipper.id, status: 'matched' },
          { shipper_id: shipper.id, status: 'in_transit' },
        ],
      });
      if (!loads.length) return [];
      const offers = await this.offersRepo.find({
        where: { load_id: In(loads.map((l) => l.id)), status: 'accepted' },
        select: ['id'],
      });
      return offers.map((o) => o.id);
    } else {
      const offers = await this.offersRepo.find({
        where: { driver_id: userId, status: 'accepted' },
        select: ['id'],
      });
      return offers.map((o) => o.id);
    }
  }

  async getMessages(userId: string, offerId: string) {
    await this.assertAccess(userId, offerId);

    const messages = await this.messagesRepo.find({
      where: { offer_id: offerId },
      order: { created_at: 'ASC' },
    });

    // Marcar como leídos los mensajes del otro (no los propios)
    await this.messagesRepo.update(
      { offer_id: offerId, sender_id: Not(userId), is_read: false },
      { is_read: true },
    );

    const senderIds = [...new Set(messages.map((m) => m.sender_id))];
    const senders = senderIds.length
      ? await this.usersRepo.find({
          where: { id: In(senderIds) },
          select: ['id', 'name'],
        })
      : [];
    const senderMap = Object.fromEntries(senders.map((s) => [s.id, s.name]));

    return messages.map((m) => ({ ...m, sender_name: senderMap[m.sender_id] }));
  }

  async sendMessage(
    userId: string,
    body: { offer_id: string; content: string },
    gateway?: import('./messages.gateway').MessagesGateway,
  ) {
    await this.assertAccess(userId, body.offer_id);
    const msg = this.messagesRepo.create({
      offer_id: body.offer_id,
      sender_id: userId,
      content: body.content.trim(),
      is_read: false,
    });
    const saved = await this.messagesRepo.save(msg);

    const sender = await this.usersRepo.findOne({
      where: { id: userId },
      select: ['id', 'name'],
    });
    const payload = { ...saved, sender_name: sender?.name ?? undefined };
    gateway?.emitNewMessage(body.offer_id, payload);

    return saved;
  }

  async getUnreadCount(userId: string): Promise<{ count: number }> {
    const offerIds = await this.getAccessibleOfferIds(userId);
    if (!offerIds.length) return { count: 0 };

    const count = await this.messagesRepo.count({
      where: {
        offer_id: In(offerIds),
        sender_id: Not(userId),
        is_read: false,
      },
    });
    return { count };
  }

  async getConversations(userId: string) {
    const shipper = await this.shippersRepo.findOne({
      where: { user_id: userId },
    });

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
        ? await this.offersRepo.find({
            where: { load_id: In(loadIds), status: 'accepted' },
          })
        : [];
    } else {
      offers = await this.offersRepo.find({
        where: { driver_id: userId, status: 'accepted' },
      });
    }

    if (!offers.length) return [];

    const offerIds = offers.map((o) => o.id);
    const loadIds = [...new Set(offers.map((o) => o.load_id))];
    const driverIds = [...new Set(offers.map((o) => o.driver_id))];

    const [loads, drivers, lastMessages, unreadRaw] = await Promise.all([
      this.loadsRepo.find({ where: { id: In(loadIds) } }),
      this.usersRepo.find({
        where: { id: In(driverIds) },
        select: ['id', 'name'],
      }),
      this.messagesRepo
        .createQueryBuilder('m')
        .select(['m.offer_id', 'm.content', 'm.created_at'])
        .where('m.offer_id IN (:...ids)', { ids: offerIds })
        .orderBy('m.offer_id')
        .addOrderBy('m.created_at', 'DESC')
        .distinctOn(['m.offer_id'])
        .getMany(),
      this.messagesRepo
        .createQueryBuilder('m')
        .select('m.offer_id', 'offer_id')
        .addSelect('COUNT(*)', 'count')
        .where('m.offer_id IN (:...ids)', { ids: offerIds })
        .andWhere('m.sender_id != :userId', { userId })
        .andWhere('m.is_read = false')
        .groupBy('m.offer_id')
        .getRawMany<{ offer_id: string; count: string }>(),
    ]);

    const loadMap = Object.fromEntries(loads.map((l) => [l.id, l]));
    const driverMap = Object.fromEntries(drivers.map((d) => [d.id, d]));
    const lastMsgMap = Object.fromEntries(
      lastMessages.map((m) => [m.offer_id, m]),
    );
    const unreadMap = Object.fromEntries(
      unreadRaw.map((r) => [r.offer_id, parseInt(r.count)]),
    );

    // Para transportistas: buscar el nombre del dador de cada carga
    let shipperNameMap: Record<string, string> = {};
    if (!shipper) {
      const allShipperIds = [...new Set(loads.map((l) => l.shipper_id))];
      if (allShipperIds.length) {
        const shippersData = await this.shippersRepo.find({
          where: { id: In(allShipperIds) },
          select: ['id', 'user_id'],
        });
        const shipperUserIds = shippersData.map((s) => s.user_id);
        if (shipperUserIds.length) {
          const shipperUsers = await this.usersRepo.find({
            where: { id: In(shipperUserIds) },
            select: ['id', 'name'],
          });
          const userNameMap = Object.fromEntries(
            shipperUsers.map((u) => [u.id, u.name]),
          );
          shipperNameMap = Object.fromEntries(
            shippersData.map((s) => [s.id, userNameMap[s.user_id] ?? '']),
          );
        }
      }
    }

    return offers.map((offer) => {
      const load = loadMap[offer.load_id];
      const driver = driverMap[offer.driver_id];
      const lastMsg = lastMsgMap[offer.id];
      return {
        offer_id: offer.id,
        load_title: load
          ? `${load.cargo_type} — ${load.pickup_city} → ${load.dropoff_city}`
          : '',
        pickup_city: load?.pickup_city ?? '',
        dropoff_city: load?.dropoff_city ?? '',
        other_party: shipper
          ? (driver?.name ?? null)
          : (shipperNameMap[load?.shipper_id ?? ''] ?? null),
        price: offer.price,
        last_message: lastMsg?.content ?? null,
        last_message_at: lastMsg?.created_at ?? null,
        unread_count: unreadMap[offer.id] ?? 0,
      };
    });
  }
}
