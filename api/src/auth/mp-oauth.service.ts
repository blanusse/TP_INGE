import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';

@Injectable()
export class MpOauthService {
  constructor(
    @InjectRepository(User) private usersRepo: Repository<User>,
  ) {}

  getAuthUrl(userId: string): string {
    const clientId = process.env.MP_CLIENT_ID;
    const redirectUri = process.env.MP_REDIRECT_URI;
    if (!clientId || !redirectUri) {
      throw new BadRequestException('Integración con MercadoPago no configurada.');
    }
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      platform_id: 'mp',
      redirect_uri: redirectUri,
      state: userId,
    });
    return `https://auth.mercadopago.com/authorization?${params.toString()}`;
  }

  async handleCallback(code: string, userId: string): Promise<void> {
    const res = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: process.env.MP_CLIENT_ID,
        client_secret: process.env.MP_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: process.env.MP_REDIRECT_URI,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new BadRequestException(`Error al conectar con MercadoPago: ${body}`);
    }

    const data = await res.json() as { user_id: number };
    await this.usersRepo.update(userId, { mp_user_id: String(data.user_id) });
  }

  async getStatus(userId: string) {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    return { connected: !!user?.mp_user_id };
  }
}
