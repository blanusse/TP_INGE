import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request, HttpCode } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FleetService } from './fleet.service';

@Controller('fleet')
export class FleetController {
  constructor(private fleetService: FleetService) {}

  @Get('trucks')
  @UseGuards(JwtAuthGuard)
  getMyTrucks(@Request() req) {
    return this.fleetService.getMyTrucks(req.user.id);
  }

  @Post('trucks')
  @UseGuards(JwtAuthGuard)
  addTruck(@Request() req, @Body() body) {
    return this.fleetService.addTruck(req.user.id, body);
  }

  @Patch('trucks/:id')
  @UseGuards(JwtAuthGuard)
  updateTruck(@Request() req, @Param('id') id: string, @Body() body) {
    return this.fleetService.updateTruck(req.user.id, id, body);
  }

  @Get('drivers')
  @UseGuards(JwtAuthGuard)
  getFleetDrivers(@Request() req) {
    return this.fleetService.getFleetDrivers(req.user.id);
  }

  @Post('drivers')
  @UseGuards(JwtAuthGuard)
  addFleetDriver(@Request() req, @Body() body) {
    return this.fleetService.addFleetDriver(req.user.id, body);
  }

  @Patch('drivers/:id')
  @UseGuards(JwtAuthGuard)
  updateDriver(@Request() req, @Param('id') id: string, @Body() body) {
    return this.fleetService.updateDriver(req.user.id, id, body);
  }

  @Delete('trucks/:id')
  @UseGuards(JwtAuthGuard)
  deleteTruck(@Request() req, @Param('id') id: string) {
    return this.fleetService.deleteTruck(req.user.id, id);
  }

  @Delete('drivers/:id')
  @UseGuards(JwtAuthGuard)
  deleteDriver(@Request() req, @Param('id') id: string) {
    return this.fleetService.deleteDriver(req.user.id, id);
  }

  // ── Invitaciones ──────────────────────────────────────────────
  @Post('invitations')
  @UseGuards(JwtAuthGuard)
  inviteDriver(@Request() req, @Body() body: { email: string }) {
    return this.fleetService.inviteDriver(req.user.id, body.email);
  }

  @Get('invitations/:token')
  getInvitation(@Param('token') token: string) {
    return this.fleetService.getInvitation(token);
  }

  @Post('invitations/:token/accept')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  acceptInvitation(@Param('token') token: string, @Request() req) {
    return this.fleetService.acceptInvitation(token, req.user.id);
  }

  @Get('settings')
  @UseGuards(JwtAuthGuard)
  getSettings(@Request() req) {
    return this.fleetService.getOwnerSettings(req.user.id);
  }

  @Patch('settings')
  @UseGuards(JwtAuthGuard)
  updateSettings(@Request() req, @Body() body: { show_as_fleet_driver?: boolean }) {
    return this.fleetService.updateOwnerSettings(req.user.id, body);
  }
}
