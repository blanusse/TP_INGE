import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Request,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DevPublicJwtGuard } from '../auth/dev-public-jwt.guard';
import { Offer } from '../entities/offer.entity';
import { Load } from '../entities/load.entity';
import { Shipper } from '../entities/shipper.entity';
import { LocationService } from './location.service';
import { TripLocation } from './trip-location.entity';

type AuthReq = { user: { id: string; role: string } | null };

/**
 * Carga demo para la simulación de mapas (/dev/mapa). Su ubicación es de prueba
 * y se puede leer públicamente sin ser participante, para que la demo funcione
 * en producción con cualquier usuario logueado.
 */
const DEMO_LOAD_ID = 'dd89af02-cbe8-4cc9-ba98-5b3e614553e1';

@Controller('location')
export class LocationController {
  constructor(
    private readonly locationService: LocationService,
    @InjectRepository(TripLocation)
    private readonly repo: Repository<TripLocation>,
    @InjectRepository(Offer)
    private readonly offersRepo: Repository<Offer>,
    @InjectRepository(Load)
    private readonly loadsRepo: Repository<Load>,
    @InjectRepository(Shipper)
    private readonly shippersRepo: Repository<Shipper>,
  ) {}

  /** Driver: emite su posición. Solo el driver con oferta aceptada en esta carga. */
  @Post(':loadId')
  @UseGuards(JwtAuthGuard)
  async update(
    @Request() req: AuthReq,
    @Param('loadId') loadId: string,
    @Body() body: { lat: number; lng: number },
  ) {
    if (
      typeof body?.lat !== 'number' ||
      typeof body?.lng !== 'number' ||
      body.lat < -90 ||
      body.lat > 90 ||
      body.lng < -180 ||
      body.lng > 180
    ) {
      throw new ForbiddenException('Coordenadas inválidas.');
    }
    await this.assertDriverForLoad(req.user!.id, loadId);
    await this.repo.upsert({ load_id: loadId, lat: body.lat, lng: body.lng }, [
      'load_id',
    ]);
    this.locationService.emit(loadId, body.lat, body.lng);
    return { ok: true };
  }

  /** Última posición (driver de la carga o dador dueño de la carga) */
  @Get(':loadId/last')
  @UseGuards(DevPublicJwtGuard)
  async getLast(@Request() req: AuthReq, @Param('loadId') loadId: string) {
    if (req.user && loadId !== DEMO_LOAD_ID)
      await this.assertParticipantForLoad(req.user.id, loadId);
    return (await this.repo.findOne({ where: { load_id: loadId } })) ?? null;
  }

  /** Stream SSE en vivo */
  @Sse(':loadId/stream')
  @UseGuards(DevPublicJwtGuard)
  async stream(@Request() req: AuthReq, @Param('loadId') loadId: string) {
    if (req.user && loadId !== DEMO_LOAD_ID)
      await this.assertParticipantForLoad(req.user.id, loadId);
    return this.locationService.stream(loadId);
  }

  /** Simula un viaje. Requiere estar autenticado (habilitado también en prod para demo). */
  @Post(':loadId/simulate')
  @UseGuards(JwtAuthGuard)
  simulate(
    @Param('loadId') loadId: string,
    @Body()
    body: {
      originLat: number;
      originLng: number;
      destLat: number;
      destLng: number;
      steps?: number;
      delayMs?: number;
      useOsrm?: boolean;
    },
  ) {
    const {
      originLat,
      originLng,
      destLat,
      destLng,
      steps = 50,
      delayMs = 2000,
      useOsrm = false,
    } = body ?? {};

    const coordsOk =
      [originLat, originLng, destLat, destLng].every(
        (v) => typeof v === 'number' && Number.isFinite(v),
      ) &&
      originLat >= -90 &&
      originLat <= 90 &&
      destLat >= -90 &&
      destLat <= 90 &&
      originLng >= -180 &&
      originLng <= 180 &&
      destLng >= -180 &&
      destLng <= 180;
    if (!coordsOk) throw new ForbiddenException('Coordenadas inválidas.');

    const safeSteps = Math.max(1, Math.min(500, Math.floor(steps)));
    const safeDelay = Math.max(50, Math.min(60_000, Math.floor(delayMs)));

    // Interpolación lineal: fallback confiable que no depende de servicios externos.
    const linearWaypoints = (): Array<[number, number]> =>
      Array.from({ length: safeSteps + 1 }, (_, i) => {
        const t = i / safeSteps;
        return [
          originLat + (destLat - originLat) * t,
          originLng + (destLng - originLng) * t,
        ] as [number, number];
      });

    void (async () => {
      let waypoints: Array<[number, number]>;
      if (useOsrm) {
        try {
          const url =
            `https://router.project-osrm.org/route/v1/driving/` +
            `${originLng},${originLat};${destLng},${destLat}` +
            `?overview=full&geometries=geojson`;
          const res = await fetch(url);
          if (!res.ok) throw new Error(`OSRM respondió ${res.status}`);
          const data = (await res.json()) as {
            routes?: Array<{
              geometry: { coordinates: Array<[number, number]> };
            }>;
          };
          const coords = data.routes?.[0]?.geometry?.coordinates;
          if (!coords?.length) throw new Error('OSRM sin ruta');
          waypoints = coords.map(([lng, lat]) => [lat, lng]);
        } catch (err) {
          // Si OSRM no responde (p. ej. no alcanzable desde el server),
          // caemos a la ruta lineal para que la simulación funcione igual.
          console.warn(
            '[simulate] OSRM falló, uso ruta lineal:',
            err instanceof Error ? err.message : err,
          );
          waypoints = linearWaypoints();
        }
      } else {
        waypoints = linearWaypoints();
      }

      for (const [lat, lng] of waypoints) {
        await this.repo.upsert({ load_id: loadId, lat, lng }, ['load_id']);
        this.locationService.emit(loadId, lat, lng);
        await new Promise((r) => setTimeout(r, safeDelay));
      }
    })();

    return { ok: true, message: 'Simulation started' };
  }

  /** Asegura que `userId` es el driver de la oferta aceptada en la carga */
  private async assertDriverForLoad(userId: string, loadId: string) {
    const offer = await this.offersRepo.findOne({
      where: { load_id: loadId, driver_id: userId, status: 'accepted' },
    });
    if (!offer) {
      throw new ForbiddenException(
        'Solo el transportista asignado puede emitir posición.',
      );
    }
  }

  /** Asegura que el caller participa de la carga: driver aceptado o dador dueño */
  private async assertParticipantForLoad(userId: string, loadId: string) {
    const load = await this.loadsRepo.findOne({ where: { id: loadId } });
    if (!load) throw new NotFoundException('Carga no encontrada.');

    const driverOffer = await this.offersRepo.findOne({
      where: { load_id: loadId, driver_id: userId, status: 'accepted' },
    });
    if (driverOffer) return;

    const shipper = await this.shippersRepo.findOne({
      where: { user_id: userId },
    });
    if (shipper && load.shipper_id === shipper.id) return;

    throw new ForbiddenException();
  }
}
