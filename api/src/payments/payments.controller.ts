import { Controller, Get, Post, Patch, Body, Param, UseGuards, Request, Headers, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  // Llamado por el front al crear preferencia MP
  @Post()
  @UseGuards(JwtAuthGuard)
  createPayment(@Body() body: { offerId: string; amount: number; mpPreferenceId: string }) {
    return this.paymentsService.createPayment(body.offerId, body.amount, body.mpPreferenceId);
  }

  // Llamado por el front al confirmar pago (página de éxito o simulate)
  @Patch(':offerId/confirm')
  @UseGuards(JwtAuthGuard)
  confirmPayment(@Param('offerId') offerId: string, @Body() body: { mpPaymentId?: string }) {
    return this.paymentsService.confirmPayment(offerId, body.mpPaymentId);
  }

  // Llamado por el webhook de MP (sin JWT, protegido por secreto interno)
  @Patch('internal/:offerId/confirm')
  confirmPaymentInternal(
    @Param('offerId') offerId: string,
    @Body() body: { mpPaymentId?: string },
    @Headers('x-internal-secret') secret: string,
  ) {
    if (secret !== process.env.INTERNAL_SECRET) throw new UnauthorizedException();
    return this.paymentsService.confirmPayment(offerId, body.mpPaymentId);
  }

  // Historial de pagos del dador (para facturas)
  @Get('mine')
  @UseGuards(JwtAuthGuard)
  getMyPayments(@Request() req) {
    return this.paymentsService.getMyPayments(req.user.id);
  }
}
