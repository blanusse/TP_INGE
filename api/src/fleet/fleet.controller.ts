import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
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

  @Patch('trucks/:id')
  updateTruck(@Request() req, @Param('id') id: string, @Body() body) {
    return this.fleetService.updateTruck(req.user.id, id, body);
  }

  @Get('drivers')
  getFleetDrivers(@Request() req) {
    return this.fleetService.getFleetDrivers(req.user.id);
  }

  @Post('drivers')
  addFleetDriver(@Request() req, @Body() body) {
    return this.fleetService.addFleetDriver(req.user.id, body);
  }

  @Patch('drivers/:id')
  updateDriver(@Request() req, @Param('id') id: string, @Body() body) {
    return this.fleetService.updateDriver(req.user.id, id, body);
  }

  @Delete('trucks/:id')
  deleteTruck(@Request() req, @Param('id') id: string) {
    return this.fleetService.deleteTruck(req.user.id, id);
  }

  @Delete('drivers/:id')
  deleteDriver(@Request() req, @Param('id') id: string) {
    return this.fleetService.deleteDriver(req.user.id, id);
  }
}
