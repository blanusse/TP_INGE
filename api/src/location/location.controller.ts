import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LocationService } from './location.service';
import { TripLocation } from './trip-location.entity';

@Controller('location')
export class LocationController {
  constructor(
    private readonly locationService: LocationService,
    @InjectRepository(TripLocation)
    private readonly repo: Repository<TripLocation>,
  ) {}

  /** El camionero envía su posición actual */
  @Post(':loadId')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('loadId') loadId: string,
    @Body() body: { lat: number; lng: number },
  ) {
    await this.repo.upsert({ load_id: loadId, lat: body.lat, lng: body.lng }, [
      'load_id',
    ]);
    this.locationService.emit(loadId, body.lat, body.lng);
    return { ok: true };
  }

  /** Última posición conocida (para carga inicial del mapa) */
  @Get(':loadId/last')
  async getLast(@Param('loadId') loadId: string) {
    return (await this.repo.findOne({ where: { load_id: loadId } })) ?? null;
  }

  /** Stream SSE: el dador recibe actualizaciones en tiempo real */
  @Sse(':loadId/stream')
  stream(@Param('loadId') loadId: string) {
    return this.locationService.stream(loadId);
  }

  /** Solo para desarrollo: simula un viaje con ruta real via OSRM o interpolación lineal */
  @Post(':loadId/simulate')
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
    } = body;

    (async () => {
      let waypoints: Array<[number, number]>;

      if (useOsrm) {
        const url =
          `http://router.project-osrm.org/route/v1/driving/` +
          `${originLng},${originLat};${destLng},${destLat}` +
          `?overview=full&geometries=geojson`;
        const res = await fetch(url);
        const data = (await res.json()) as {
          routes: Array<{ geometry: { coordinates: Array<[number, number]> } }>;
        };
        // OSRM devuelve [lng, lat]; lo invertimos a [lat, lng]
        waypoints = data.routes[0].geometry.coordinates.map(
          ([lng, lat]) => [lat, lng],
        );
      } else {
        waypoints = Array.from({ length: steps + 1 }, (_, i) => {
          const t = i / steps;
          return [
            originLat + (destLat - originLat) * t,
            originLng + (destLng - originLng) * t,
          ];
        });
      }

      for (const [lat, lng] of waypoints) {
        await this.repo.upsert({ load_id: loadId, lat, lng }, ['load_id']);
        this.locationService.emit(loadId, lat, lng);
        await new Promise((r) => setTimeout(r, delayMs));
      }
    })();

    return { ok: true, message: 'Simulation started' };
  }
}
