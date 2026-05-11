import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';

type AuthReq = {
  user: {
    id: string;
    role: string;
    email: string;
    is_fleet_owner?: boolean;
    fleet_id?: string;
  };
};
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LoadsService } from './loads.service';

@Controller('loads')
export class LoadsController {
  constructor(private loadsService: LoadsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  getMyLoads(@Request() req: AuthReq) {
    return this.loadsService.getMyLoads(req.user.id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  createLoad(@Request() req: AuthReq, @Body() body) {
    return this.loadsService.createLoad(req.user.id, body);
  }

  @Get('available')
  @UseGuards(JwtAuthGuard)
  getAvailableLoads(
    @Query('cargo_type') cargoType?: string,
    @Query('origin') origin?: string,
  ) {
    return this.loadsService.getAvailableLoads(cargoType, origin);
  }

  @Patch('internal/by-offer/:offerId')
  markInTransitByOffer(
    @Param('offerId') offerId: string,
    @Headers('x-internal-secret') secret: string,
  ) {
    if (secret !== process.env.INTERNAL_SECRET)
      throw new UnauthorizedException();
    return this.loadsService.markInTransitByOffer(offerId);
  }

  @Patch(':loadId')
  @UseGuards(JwtAuthGuard)
  updateLoad(
    @Request() req: AuthReq,
    @Param('loadId') loadId: string,
    @Body() body,
  ) {
    return this.loadsService.updateLoad(req.user.id, loadId, body);
  }

  @Delete(':loadId')
  @UseGuards(JwtAuthGuard)
  deleteLoad(@Request() req: AuthReq, @Param('loadId') loadId: string) {
    return this.loadsService.deleteLoad(req.user.id, loadId);
  }

  @Patch(':loadId/in-transit')
  @UseGuards(JwtAuthGuard)
  markInTransit(@Request() req: AuthReq, @Param('loadId') loadId: string) {
    return this.loadsService.markInTransit(req.user.id, loadId);
  }
}
