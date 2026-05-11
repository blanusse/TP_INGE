import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

type AuthReq = { user: { id: string; role: string; email: string } };
import { RatingsService } from './ratings.service';

@Controller('ratings')
@UseGuards(JwtAuthGuard)
export class RatingsController {
  constructor(private ratingsService: RatingsService) {}

  @Post()
  submitRating(
    @Request() req: AuthReq,
    @Body() body: { offer_id: string; score: number },
  ) {
    return this.ratingsService.submitRating(req.user.id, body);
  }
}
