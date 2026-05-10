import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Offer } from '../entities/offer.entity';
import { Load } from '../entities/load.entity';
import { Truck } from '../entities/truck.entity';
import { Rating } from '../entities/rating.entity';
import { User } from '../entities/user.entity';
import { Shipper } from '../entities/shipper.entity';
import { TruckerDocument } from '../entities/trucker-document.entity';
import { MailService } from '../mail/mail.service';

@Injectable()
export class OffersService {
  constructor(
    @InjectRepository(Offer) private offersRepo: Repository<Offer>,
    @InjectRepository(Load) private loadsRepo: Repository<Load>,
    @InjectRepository(Truck) private trucksRepo: Repository<Truck>,
    @InjectRepository(Rating) private ratingsRepo: Repository<Rating>,
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(Shipper) private shippersRepo: Repository<Shipper>,
    @InjectRepository(TruckerDocument)
    private documentsRepo: Repository<TruckerDocument>,
    private mailService: MailService,
  ) {}

  async submitOffer(
    userId: string,
    body: {
      load_id: string;
      price: number;
      truck_id?: string;
      note?: string;
      assigned_driver_id?: string;
    },
  ) {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    const fleetOwnerId = user?.fleet_id ?? userId;

    // Si se especifica un conductor asignado, validar que el dueño de flota tiene permisos
    if (body.assigned_driver_id) {
      if (!user?.is_fleet_owner)
        throw new ForbiddenException(
          'Solo los dueños de flota pueden asignar conductores.',
        );
      const assignedDriver = await this.usersRepo.findOne({
        where: { id: body.assigned_driver_id },
      });
      if (!assignedDriver)
        throw new BadRequestException('El conductor asignado no existe.');
      if (assignedDriver.fleet_id !== userId && assignedDriver.id !== userId) {
        throw new ForbiddenException('El conductor no pertenece a tu flota.');
      }
    }

    // At least one driver (owner or fleet member) must have verified DNI
    const [verifiedSelf, verifiedFleet] = await Promise.all([
      this.usersRepo.count({ where: { id: fleetOwnerId, dni_verified: true } }),
      this.usersRepo.count({
        where: { fleet_id: fleetOwnerId, dni_verified: true },
      }),
    ]);
    if (verifiedSelf + verifiedFleet === 0) {
      throw new BadRequestException(
        'Necesitás verificar el DNI de al menos un conductor antes de ofertar.',
      );
    }

    // Check truck verification
    if (body.truck_id) {
      const truck = await this.trucksRepo.findOne({
        where: { id: body.truck_id },
      });
      if (!truck) throw new BadRequestException('Camión no encontrado.');
      if (!truck.vtv_verified || !truck.seguro_verified) {
        throw new BadRequestException(
          'El camión seleccionado debe tener VTV y seguro verificados antes de ofertar.',
        );
      }
    } else {
      const verifiedTrucks = await this.trucksRepo.count({
        where: {
          owner_id: fleetOwnerId,
          vtv_verified: true,
          seguro_verified: true,
        },
      });
      if (verifiedTrucks === 0) {
        throw new BadRequestException(
          'Necesitás verificar el VTV y seguro de al menos un camión antes de ofertar.',
        );
      }
    }

    const truckCount = await this.trucksRepo.count({
      where: { owner_id: fleetOwnerId },
    });
    if (truckCount === 0)
      throw new BadRequestException(
        'Debés registrar al menos un camión antes de ofertar.',
      );

    const load = await this.loadsRepo.findOne({ where: { id: body.load_id } });
    if (!load || load.status !== 'available')
      throw new BadRequestException('La carga no está disponible.');

    const existing = await this.offersRepo.findOne({
      where: { load_id: body.load_id, driver_id: userId },
    });
    if (existing)
      throw new ConflictException('Ya tenés una oferta en esta carga.');

    const offer = this.offersRepo.create({
      load_id: body.load_id,
      driver_id: userId,
      truck_id: body.truck_id,
      price: body.price,
      note: body.note,
      status: 'pending',
      assigned_driver_id: body.assigned_driver_id ?? undefined,
    });
    const saved = await this.offersRepo.save(offer);

    const [shipperRecord, driverUser] = await Promise.all([
      this.shippersRepo.findOne({ where: { id: load.shipper_id } }),
      this.usersRepo.findOne({ where: { id: userId } }),
    ]);
    if (shipperRecord) {
      const dadorUser = await this.usersRepo.findOne({
        where: { id: shipperRecord.user_id },
      });
      if (dadorUser) {
        this.mailService.sendNuevaOferta({
          dadorEmail: dadorUser.email,
          dadorName: dadorUser.name,
          camioneroName: driverUser?.name ?? 'Un camionero',
          pickup: load.pickup_city,
          dropoff: load.dropoff_city,
          price: body.price,
          note: body.note,
          loadId: load.id,
        });
      }
    }

    return saved;
  }

