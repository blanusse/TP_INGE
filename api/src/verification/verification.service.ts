import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { IdentityVerification } from '../entities/identity-verification.entity';
import { VERIFF_CLIENT } from './veriff-client.interface';
import type { VeriffClient, WebhookPayload } from './veriff-client.interface';

@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);

  constructor(
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(IdentityVerification)
    private verificationsRepo: Repository<IdentityVerification>,
    @Inject(VERIFF_CLIENT) private veriffClient: VeriffClient,
  ) {}

  /** Crea una sesión de verificación para el usuario actual. */
  async startSession(userId: string) {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado.');

    const [firstName, ...rest] = user.name.trim().split(/\s+/);
    const lastName = rest.join(' ');

    const backendUrl =
      process.env.BACKEND_URL ?? `http://localhost:${process.env.PORT ?? 3001}`;

    const session = await this.veriffClient.createSession({
      userId: user.id,
      firstName: firstName ?? user.name,
      lastName: lastName ?? '',
      idNumber: user.dni,
      callbackUrl: `${backendUrl}/verification/webhook`,
    });

    const provider = process.env.VERIFF_PROVIDER === 'veriff' ? 'veriff' : 'mock';
    const record = this.verificationsRepo.create({
      user_id: user.id,
      veriff_session_id: session.sessionId,
      status: 'created',
      provider,
    });
    await this.verificationsRepo.save(record);

    return { url: session.url, sessionId: session.sessionId };
  }

  /** Maneja el webhook entrante (real o mock). */
  async handleWebhook(rawBody: string, signature: string | undefined) {
    const valid = this.veriffClient.verifyWebhookSignature(rawBody, signature);
    if (!valid) {
      this.logger.warn('Webhook con firma inválida, rechazado');
      throw new NotFoundException();
    }

    let parsed: WebhookPayload;
    try {
      const body = JSON.parse(rawBody) as Record<string, unknown>;
      parsed = this.veriffClient.parseWebhook(body);
    } catch (err) {
      this.logger.error(`Webhook body inválido: ${(err as Error).message}`);
      throw new NotFoundException();
    }

    const record = await this.verificationsRepo.findOne({
      where: { veriff_session_id: parsed.sessionId },
    });
    if (!record) {
      this.logger.warn(`Webhook para sesión desconocida: ${parsed.sessionId}`);
      return { ok: true };
    }

    record.status = parsed.status;
    record.decision_payload = parsed.raw;
    record.decided_at = new Date();
    await this.verificationsRepo.save(record);

    if (parsed.status === 'approved') {
      await this.usersRepo.update(record.user_id, { identity_verified: true });
      this.logger.log(`Usuario ${record.user_id} verificado correctamente`);
    }

    return { ok: true };
  }

  /** Estado actual del usuario. */
  async getStatus(userId: string) {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado.');

    const latest = await this.verificationsRepo.findOne({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
    });

    return {
      identity_verified: user.identity_verified,
      last_session_status: latest?.status ?? null,
      last_session_id: latest?.veriff_session_id ?? null,
      provider: latest?.provider ?? null,
    };
  }
}
