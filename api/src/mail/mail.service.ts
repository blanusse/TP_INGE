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
        <td style="padding:8px 12px;font-weight:bold;background:#f5f5f5;border:1px solid #e0e0e0;">${r.label}</td>
        <td style="padding:8px 12px;border:1px solid #e0e0e0;">${r.value}</td>
      </tr>`,
      )
      .join('');

    return `<!DOCTYPE html>
<html>
  <body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333;">
    <div style="background:#1a56db;padding:20px;text-align:center;">
      <h1 style="color:white;margin:0;font-size:22px;">CargaBack</h1>
    </div>
    <div style="padding:24px;">
      <p>Hola <strong>${dadorName}</strong>,</p>
      <p>${intro}</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        ${rowsHtml}
      </table>
      <div style="text-align:center;margin-top:28px;">
        <a href="${ctaUrl}"
           style="background:#1a56db;color:white;padding:12px 28px;text-decoration:none;border-radius:6px;font-weight:bold;">
          Ver oferta →
        </a>
      </div>
    </div>
    <div style="padding:16px;text-align:center;font-size:12px;color:#888;border-top:1px solid #eee;">
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
