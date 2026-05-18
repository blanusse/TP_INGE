import { Controller, Get, Post, Patch, Delete, Body, Param, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { InsuranceService } from './insurance.service';

type AuthReq = { user: { id: string; role: string } };

@Controller()
@UseGuards(JwtAuthGuard)
export class InsuranceController {
  constructor(private insuranceService: InsuranceService) {}

  // ── Catálogo ──────────────────────────────────────────────────────────────

  /** Dadores y admins: seguros activos */
  @Get('insurance/products')
  getProducts() {
    return this.insuranceService.getProducts();
  }

  /** Admin: incluye desactivados */
  @Get('insurance/products/all')
  getAllProducts(@Request() req: AuthReq) {
    return this.insuranceService.getAllProducts();
  }

  @Post('insurance/products')
  createProduct(
    @Request() req: AuthReq,
    @Body() body: { name: string; insurer: string; coverage_type: string; price: number; conditions: string },
  ) {
    return this.insuranceService.createProduct(req.user.role, body);
  }

  @Patch('insurance/products/:id')
  updateProduct(
    @Request() req: AuthReq,
    @Param('id') id: string,
    @Body() body: Partial<{ name: string; insurer: string; coverage_type: string; price: number; conditions: string; is_active: boolean }>,
  ) {
    return this.insuranceService.updateProduct(req.user.role, id, body);
  }

  @Delete('insurance/products/:id')
  deleteProduct(@Request() req: AuthReq, @Param('id') id: string) {
    return this.insuranceService.deleteProduct(req.user.role, id);
  }

  // ── Cotización / compra ───────────────────────────────────────────────────

  @Post('insurance/quote')
  getQuote(
    @Body() body: { declared_value: number; cargo_type: string; distance_km?: number; pickup_city: string; dropoff_city: string },
  ) {
    return this.insuranceService.getQuote(body);
  }

  @Post('insurance/purchase')
  purchasePolicy(
    @Request() req: AuthReq,
    @Body() body: { declared_value: number; cargo_type: string; distance_km?: number; pickup_city: string; dropoff_city: string; quote_id: string; load_id?: string },
  ) {
    return this.insuranceService.purchasePolicy(req.user.id, body);
  }

  @Get('insurance/policies')
  getMyPolicies(@Request() req: AuthReq) {
    return this.insuranceService.getMyPolicies(req.user.id);
  }
}
