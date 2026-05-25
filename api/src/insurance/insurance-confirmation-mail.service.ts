import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

export interface InsuranceConfirmationEmailPayload {
  to: string;
  userName: string;
  insuranceName: string;
  insurerName: string;
  coverageType: string;
  tripSummary: string;
  loadId: string | null;
  coverageStartsAt: Date;
  coverageEndsAt: Date;
  premium: number;
}

@Injectable()
export class InsuranceConfirmationMailService {
  private readonly logger = new Logger(InsuranceConfirmationMailService.name);
  private readonly resend: Resend | null;
  private readonly fromAddress: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    this.resend = apiKey ? new Resend(apiKey) : null;
    this.fromAddress = this.resolveFromAddress();
  }

  async sendPolicyConfirmation(payload: InsuranceConfirmationEmailPayload) {
    if (!payload.to) return;

    if (!this.resend) {
      this.logger.warn(
        'No se envio email de confirmacion de seguro: RESEND_API_KEY no configurado.',
      );
      return;
    }

    const subject = `Confirmacion de contratacion de seguro - ${
      payload.loadId ? `viaje ${payload.loadId.slice(0, 8)}` : 'viaje asociado'
    }`;

    try {
      const response = await this.resend.emails.send({
        from: this.fromAddress,
        to: payload.to,
        subject,
        text: this.buildText(payload),
        html: this.buildHtml(payload),
      });

      if (response.error) {
        this.logger.error(
          `Resend devolvio error al enviar confirmacion de seguro a ${payload.to}: ${response.error.message}`,
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Fallo envio de confirmacion de seguro a ${payload.to}: ${msg}`,
      );
    }
  }

  private resolveFromAddress() {
    const configured =
      this.config.get<string>('RESEND_FROM_EMAIL') ??
      this.config.get<string>('MAIL_FROM');

    if (!configured) return 'CargaBack <onboarding@resend.dev>';
    if (configured.includes('<')) return configured;
    return `CargaBack <${configured}>`;
  }

  private buildText(payload: InsuranceConfirmationEmailPayload) {
    const validity = `${this.formatDate(payload.coverageStartsAt)} al ${this.formatDate(payload.coverageEndsAt)}`;
    const premium = this.formatCurrency(payload.premium);

    return [
      `Hola ${payload.userName},`,
      '',
      'Tu seguro fue contratado correctamente.',
      '',
      `Seguro: ${payload.insuranceName}`,
      `Aseguradora: ${payload.insurerName}`,
      `Cobertura: ${payload.coverageType}`,
      `Viaje asociado: ${payload.tripSummary}`,
      `Vigencia: ${validity}`,
      `Prima: ${premium}`,
      '',
      'Esta confirmacion deja constancia de tu cobertura dentro de la plataforma CargaBack.',
    ].join('\n');
  }

  private buildHtml(payload: InsuranceConfirmationEmailPayload) {
    const validity = `${this.formatDate(payload.coverageStartsAt)} al ${this.formatDate(payload.coverageEndsAt)}`;
    const premium = this.formatCurrency(payload.premium);

    const row = (label: string, value: string) => `
      <tr>
        <td style="padding:8px 10px;border:1px solid #e5e7eb;background:#f8fafc;font-weight:600;color:#374151;">${label}</td>
        <td style="padding:8px 10px;border:1px solid #e5e7eb;color:#111827;">${value}</td>
      </tr>
    `;

    return `<!DOCTYPE html>
<html lang="es">
  <body style="margin:0;padding:20px;background:#f3f4f6;font-family:Arial,sans-serif;color:#111827;">
    <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
      <div style="padding:18px 20px;background:#3a806b;color:#ffffff;font-size:20px;font-weight:700;">
        CargaBack
      </div>
      <div style="padding:20px;">
        <p style="margin-top:0;">Hola <strong>${payload.userName}</strong>,</p>
        <p>Tu seguro fue contratado correctamente. Este es el detalle de la cobertura:</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          ${row('Seguro', payload.insuranceName)}
          ${row('Aseguradora', payload.insurerName)}
          ${row('Cobertura', payload.coverageType)}
          ${row('Viaje asociado', payload.tripSummary)}
          ${row('Vigencia', validity)}
          ${row('Prima', premium)}
        </table>
        <p style="margin:16px 0 0;color:#4b5563;font-size:13px;">
          Esta confirmacion tambien queda visible en el detalle del viaje dentro de la plataforma.
        </p>
      </div>
    </div>
  </body>
</html>`;
  }

  private formatDate(value: Date) {
    return new Intl.DateTimeFormat('es-AR', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'America/Argentina/Buenos_Aires',
    }).format(value);
  }

  private formatCurrency(value: number) {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(Number(value));
  }
}
