import { Controller, Get, Post, Body, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { InsuranceService } from './insurance.service';

type AuthReq = { user: { id: string } };

@Controller()
@UseGuards(JwtAuthGuard)
export class InsuranceController {
  constructor(private insuranceService: InsuranceService) {}

  @Post('insurance/quote')
  getQuote(
    @Body()
    body: {
      declared_value: number;
      cargo_type: string;
      distance_km?: number;
      pickup_city: string;
      dropoff_city: string;
    },
  ) {
    return this.insuranceService.getQuote(body);
  }

  @Post('insurance/purchase')
  purchasePolicy(
    @Request() req: AuthReq,
    @Body()
    body: {
      declared_value: number;
      cargo_type: string;
      distance_km?: number;
      pickup_city: string;
      dropoff_city: string;
      quote_id: string;
      load_id?: string;
    },
  ) {
    return this.insuranceService.purchasePolicy(req.user.id, body);
  }

  @Get('insurance/policies')
  getMyPolicies(@Request() req: AuthReq) {
    return this.insuranceService.getMyPolicies(req.user.id);
  }
}
