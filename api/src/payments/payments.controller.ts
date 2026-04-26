import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request, Headers, Res, UnauthorizedException } from '@nestjs/common';
import type { Response } from 'express';
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

  // El dador ve el código de entrega para compartirlo con quien recibe la carga
  @Get('delivery-code')
  @UseGuards(JwtAuthGuard)
  getDeliveryCode(@Request() req, @Query('loadId') loadId: string) {
    return this.paymentsService.getDeliveryCode(req.user.id, loadId);
  }

  // El transportista confirma la entrega con el código y elige cómo cobrar
  @Post('confirm-delivery')
  @UseGuards(JwtAuthGuard)
  confirmDelivery(
    @Request() req,
    @Body() body: { loadId: string; code: string; payoutMethod: string; payoutDestination: string },
  ) {
    return this.paymentsService.confirmDelivery(
      req.user.id,
      body.loadId,
      body.code,
      body.payoutMethod,
      body.payoutDestination,
    );
  }

  // Descarga de factura en PDF
  @Get(':paymentId/invoice')
  @UseGuards(JwtAuthGuard)
  async downloadInvoice(
    @Param('paymentId') paymentId: string,
    @Query('numero') numero: string,
    @Request() req,
    @Res() res: Response,
  ) {
    const buffer = await this.paymentsService.generateInvoicePdf(paymentId, req.user.id, numero ?? 'F-0000-000');
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="factura-${numero ?? paymentId}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }
}