  async getOffersForLoad(userId: string, loadId: string) {
    const shipper = await this.shippersRepo.findOne({
      where: { user_id: userId },
    });
    if (!shipper) throw new ForbiddenException();

    const load = await this.loadsRepo.findOne({ where: { id: loadId } });
    if (!load || load.shipper_id !== shipper.id) throw new ForbiddenException();

    const offers = await this.offersRepo.find({
      where: { load_id: loadId },
      order: { created_at: 'DESC' },
    });

    const driverIds = [...new Set(offers.map((o) => o.driver_id))];
    const [drivers, ratings] = await Promise.all([
      this.usersRepo.find({
        where: { id: In(driverIds) },
        select: ['id', 'name', 'role', 'created_at'],
      }),
      this.ratingsRepo
        .createQueryBuilder('r')
        .select([
          'r.to_user_id',
          'AVG(r.score) as avg_score',
          'COUNT(*) as count',
        ])
        .where('r.to_user_id IN (:...ids)', {
          ids: driverIds.length ? driverIds : ['none'],
        })
        .groupBy('r.to_user_id')
        .getRawMany(),
    ]);

    const driverMap = Object.fromEntries(drivers.map((d) => [d.id, d]));
    const ratingMap = Object.fromEntries(
      (
        ratings as { r_to_user_id: string; avg_score: string; count: string }[]
      ).map((r) => [r.r_to_user_id, r]),
    );

    return offers.map((offer) => ({
      ...offer,
      driver: driverMap[offer.driver_id],
      avg_rating: ratingMap[offer.driver_id]?.avg_score ?? null,
      rating_count: ratingMap[offer.driver_id]?.count ?? 0,
    }));
  }

  async getMyOffers(userId: string) {
    const offers = await this.offersRepo.find({
      where: [{ driver_id: userId }, { assigned_driver_id: userId }],
      order: { created_at: 'DESC' },
    });

    const loadIds = [...new Set(offers.map((o) => o.load_id))];
    const loads = loadIds.length
      ? await this.loadsRepo.find({
          where: { id: In(loadIds) },
          relations: ['shipper'],
        })
      : [];
    const loadMap = Object.fromEntries(loads.map((l) => [l.id, l]));

    return offers.map((offer) => ({
      ...offer,
      load: loadMap[offer.load_id],
    }));
  }

  async getOfferById(userId: string, offerId: string) {
    const offer = await this.offersRepo.findOne({ where: { id: offerId } });
    if (!offer) throw new NotFoundException('Oferta no encontrada.');

    const load = await this.loadsRepo.findOne({ where: { id: offer.load_id } });
    const shipper = await this.shippersRepo.findOne({
      where: { user_id: userId },
    });
    if (!shipper || load?.shipper_id !== shipper.id)
      throw new ForbiddenException();

    return offer;
  }

