import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { User } from '../entities/user.entity';

@Injectable()
export class MpOauthService {
  constructor(@InjectRepository(User) private usersRepo: Repository<User>) {}

  /**
   * Firma el `state` de OAuth como `${userId}.${nonce}.${hmac}` para que el
   * callback pueda verificar que pertenece a una sesión iniciada por nosotros
   * y no fue construido por un atacante para linkear su MP a la cuenta víctima.
   */
  private signState(userId: string): string {
    const secret = process.env.JWT_SECRET ?? '';
    if (!secret) throw new BadRequestException('JWT_SECRET no configurado.');
    const nonce = randomBytes(16).toString('hex');
    const payload = `${userId}.${nonce}`;
    const sig = createHmac('sha256', secret).update(payload).digest('hex');
    return `${payload}.${sig}`;
  }

  private verifyState(state: string): string {
    const secret = process.env.JWT_SECRET ?? '';
    if (!secret) throw new UnauthorizedException();
    const parts = state.split('.');
    if (parts.length !== 3) throw new UnauthorizedException('state inválido.');
    const [userId, nonce, sig] = parts;
    const expected = createHmac('sha256', secret)
      .update(`${userId}.${nonce}`)
      .digest('hex');
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(sig, 'hex');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('state inválido.');
    }
    return userId;
  }

  getAuthUrl(userId: string): string {
    const clientId = process.env.MP_CLIENT_ID;
    const redirectUri = process.env.MP_REDIRECT_URI;
    if (!clientId || !redirectUri) {
      throw new BadRequestException(
        'Integración con MercadoPago no configurada.',
      );
    }
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      platform_id: 'mp',
      redirect_uri: redirectUri,
      state: this.signState(userId),
    });
    return `https://auth.mercadopago.com/authorization?${params.toString()}`;
  }

  async handleCallback(code: string, state: string): Promise<void> {
    const userId = this.verifyState(state);

    const res = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
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
      throw new BadRequestException(
        `Error al conectar con MercadoPago: ${body}`,
      );
    }

    const data = (await res.json()) as { user_id: number };
    await this.usersRepo.update(userId, { mp_user_id: String(data.user_id) });
  }

  async getStatus(userId: string) {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    return { connected: !!user?.mp_user_id };
  }
}
