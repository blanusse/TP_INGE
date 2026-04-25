import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { join } from 'path';
import PDFDocument from 'pdfkit';
import { Payment } from '../entities/payment.entity';
import { Offer } from '../entities/offer.entity';
import { Shipper } from '../entities/shipper.entity';
import { User } from '../entities/user.entity';
import { Load } from '../entities/load.entity';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment) private paymentsRepo: Repository<Payment>,
    @InjectRepository(Offer) private offersRepo: Repository<Offer>,
    @InjectRepository(Shipper) private shippersRepo: Repository<Shipper>,
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(Load) private loadsRepo: Repository<Load>,
  ) {}

  async createPayment(offerId: string, amount: number, mpPreferenceId: string) {
    const offer = await this.offersRepo.findOne({ where: { id: offerId } });
    if (!offer) throw new NotFoundException('Oferta no encontrada.');

    const payment = this.paymentsRepo.create({
      offer_id: offerId,
      load_id: offer.load_id,
      amount,
      mp_preference_id: mpPreferenceId,
      status: 'pending',
    });

    return this.paymentsRepo.save(payment);
  }

  async confirmPayment(offerId: string, mpPaymentId?: string) {
    const payment = await this.paymentsRepo.findOne({ where: { offer_id: offerId } });
    if (!payment) throw new NotFoundException('Pago no encontrado.');

    payment.status = 'confirmed';
    if (mpPaymentId) payment.mp_payment_id = mpPaymentId;

    return this.paymentsRepo.save(payment);
  }

  async getMyPayments(userId: string) {
    const shipper = await this.shippersRepo.findOne({ where: { user_id: userId } });
    if (!shipper) throw new ForbiddenException();

    const payments = await this.paymentsRepo.find({
      where: { load: { shipper_id: shipper.id } },
      relations: ['load', 'offer', 'offer.driver'],
      order: { created_at: 'DESC' },
    });

    return payments.map((p) => ({
      id:               p.id,
      offer_id:         p.offer_id,
      amount:           Number(p.amount),
      status:           p.status,
      mp_preference_id: p.mp_preference_id,
      mp_payment_id:    p.mp_payment_id,
      created_at:       p.created_at,
      cargo_type:       p.load?.cargo_type,
      pickup_city:      p.load?.pickup_city,
      dropoff_city:     p.load?.dropoff_city,
      driver_name:      p.offer?.driver?.name ?? null,
    }));
  }

  async generateInvoicePdf(paymentId: string, userId: string, invoiceNumber: string): Promise<Buffer> {
    const shipper = await this.shippersRepo.findOne({ where: { user_id: userId } });
    if (!shipper) throw new ForbiddenException();

    const payment = await this.paymentsRepo.findOne({
      where: { id: paymentId },
      relations: ['load', 'offer', 'offer.driver'],
    });
    if (!payment) throw new NotFoundException('Pago no encontrado.');
    if (payment.load?.shipper_id !== shipper.id) throw new ForbiddenException();

    const dadorUser = await this.usersRepo.findOne({ where: { id: userId } });
    const load = payment.load;
    const driver = payment.offer?.driver;

    const assetsDir = join(process.cwd(), 'src', 'assets');
    const fontRegular = join(assetsDir, 'Arial-Regular.ttf');
    const fontBold    = join(assetsDir, 'Arial-Bold.ttf');

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      doc.registerFont('Roboto', fontRegular);
      doc.registerFont('Roboto-Bold', fontBold);

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const BLUE = '#1a56db';
      const GRAY = '#6b7280';
      const LIGHT = '#f3f4f6';
      const BLACK = '#111827';
      const pageW = doc.page.width - 100;

      // ── Header ────────────────────────────────────────────────
      doc.rect(50, 40, pageW, 70).fill(BLUE);
      doc.fillColor('#ffffff').fontSize(22).font('Roboto-Bold').text('CargaBack', 65, 55);
      doc.fontSize(10).font('Roboto').text('Plataforma de logística de cargas', 65, 82);
      doc.fillColor('#ffffff').fontSize(10).text('COMPROBANTE DE PAGO', 50, 60, { align: 'right', width: pageW - 15 });
      doc.fontSize(16).font('Roboto-Bold').text(invoiceNumber, 50, 76, { align: 'right', width: pageW - 15 });

      // ── Fecha de emisión ──────────────────────────────────────
      const emisionDate = new Date(payment.created_at).toLocaleDateString('es-AR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
      });
      doc.fillColor(GRAY).fontSize(9).font('Roboto').text(`Fecha de emisión: ${emisionDate}`, 50, 118, { align: 'right', width: pageW });

      // ── Sección: Dador / Camionero ────────────────────────────
      const sectionTop = 140;
      const colW = (pageW - 20) / 2;

      // Dador (izquierda)
      doc.rect(50, sectionTop, colW, 110).fill(LIGHT);
      doc.fillColor(BLUE).fontSize(9).font('Roboto-Bold').text('DADOR DE CARGA', 62, sectionTop + 10);
      doc.fillColor(BLACK).fontSize(10).font('Roboto-Bold')
        .text(shipper.razon_social || dadorUser?.name || '-', 62, sectionTop + 26, { width: colW - 24 });
      doc.fontSize(9).font('Roboto').fillColor(GRAY);
      if (shipper.cuit)     doc.text(`CUIT: ${shipper.cuit}`,    62, doc.y + 4, { width: colW - 24 });
      if (shipper.cuil)     doc.text(`CUIL: ${shipper.cuil}`,    62, doc.y + 2, { width: colW - 24 });
      if (shipper.address)  doc.text(shipper.address,            62, doc.y + 2, { width: colW - 24 });
      if (dadorUser?.email) doc.text(dadorUser.email,            62, doc.y + 2, { width: colW - 24 });

      // Camionero (derecha)
      const colRx = 50 + colW + 20;
      doc.rect(colRx, sectionTop, colW, 110).fill(LIGHT);
      doc.fillColor(BLUE).fontSize(9).font('Roboto-Bold').text('TRANSPORTISTA', colRx + 12, sectionTop + 10);
      doc.fillColor(BLACK).fontSize(10).font('Roboto-Bold')
        .text(driver?.name || '-', colRx + 12, sectionTop + 26, { width: colW - 24 });
      doc.fontSize(9).font('Roboto').fillColor(GRAY);
      if (driver?.email) doc.text(driver.email,              colRx + 12, doc.y + 4, { width: colW - 24 });
      if (driver?.phone) doc.text(`Tel: ${driver.phone}`,   colRx + 12, doc.y + 2, { width: colW - 24 });

      // ── Tabla de detalle ──────────────────────────────────────
      const tableTop = sectionTop + 128;
      doc.fillColor(BLUE).rect(50, tableTop, pageW, 26).fill();
      doc.fillColor('#ffffff').fontSize(9).font('Roboto-Bold')
        .text('CONCEPTO', 62, tableTop + 8)
        .text('DETALLE', 62 + pageW / 2, tableTop + 8);

      const rows: [string, string][] = [
        ['Ruta', `${load?.pickup_city ?? '-'} \u2192 ${load?.dropoff_city ?? '-'}`],
        ['Tipo de carga', load?.cargo_type ?? '-'],
        ['Fecha del viaje', load?.ready_at
          ? new Date(load.ready_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
          : '-'],
        ['N\u00B0 Comprobante de pago MP', payment.mp_payment_id ?? '-'],
      ];

      rows.forEach(([label, value], i) => {
        const rowY = tableTop + 26 + i * 28;
        doc.rect(50, rowY, pageW, 28).fill(i % 2 === 0 ? '#ffffff' : LIGHT);
        doc.fillColor(GRAY).fontSize(9).font('Roboto-Bold').text(label, 62, rowY + 9);
        doc.fillColor(BLACK).fontSize(9).font('Roboto').text(value, 62 + pageW / 2, rowY + 9, { width: pageW / 2 - 12 });
      });

      // ── Total ─────────────────────────────────────────────────
      const totalTop = tableTop + 26 + rows.length * 28 + 16;
      doc.rect(50 + pageW / 2, totalTop, pageW / 2, 36).fill(BLUE);
      doc.fillColor('#ffffff').fontSize(11).font('Roboto-Bold')
        .text('TOTAL', 62 + pageW / 2, totalTop + 5, { width: pageW / 2 - 12 });
      doc.fontSize(13)
        .text(`$${Number(payment.amount).toLocaleString('es-AR')} ARS`, 62 + pageW / 2, totalTop + 18, { width: pageW / 2 - 12 });

      // ── Footer ────────────────────────────────────────────────
      const footerY = doc.page.height - 60;
      doc.rect(50, footerY, pageW, 1).fill('#e5e7eb');
      doc.fillColor(GRAY).fontSize(8).font('Roboto')
        .text('Este documento es un comprobante generado por CargaBack. No tiene validez fiscal ante AFIP.', 50, footerY + 10, { align: 'center', width: pageW });

      doc.end();
    });
  }
}
