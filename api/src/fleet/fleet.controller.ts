import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

type AuthReq = {
  user: {
    id: string;
    role: string;
    email: string;
    is_fleet_owner?: boolean;
    fleet_id?: string;
  };
};
import { FleetService } from './fleet.service';

@Controller('fleet')
export class FleetController {
  constructor(private fleetService: FleetService) {}

  @Get('trucks')
  @UseGuards(JwtAuthGuard)
  getMyTrucks(@Request() req: AuthReq) {
    return this.fleetService.getMyTrucks(req.user.id);
  }

  @Post('trucks')
  @UseGuards(JwtAuthGuard)
  addTruck(@Request() req: AuthReq, @Body() body) {
    return this.fleetService.addTruck(req.user.id, body);
  }

  @Patch('trucks/:id')
  @UseGuards(JwtAuthGuard)
  updateTruck(@Request() req: AuthReq, @Param('id') id: string, @Body() body) {
    return this.fleetService.updateTruck(req.user.id, id, body);
  }

  @Get('drivers')
  @UseGuards(JwtAuthGuard)
  getFleetDrivers(@Request() req: AuthReq) {
    return this.fleetService.getFleetDrivers(req.user.id);
  }

  @Post('drivers')
  @UseGuards(JwtAuthGuard)
  addFleetDriver(@Request() req: AuthReq, @Body() body) {
    return this.fleetService.addFleetDriver(req.user.id, body);
  }

  @Patch('drivers/:id')
  @UseGuards(JwtAuthGuard)
  updateDriver(@Request() req: AuthReq, @Param('id') id: string, @Body() body) {
    return this.fleetService.updateDriver(req.user.id, id, body);
  }

  @Delete('trucks/:id')
  @UseGuards(JwtAuthGuard)
  deleteTruck(@Request() req: AuthReq, @Param('id') id: string) {
    return this.fleetService.deleteTruck(req.user.id, id);
  }

  @Delete('drivers/:id')
  @UseGuards(JwtAuthGuard)
  deleteDriver(@Request() req: AuthReq, @Param('id') id: string) {
    return this.fleetService.deleteDriver(req.user.id, id);
  }

  // ── Invitaciones ──────────────────────────────────────────────
  @Post('invitations')
  @UseGuards(JwtAuthGuard)
  inviteDriver(@Request() req: AuthReq, @Body() body: { email: string }) {
    return this.fleetService.inviteDriver(req.user.id, body.email);
  }

  @Get('invitations/:token')
  getInvitation(@Param('token') token: string) {
    return this.fleetService.getInvitation(token);
  }

  @Post('invitations/:token/accept')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  acceptInvitation(@Param('token') token: string, @Request() req: AuthReq) {
    return this.fleetService.acceptInvitation(token, req.user.id);
  }

  @Get('settings')
  @UseGuards(JwtAuthGuard)
  getSettings(@Request() req: AuthReq) {
    return this.fleetService.getOwnerSettings(req.user.id);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  getMyProfile(@Request() req: AuthReq) {
    return this.fleetService.getMyProfile(req.user.id);
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  updateMyProfile(
    @Request() req: AuthReq,
    @Body() body: { name?: string; phone?: string | null },
  ) {
    return this.fleetService.updateMyProfile(req.user.id, body);
  }

  @Patch('settings')
  @UseGuards(JwtAuthGuard)
  updateSettings(
    @Request() req: AuthReq,
    @Body() body: { show_as_fleet_driver?: boolean },
  ) {
    return this.fleetService.updateOwnerSettings(req.user.id, body);
  }
}
