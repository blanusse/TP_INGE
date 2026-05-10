import { Controller, Get, UseGuards, Request, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

type AuthReq = { user: { id: string; role: string; email: string } };
import { StatsService } from './stats.service';

@Controller('stats')
@UseGuards(JwtAuthGuard)
export class StatsController {
  constructor(private statsService: StatsService) {}

  @Get('camionero')
  getDriverStats(@Request() req: AuthReq) {
    return this.statsService.getDriverStats(req.user.id);
  }

  @Get('dador')
  getShipperStats(@Request() req: AuthReq) {
    return this.statsService.getShipperStats(req.user.id);
  }

  @Get('cobros')
  getDriverCobros(
    @Request() req: AuthReq,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.statsService.getDriverCobros(req.user.id, from, to);
  }

  @Get('flota')
  getFleetStats(
    @Request() req: AuthReq,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('driverId') driverId?: string,
  ) {
    return this.statsService.getFleetStats(req.user.id, from, to, driverId);
  }
}
