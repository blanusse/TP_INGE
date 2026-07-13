import { Controller, Post, Get, Body, Param, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SkipThrottle } from '@nestjs/throttler';

type AuthReq = { user: { id: string; role: string; email: string } };
import { RatingsService } from './ratings.service';

@Controller('ratings')
export class RatingsController {
  constructor(private ratingsService: RatingsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  submitRating(
    @Request() req: AuthReq,
    @Body() body: { offer_id: string; score: number; comment?: string },
  ) {
    return this.ratingsService.submitRating(req.user.id, body);
  }

  /** offer_ids que el usuario logueado ya calificó (para ocultar el botón de calificar) */
  @UseGuards(JwtAuthGuard)
  @Get('given')
  getGivenRatings(@Request() req: AuthReq) {
    return this.ratingsService.getGivenOfferIds(req.user.id);
  }

  @SkipThrottle()
  @Get('user/:id')
  getUserRatings(@Param('id') id: string) {
    return this.ratingsService.getUserRatings(id);
  }
}
