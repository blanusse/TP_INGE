import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Response, Request } from 'express';
import { JwtAuthGuard } from './jwt-auth.guard';
import { MpOauthService } from './mp-oauth.service';

type AuthReq = Request & { user: { id: string; role: string } };

@Controller('auth/mp')
export class MpOauthController {
  constructor(private readonly mpOauthService: MpOauthService) {}

  /** El transportista visita este endpoint para vincular su cuenta MP */
  @UseGuards(JwtAuthGuard)
  @Get('connect')
  connect(@Req() req: AuthReq, @Res() res: Response) {
    const url = this.mpOauthService.getAuthUrl(req.user.id);
    return res.redirect(url);
  }

  /** MP redirige aquí tras la autorización */
  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const frontendUrl = process.env.FRONTEND_URL ?? '';
    try {
      await this.mpOauthService.handleCallback(code, state);
      return res.redirect(`${frontendUrl}/perfil?mp_connected=true`);
    } catch {
      return res.redirect(`${frontendUrl}/perfil?mp_connected=false`);
    }
  }

  /** El frontend consulta si el transportista ya vinculó su cuenta MP */
  @UseGuards(JwtAuthGuard)
  @Get('status')
  status(@Req() req: AuthReq) {
    return this.mpOauthService.getStatus(req.user.id);
  }
}
