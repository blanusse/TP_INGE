import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

interface NuevaOfertaOpts {
  dadorEmail: string;
  dadorName: string;
  camioneroName: string;
  pickup: string;
  dropoff: string;
  price: number;
  note?: string;
  loadId: string;
}

interface UpdateOfertaOpts {
  dadorEmail: string;
  dadorName: string;
  camioneroName: string;
  pickup: string;
  dropoff: string;
  price?: number;
  loadId: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: config.get<string>('MAIL_HOST'),
      port: config.get<number>('MAIL_PORT'),
      auth: {
        user: config.get<string>('MAIL_USER'),
        pass: config.get<string>('MAIL_PASS'),
      },
    });
  }

  private buildHtml(
    intro: string,
    dadorName: string,
    rows: { label: string; value: string }[],
    ctaUrl: string,
  ): string {
    const rowsHtml = rows
      .map(
        (r) => `
      <tr>
        <td class="td-label" style="padding:8px 12px;font-weight:bold;background:#f4f7f5;border:1px solid #ddeae4;color:#4a6b5e;">${r.label}</td>
        <td class="td-value" style="padding:8px 12px;border:1px solid #ddeae4;color:#0f1f19;">${r.value}</td>
      </tr>`,
      )
      .join('');

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <style>
    :root { color-scheme: light dark; }
    body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #0f1f19; background: #f4f7f5; }
    .email-body { background: #ffffff; padding: 24px; }
    .email-footer { padding: 16px; text-align: center; font-size: 12px; color: #8aab9e; border-top: 1px solid #ddeae4; background: #f4f7f5; }
    .email-text { color: #4a6b5e; }
    .td-label { padding: 8px 12px; font-weight: bold; background: #f4f7f5; border: 1px solid #ddeae4; color: #4a6b5e; }
    .td-value { padding: 8px 12px; border: 1px solid #ddeae4; color: #0f1f19; }
    @media (prefers-color-scheme: dark) {
      body { background: #0a0a0a !important; color: #e8f0eb !important; }
      .email-body { background: #111111 !important; }
      .email-footer { background: #0a0a0a !important; color: #4d6357 !important; border-top-color: rgba(255,255,255,0.08) !important; }
      .email-text { color: #8fa896 !important; }
      .td-label { background: #1a1a1a !important; border-color: rgba(255,255,255,0.1) !important; color: #8fa896 !important; }
      .td-value { border-color: rgba(255,255,255,0.1) !important; color: #e8f0eb !important; }
      h1, h2, p, strong { color: #e8f0eb !important; }
    }
  </style>
</head>
  <body>
    <div style="background:#3a806b;padding:20px;text-align:center;">
      <h1 style="color:white;margin:0;font-size:22px;">CargaBack</h1>
    </div>
    <div class="email-body">
      <p>Hola <strong>${dadorName}</strong>,</p>
      <p class="email-text">${intro}</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        ${rowsHtml}
      </table>
      <div style="text-align:center;margin-top:28px;">
        <a href="${ctaUrl}"
           style="background:#3a806b;color:white;padding:12px 28px;text-decoration:none;border-radius:6px;font-weight:bold;">
          Ver oferta →
        </a>
      </div>
    </div>
    <div class="email-footer">
      CargaBack — No respondas este mail directamente.
    </div>
  </body>
</html>`;
  }

  async sendNuevaOferta(opts: NuevaOfertaOpts) {
    const ctaUrl = `${this.config.get('FRONTEND_URL')}/dador?carga=${opts.loadId}`;
    const rows: { label: string; value: string }[] = [
      { label: 'Camionero', value: opts.camioneroName },
      { label: 'Ruta', value: `${opts.pickup} → ${opts.dropoff}` },
      { label: 'Precio ofrecido', value: `$${Number(opts.price).toLocaleString('es-AR')}` },
    ];
    if (opts.note) rows.push({ label: 'Nota', value: opts.note });

    await this.send({
      to: opts.dadorEmail,
      subject: `Nueva oferta recibida — ${opts.pickup} → ${opts.dropoff}`,
      html: this.buildHtml(
        'recibiste una nueva oferta para tu carga.',
        opts.dadorName,
        rows,
        ctaUrl,
      ),
    });
  }

  async sendContraofertaAceptada(opts: UpdateOfertaOpts) {
    const ctaUrl = `${this.config.get('FRONTEND_URL')}/dador?carga=${opts.loadId}`;
    const rows: { label: string; value: string }[] = [
      { label: 'Camionero', value: opts.camioneroName },
      { label: 'Ruta', value: `${opts.pickup} → ${opts.dropoff}` },
    ];
    if (opts.price != null) {
      rows.push({ label: 'Precio acordado', value: `$${Number(opts.price).toLocaleString('es-AR')}` });
    }

    await this.send({
      to: opts.dadorEmail,
      subject: `Tu contraoferta fue aceptada — ${opts.pickup} → ${opts.dropoff}`,
      html: this.buildHtml(
        'el camionero aceptó tu contraoferta.',
        opts.dadorName,
        rows,
        ctaUrl,
      ),
    });
  }

  async sendContraofertaRechazada(opts: UpdateOfertaOpts) {
    const ctaUrl = `${this.config.get('FRONTEND_URL')}/dador?carga=${opts.loadId}`;
    const rows = [
      { label: 'Camionero', value: opts.camioneroName },
      { label: 'Ruta', value: `${opts.pickup} → ${opts.dropoff}` },
    ];

    await this.send({
      to: opts.dadorEmail,
      subject: `Tu contraoferta fue rechazada — ${opts.pickup} → ${opts.dropoff}`,
      html: this.buildHtml(
        'el camionero rechazó tu contraoferta.',
        opts.dadorName,
        rows,
        ctaUrl,
      ),
    });
  }

  async sendOfertaRetirada(opts: UpdateOfertaOpts) {
    const ctaUrl = `${this.config.get('FRONTEND_URL')}/dador?carga=${opts.loadId}`;
    const rows = [
      { label: 'Camionero', value: opts.camioneroName },
      { label: 'Ruta', value: `${opts.pickup} → ${opts.dropoff}` },
    ];

    await this.send({
      to: opts.dadorEmail,
      subject: `Una oferta fue retirada — ${opts.pickup} → ${opts.dropoff}`,
      html: this.buildHtml(
        'el camionero retiró su oferta.',
        opts.dadorName,
        rows,
        ctaUrl,
      ),
    });
  }

  async sendContraofertaRecibida(opts: { camioneroEmail: string; camioneroName: string; pickup: string; dropoff: string; counterPrice: number; loadId: string }) {
    const ctaUrl = `${this.config.get('FRONTEND_URL')}/transportista`;
    const rows = [
      { label: 'Ruta', value: `${opts.pickup} → ${opts.dropoff}` },
      { label: 'Contraoferta del dador', value: `$${Number(opts.counterPrice).toLocaleString('es-AR')}` },
    ];
    await this.send({
      to: opts.camioneroEmail,
      subject: `Recibiste una contraoferta — ${opts.pickup} → ${opts.dropoff}`,
      html: this.buildHtml(
        'el dador de carga realizó una <strong>contraoferta</strong> para tu oferta.',
        opts.camioneroName,
        rows,
        ctaUrl,
      ),
    });
  }

  async sendOfertaAceptada(opts: { camioneroEmail: string; camioneroName: string; pickup: string; dropoff: string; price: number; loadId: string }) {
    const ctaUrl = `${this.config.get('FRONTEND_URL')}/transportista`;
    const rows = [
      { label: 'Ruta', value: `${opts.pickup} → ${opts.dropoff}` },
      { label: 'Precio acordado', value: `$${Number(opts.price).toLocaleString('es-AR')}` },
    ];
    await this.send({
      to: opts.camioneroEmail,
      subject: `Tu oferta fue aceptada — ${opts.pickup} → ${opts.dropoff}`,
      html: this.buildHtml(
        'tu oferta fue <strong>aceptada</strong>. El viaje está confirmado.',
        opts.camioneroName,
        rows,
        ctaUrl,
      ),
    });
  }

  async sendOfertaRechazada(opts: { camioneroEmail: string; camioneroName: string; pickup: string; dropoff: string; loadId: string }) {
    const ctaUrl = `${this.config.get('FRONTEND_URL')}/transportista`;
    const rows = [
      { label: 'Ruta', value: `${opts.pickup} → ${opts.dropoff}` },
    ];
    await this.send({
      to: opts.camioneroEmail,
      subject: `Tu oferta fue rechazada — ${opts.pickup} → ${opts.dropoff}`,
      html: this.buildHtml(
        'lamentablemente tu oferta fue <strong>rechazada</strong> por el dador de carga.',
        opts.camioneroName,
        rows,
        ctaUrl,
      ),
    });
  }

  async sendInvitacionFlota(opts: { email: string; ownerName: string; token: string }) {
    const frontendUrl = this.config.get('FRONTEND_URL') ?? 'http://localhost:3000';
    const link = `${frontendUrl}/invitacion/${opts.token}`;
    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <style>
    :root { color-scheme: light dark; }
    body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #0f1f19; background: #f4f7f5; }
    .email-body { background: #ffffff; padding: 24px; }
    .email-footer { padding: 16px; text-align: center; font-size: 12px; color: #8aab9e; border-top: 1px solid #ddeae4; background: #f4f7f5; }
    .email-text { color: #4a6b5e; }
    .info-box { background: #e0f0ea; border: 1px solid #b0d4c8; border-radius: 8px; padding: 16px; margin: 20px 0; }
    .info-box p { margin: 0; font-size: 13px; color: #2e6656; }
    @media (prefers-color-scheme: dark) {
      body { background: #0a0a0a !important; color: #e8f0eb !important; }
      .email-body { background: #111111 !important; }
      .email-footer { background: #0a0a0a !important; color: #4d6357 !important; border-top-color: rgba(255,255,255,0.08) !important; }
      .email-text { color: #8fa896 !important; }
      .info-box { background: rgba(58,128,107,0.15) !important; border-color: rgba(58,128,107,0.3) !important; }
      .info-box p { color: #3a806b !important; }
      h1, h2, p, strong { color: #e8f0eb !important; }
    }
  </style>
</head>
<body>
    <div style="background:#3a806b;padding:20px;text-align:center;">
      <h1 style="color:white;margin:0;font-size:22px;">CargaBack</h1>
    </div>
    <div class="email-body">
      <p>Hola,</p>
      <p class="email-text"><strong style="color:#0f1f19;">${opts.ownerName}</strong> te invita a unirte a su flota en CargaBack como conductor.</p>
      <p class="email-text">Al aceptar, tu cuenta quedará vinculada a su flota y podrá gestionar tus viajes.</p>
      <div class="info-box">
        <p>Este enlace es de <strong>uso único</strong> y vence en <strong>48 horas</strong>. Una vez abierto, no podrá usarse nuevamente.</p>
      </div>
      <div style="text-align:center;margin-top:28px;">
        <a href="${link}" style="background:#3a806b;color:white;padding:12px 28px;text-decoration:none;border-radius:6px;font-weight:bold;">
          Ver invitación →
        </a>
      </div>
    </div>
    <div class="email-footer">
      CargaBack — No respondas este mail directamente.
    </div>
</body>
</html>`;
    await this.send({ to: opts.email, subject: `${opts.ownerName} te invita a su flota en CargaBack`, html });
  }

  private async send(opts: { to: string; subject: string; html: string }) {
    try {
      await this.transporter.sendMail({
        from: `"CargaBack" <${this.config.get('MAIL_FROM')}>`,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
      });
    } catch (err) {
      this.logger.error(`Error enviando mail a ${opts.to}: ${err.message}`);
    }
  }
}
