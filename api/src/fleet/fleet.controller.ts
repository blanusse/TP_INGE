import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FleetService } from './fleet.service';

@Controller('fleet')
@UseGuards(JwtAuthGuard)
export class FleetController {
  constructor(private fleetService: FleetService) {}

  @Get('trucks')
  getMyTrucks(@Request() req) {
    return this.fleetService.getMyTrucks(req.user.id);
  }

  @Post('trucks')
  addTruck(@Request() req, @Body() body) {
    return this.fleetService.addTruck(req.user.id, body);
  }

  @Get('drivers')
  getFleetDrivers(@Request() req) {
    return this.fleetService.getFleetDrivers(req.user.id);
  }

  @Post('drivers')
  addFleetDriver(@Request() req, @Body() body) {
    return this.fleetService.addFleetDriver(req.user.id, body);
  }
}
