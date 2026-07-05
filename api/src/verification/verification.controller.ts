import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { VerificationService } from './verification.service';

type AuthReq = { user: { id: string; email: string } };
type RawReq = { rawBody?: string };

@Controller('verification')
export class VerificationController {
  constructor(private verificationService: VerificationService) {}

  /** Usuario autenticado pide arrancar una verificación. */
  @Post('start')
  @UseGuards(JwtAuthGuard)
  startSession(@Request() req: AuthReq) {
    return this.verificationService.startSession(req.user.id);
  }

  /** Estado actual de la verificación del usuario. */
  @Get('status')
  @UseGuards(JwtAuthGuard)
  getStatus(@Request() req: AuthReq) {
    return this.verificationService.getStatus(req.user.id);
  }

  /**
   * Webhook entrante. Lo postea Veriff (real) o nuestro propio frontend mock.
   * Sin JwtAuthGuard — validamos por HMAC.
   */
  @Post('webhook')
  @HttpCode(200)
  handleWebhook(
    @Request() req: RawReq,
    @Body() _body: unknown,
    @Headers('x-hmac-signature') signature: string,
  ) {
    return this.verificationService.handleWebhook(req.rawBody ?? '', signature);
  }
}
