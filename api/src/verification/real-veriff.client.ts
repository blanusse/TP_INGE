import { Injectable, Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import {
  VeriffClient,
  CreateSessionInput,
  CreateSessionResult,
  WebhookPayload,
} from './veriff-client.interface';

// Implementación real: pega a stationapi.veriff.com.
// Solo se usa si VERIFF_PROVIDER=veriff y están seteadas VERIFF_API_KEY y VERIFF_API_SECRET.
@Injectable()
export class RealVeriffClient implements VeriffClient {
  private readonly logger = new Logger(RealVeriffClient.name);
  private readonly baseUrl = 'https://stationapi.veriff.com';

  async createSession(input: CreateSessionInput): Promise<CreateSessionResult> {
    const apiKey = process.env.VERIFF_API_KEY;
    if (!apiKey) throw new Error('VERIFF_API_KEY no configurada');

    const res = await fetch(`${this.baseUrl}/v1/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-AUTH-CLIENT': apiKey,
      },
      body: JSON.stringify({
        verification: {
          callback: input.callbackUrl,
          person: {
            firstName: input.firstName,
            lastName: input.lastName,
            idNumber: input.idNumber,
          },
          document: { type: 'ID_CARD', country: 'AR' },
          vendorData: input.userId,
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      this.logger.error(`Veriff session creation failed: ${res.status} ${errText}`);
      throw new Error(`Veriff error: ${res.status}`);
    }

    const data = (await res.json()) as {
      verification: { id: string; url: string };
    };
    return { sessionId: data.verification.id, url: data.verification.url };
  }

  verifyWebhookSignature(rawBody: string, signature: string | undefined): boolean {
    const secret = process.env.VERIFF_API_SECRET;
    if (!secret || !signature) return false;
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    const a = Buffer.from(expected, 'hex');
    let b: Buffer;
    try {
      b = Buffer.from(signature, 'hex');
    } catch {
      return false;
    }
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }

  parseWebhook(body: Record<string, unknown>): WebhookPayload {
    // Estructura del decision webhook de Veriff:
    // { verification: { id, status, vendorData, person: {...}, document: {...} } }
    const verification = body.verification as Record<string, unknown> | undefined;
    if (!verification) {
      throw new Error('Webhook sin campo verification');
    }
    const rawStatus = String(verification.status ?? '');
    let status: WebhookPayload['status'];
    if (rawStatus === 'approved') status = 'approved';
    else if (rawStatus === 'resubmission_requested') status = 'resubmission';
    else status = 'declined';

    return {
      sessionId: String(verification.id ?? ''),
      status,
      vendorData: String(verification.vendorData ?? ''),
      raw: body,
    };
  }
}
