import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  VeriffClient,
  CreateSessionInput,
  CreateSessionResult,
  WebhookPayload,
} from './veriff-client.interface';

// Implementación mock: NO toca veriff.com. La URL que devuelve apunta a
// /verificar-identidad de nuestro propio frontend, que simula el flujo y
// dispara el webhook al backend cuando "termina".
@Injectable()
export class MockVeriffClient implements VeriffClient {
  private readonly logger = new Logger(MockVeriffClient.name);

  async createSession(input: CreateSessionInput): Promise<CreateSessionResult> {
    const sessionId = `mock-${randomUUID()}`;
    const webBase = process.env.WEB_URL ?? 'http://localhost:3000';
    const url = `${webBase}/verificar-identidad?session=${sessionId}&user=${input.userId}`;

    this.logger.log(
      `[MOCK] Sesión creada para ${input.firstName} ${input.lastName} (DNI ${input.idNumber ?? '-'}) — ${sessionId}`,
    );

    return { sessionId, url };
  }

  verifyWebhookSignature(_rawBody: string, _signature: string | undefined): boolean {
    // En mock no validamos firma. En prod, el cliente real chequea HMAC.
    return true;
  }

  parseWebhook(body: Record<string, unknown>): WebhookPayload {
    return {
      sessionId: String(body.sessionId ?? ''),
      status: (body.status as WebhookPayload['status']) ?? 'declined',
      vendorData: String(body.vendorData ?? ''),
      raw: body,
    };
  }
}
