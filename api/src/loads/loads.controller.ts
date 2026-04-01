import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LoadsService } from './loads.service';

@Controller('loads')
export class LoadsController {
  constructor(private loadsService: LoadsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  getMyLoads(@Request() req) {
    return this.loadsService.getMyLoads(req.user.id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  createLoad(@Request() req, @Body() body) {
    return this.loadsService.createLoad(req.user.id, body);
  }

  @Get('available')
  getAvailableLoads(
    @Query('cargo_type') cargoType?: string,
    @Query('origin') origin?: string,
  ) {
    return this.loadsService.getAvailableLoads(cargoType, origin);
  }

  @Patch(':loadId/confirm')
  @UseGuards(JwtAuthGuard)
  confirmDelivery(@Request() req, @Param('loadId') loadId: string) {
    return this.loadsService.confirmDelivery(req.user.id, loadId);
  }
}