  async updateOffer(
    userId: string,
    offerId: string,
    action: string,
    counter_price?: number,
  ) {
    const offer = await this.offersRepo.findOne({ where: { id: offerId } });
    if (!offer) throw new NotFoundException('Oferta no encontrada.');

    const load = await this.loadsRepo.findOne({ where: { id: offer.load_id } });
    if (!load) throw new NotFoundException();

    const shipper = await this.shippersRepo.findOne({
      where: { user_id: userId },
    });
    const isShipper = shipper && load.shipper_id === shipper.id;
    const isDriver = offer.driver_id === userId;

    if (!isShipper && !isDriver) throw new ForbiddenException();

    const loadShipper = isDriver
      ? await this.shippersRepo.findOne({ where: { id: load.shipper_id } })
      : shipper;

    let bulkRejectedDriverIds: string[] = [];

    if (isShipper) {
      if (action === 'accept') {
        if (offer.status !== 'pending' && offer.status !== 'countered') {
          throw new BadRequestException(
            'La oferta no se puede aceptar en su estado actual.',
          );
        }
        offer.status = 'accepted';
        load.status = 'matched';
        await this.loadsRepo.save(load);
        // Collect drivers that will be bulk-rejected for later notification
        const toReject = await this.offersRepo.find({
          where: { load_id: load.id, status: In(['pending', 'countered']) },
          select: ['id', 'driver_id'],
        });
        bulkRejectedDriverIds = toReject
          .filter((o) => o.id !== offerId)
          .map((o) => o.driver_id);
        // Reject all other pending offers
        await this.offersRepo
          .createQueryBuilder()
          .update(Offer)
          .set({ status: 'rejected' })
          .where(
            'load_id = :loadId AND id != :offerId AND status IN (:...statuses)',
            {
              loadId: load.id,
              offerId,
              statuses: ['pending', 'countered'],
            },
          )
          .execute();
      } else if (action === 'reject') {
        offer.status = 'rejected';
      } else if (action === 'counter') {
        if (!counter_price)
          throw new BadRequestException('counter_price requerido.');
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

    const saved = await this.offersRepo.save(offer);

    if (isShipper && ['accept', 'reject', 'counter'].includes(action)) {
      const driverUser = await this.usersRepo.findOne({
        where: { id: offer.driver_id },
      });
      if (driverUser) {
        const baseOpts = {
          camioneroEmail: driverUser.email,
          camioneroName: driverUser.name,
          pickup: load.pickup_city,
          dropoff: load.dropoff_city,
          loadId: load.id,
        };
        if (action === 'accept') {
          this.mailService.sendOfertaAceptada({
            ...baseOpts,
            price: Number(saved.price),
          });
          if (bulkRejectedDriverIds.length > 0) {
            const rejectedUsers = await this.usersRepo.find({
              where: { id: In(bulkRejectedDriverIds) },
            });
            for (const u of rejectedUsers) {
              this.mailService.sendOfertaRechazada({
                ...baseOpts,
                camioneroEmail: u.email,
                camioneroName: u.name,
              });
            }
          }
        } else if (action === 'reject') {
          this.mailService.sendOfertaRechazada(baseOpts);
        } else if (action === 'counter') {
          this.mailService.sendContraofertaRecibida({
            ...baseOpts,
            counterPrice: Number(saved.counter_price),
          });
        }
      }
    }

    if (
      isDriver &&
      ['withdraw', 'accept_counter', 'reject_counter'].includes(action) &&
      loadShipper
    ) {
      const [dadorUser, driverUser] = await Promise.all([
        this.usersRepo.findOne({ where: { id: loadShipper.user_id } }),
        this.usersRepo.findOne({ where: { id: userId } }),
      ]);
      if (dadorUser) {
        const baseOpts = {
          dadorEmail: dadorUser.email,
          dadorName: dadorUser.name,
          camioneroName: driverUser?.name ?? 'Un camionero',
          pickup: load.pickup_city,
          dropoff: load.dropoff_city,
          loadId: load.id,
        };
        if (action === 'accept_counter') {
          this.mailService.sendContraofertaAceptada({
            ...baseOpts,
            price: Number(saved.price),
          });
        } else if (action === 'reject_counter') {
          this.mailService.sendContraofertaRechazada(baseOpts);
        } else if (action === 'withdraw') {
          this.mailService.sendOfertaRetirada(baseOpts);
        }
      }
    }

    return saved;
  }

  async getFleetOffers(userId: string) {
    // Obtener todos los conductores de la flota (fleet_id = userId)
    const fleetDrivers = await this.usersRepo.find({
      where: { fleet_id: userId },
      select: ['id', 'name'],
    });
    const fleetDriverIds = fleetDrivers.map((d) => d.id);
    const allIds = [userId, ...fleetDriverIds];

    // Traer todas las ofertas donde driver_id o assigned_driver_id pertenecen a la flota
    const offers = await this.offersRepo.find({
      where: [{ driver_id: In(allIds) }, { assigned_driver_id: In(allIds) }],
      order: { created_at: 'DESC' },
    });

    const loadIds = [...new Set(offers.map((o) => o.load_id))];
    const loads = loadIds.length
      ? await this.loadsRepo.find({ where: { id: In(loadIds) } })
      : [];
    const loadMap = Object.fromEntries(loads.map((l) => [l.id, l]));

    // Mapa de conductores de la flota (para nombre)
    const ownerUser = await this.usersRepo.findOne({
      where: { id: userId },
      select: ['id', 'name'],
    });
    const driverMap: Record<string, string> = Object.fromEntries(
      fleetDrivers.map((d) => [d.id, d.name]),
    );
    if (ownerUser) driverMap[ownerUser.id] = ownerUser.name;

    return offers.map((offer) => {
      // El conductor "efectivo" es el asignado si existe, sino el driver_id
      const effectiveDriverId = offer.assigned_driver_id ?? offer.driver_id;
      return {
        ...offer,
        load: loadMap[offer.load_id],
        driverName: driverMap[effectiveDriverId] ?? 'Conductor',
        effectiveDriverId,
      };
    });
  }
}
