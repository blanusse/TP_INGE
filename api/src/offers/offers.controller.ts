import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OffersService } from './offers.service';

@Controller('offers')
@UseGuards(JwtAuthGuard)
export class OffersController {
  constructor(private offersService: OffersService) {}

  @Post()
  submitOffer(@Request() req, @Body() body) {
    return this.offersService.submitOffer(req.user.id, body);
  }

  @Get()
  getOffersForLoad(@Request() req, @Query('loadId') loadId: string) {
    return this.offersService.getOffersForLoad(req.user.id, loadId);
  }

  @Get('mine')
  getMyOffers(@Request() req) {
    return this.offersService.getMyOffers(req.user.id);
  }

  @Patch(':offerId')
  updateOffer(
    @Request() req,
    @Param('offerId') offerId: string,
    @Body() body: { action: string; counter_price?: number },
  ) {
    return this.offersService.updateOffer(req.user.id, offerId, body.action, body.counter_price);
  }
}
