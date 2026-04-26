import { Controller, Get, Post, Body, Param, Sse, UseGuards } from '@nestjs/common';
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
    await this.repo.upsert({ load_id: loadId, lat: body.lat, lng: body.lng }, ['load_id']);
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
}
