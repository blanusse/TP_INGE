import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StatsService } from './stats.service';

@Controller('stats')
@UseGuards(JwtAuthGuard)
export class StatsController {
  constructor(private statsService: StatsService) {}

  @Get('camionero')
  getDriverStats(@Request() req) {
    return this.statsService.getDriverStats(req.user.id);
  }

  @Get('dador')
  getShipperStats(@Request() req) {
    return this.statsService.getShipperStats(req.user.id);
  }
}
