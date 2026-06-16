import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { join } from 'path';
import { randomInt } from 'crypto';
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

  async createPayment(
    userId: string,
    offerId: string,
    amount: number,
    mpPreferenceId: string,
  ) {
    const offer = await this.offersRepo.findOne({ where: { id: offerId } });
    if (!offer) throw new NotFoundException('Oferta no encontrada.');

    // El pago lo origina el dador de la carga ofertada. Validamos ownership.
    const shipper = await this.shippersRepo.findOne({
      where: { user_id: userId },
    });
    if (!shipper) throw new ForbiddenException();
    const load = await this.loadsRepo.findOne({
      where: { id: offer.load_id },
    });
    if (!load || load.shipper_id !== shipper.id) {
      throw new ForbiddenException('Esta oferta no pertenece a tu carga.');
    }

    if (!amount || Number(amount) <= 0) {
      throw new BadRequestException('El monto debe ser mayor a 0.');
    }

    // Idempotencia: si ya existe un pago para esta oferta, devolverlo
    const existing = await this.paymentsRepo.findOne({
      where: { offer_id: offerId },
    });
    if (existing) return existing;

    const payment = this.paymentsRepo.create({
      offer_id: offerId,
      load_id: offer.load_id,
      amount,
      mp_preference_id: mpPreferenceId,
      status: 'pending',
    });

    return this.paymentsRepo.save(payment);
  }

  private static readonly CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin O/0/I/1
  private static readonly CODE_LENGTH = 8;

  private generateDeliveryCode(): string {
    let code = '';
    for (let i = 0; i < PaymentsService.CODE_LENGTH; i++) {
      code +=
        PaymentsService.CODE_CHARS[
          randomInt(PaymentsService.CODE_CHARS.length)
        ];
    }
    return code;
  }

  /**
   * MP no expone una API pública de transferencias salientes para cuentas estándar.
   * El flujo correcto de marketplace (Advanced Payments) requiere que el transportista
   * conecte su cuenta MP vía OAuth, dividiendo el pago al momento de la cobranza.
   *
   * Esta implementación registra la solicitud de pago y la marca como 'requested'.
   * El administrador de la plataforma puede procesar la transferencia desde el
   * dashboard de MercadoPago o via API con credenciales de marketplace habilitadas.
   */

  /**
   * Confirma el pago. Si `userId` se provee, validamos que el caller sea el
   * dador dueño de la carga (uso desde el frontend tras el redirect de MP).
   * Si `userId` es undefined, asumimos llamada interna ya autenticada por
   * `INTERNAL_SECRET` (webhook de MP).
   */
  async confirmPayment(
    offerId: string,
    mpPaymentId?: string,
    userId?: string,
  ) {
    const payment = await this.paymentsRepo.findOne({
      where: { offer_id: offerId },
    });
    if (!payment) throw new NotFoundException('Pago no encontrado.');

    if (userId) {
      const shipper = await this.shippersRepo.findOne({
        where: { user_id: userId },
      });
      const load = await this.loadsRepo.findOne({
        where: { id: payment.load_id },
      });
      if (!shipper || !load || load.shipper_id !== shipper.id) {
        throw new ForbiddenException('Este pago no pertenece a tu carga.');
      }
    }

    // Idempotencia: no regenerar código si ya está confirmado
    if (payment.status === 'confirmed') return payment;

    payment.status = 'confirmed';
    if (mpPaymentId) payment.mp_payment_id = mpPaymentId;

    // Generar código de entrega único si todavía no tiene uno
    if (!payment.delivery_code) {
      let code: string;
      let attempts = 0;
      do {
        code = this.generateDeliveryCode();
        const exists = await this.paymentsRepo.findOne({
          where: { delivery_code: code },
        });
        if (!exists) break;
        attempts++;
      } while (attempts < 10);
      payment.delivery_code = code;
    }

    return this.paymentsRepo.save(payment);
  }

  /** El dador obtiene el código de entrega de una carga (para mostrarlo en su panel) */
  async getDeliveryCode(userId: string, loadId: string) {
    const shipper = await this.shippersRepo.findOne({
      where: { user_id: userId },
    });
    if (!shipper) throw new ForbiddenException();

    const payment = await this.paymentsRepo.findOne({
      where: { load_id: loadId },
      relations: ['load'],
    });
    if (!payment)
      throw new NotFoundException('Pago no encontrado para esta carga.');
    if (payment.load?.shipper_id !== shipper.id) throw new ForbiddenException();
    if (payment.status !== 'confirmed')
      throw new BadRequestException('El pago aún no fue confirmado.');

    return {
      delivery_code: payment.delivery_code,
      delivery_code_used: payment.delivery_code_used,
      payout_status: payment.payout_status ?? null,
    };
  }

  /** El transportista ingresa el código de entrega y elige cómo cobrar */
  async confirmDelivery(
    driverId: string,
    loadId: string,
    code: string,
    payoutMethod: string,
    payoutDestination: string,
  ) {
    // Verificar que el driver tiene una oferta aceptada en esta carga
    const offer = await this.offersRepo.findOne({
      where: { load_id: loadId, driver_id: driverId, status: 'accepted' },
    });
    if (!offer)
      throw new ForbiddenException(
        'No tenés una oferta aceptada en esta carga.',
      );

    const payment = await this.paymentsRepo.findOne({
      where: { load_id: loadId },
    });
    if (!payment) throw new NotFoundException('Pago no encontrado.');
    if (payment.status !== 'confirmed')
      throw new BadRequestException(
        'El pago del dador todavía no fue procesado.',
      );
    if (payment.delivery_code_used)
      throw new ConflictException('El código de entrega ya fue utilizado.');
    if (
      !payment.delivery_code ||
      payment.delivery_code !== code.toUpperCase().trim()
    ) {
      throw new BadRequestException('Código de entrega incorrecto.');
    }

    // Validar método de cobro
    if (!['cvu_cbu', 'mercadopago', 'alias'].includes(payoutMethod)) {
      throw new BadRequestException('Método de cobro inválido.');
    }
    if (!payoutDestination?.trim()) {
      throw new BadRequestException('Ingresá el destino del cobro.');
    }

    // Marcar código como usado y registrar datos de cobro
    payment.delivery_code_used = true;
    payment.payout_method = payoutMethod;
    payment.payout_destination = payoutDestination.trim();
    payment.payout_status = 'requested';
    await this.paymentsRepo.save(payment);

    // Marcar la carga como entregada
    const load = await this.loadsRepo.findOne({ where: { id: loadId } });
    if (load && load.status !== 'delivered') {
      load.status = 'delivered';
      await this.loadsRepo.save(load);
    }

    const COMMISSION_RATE = 0.1;
    const netAmount =
      Math.round(Number(payment.amount) * (1 - COMMISSION_RATE) * 100) / 100;

    const mpTransferUrl = this.buildMpTransferUrl(
      payoutMethod,
      payoutDestination.trim(),
      netAmount,
    );

    return {
      ok: true,
      payment_id: payment.id,
      amount: netAmount,
      payout_method: payoutMethod,
      payout_destination: payoutDestination.trim(),
      payout_status: 'requested',
      mp_transfer_url: mpTransferUrl,
    };
  }

  private buildMpTransferUrl(
    payoutMethod: string,
    payoutDestination: string,
    amount: number,
  ): string {
    // Link a la página de transferencias de MP con los datos pre-completados
    const base = 'https://www.mercadopago.com.ar/transfers/new';
    const params = new URLSearchParams({ amount: String(amount) });

    if (payoutMethod === 'mercadopago') {
      params.set('recipient', payoutDestination); // email o alias de MP
    } else {
      // cvu_cbu o alias bancario
      params.set('recipient', payoutDestination);
    }

    return `${base}?${params.toString()}`;
  }

  async markPayoutDone(paymentId: string) {
    const payment = await this.paymentsRepo.findOne({
      where: { id: paymentId },
    });
    if (!payment) throw new NotFoundException('Pago no encontrado.');

    payment.payout_status = 'done';
    await this.paymentsRepo.save(payment);
    return { ok: true };
  }

  async getAdminPayouts() {
    const payments = await this.paymentsRepo.find({
      where: [
        { payout_status: 'requested' },
        { payout_status: 'done' },
        { payout_status: 'transfer_failed' },
      ],
      relations: ['load', 'offer', 'offer.driver'],
      order: { created_at: 'DESC' },
    });

    return payments.map((p) => ({
      id: p.id,
      amount: Math.round(Number(p.amount) * 0.9 * 100) / 100,
      payout_status: p.payout_status,
      payout_method: p.payout_method,
      payout_destination: p.payout_destination,
      payout_transfer_id: p.payout_transfer_id ?? null,
      created_at: p.created_at,
      load_id: p.load_id,
      pickup_city: p.load?.pickup_city ?? null,
      dropoff_city: p.load?.dropoff_city ?? null,
      driver_name: p.offer?.driver?.name ?? null,
      driver_email: p.offer?.driver?.email ?? null,
      mp_transfer_url: null,
    }));
  }

  async getMyPayments(userId: string) {
    const shipper = await this.shippersRepo.findOne({
      where: { user_id: userId },
    });
    if (!shipper) throw new ForbiddenException();

    const payments = await this.paymentsRepo.find({
      where: { load: { shipper_id: shipper.id } },
      relations: ['load', 'offer', 'offer.driver'],
      order: { created_at: 'DESC' },
    });

    return payments.map((p) => ({
      id: p.id,
      offer_id: p.offer_id,
      amount: Number(p.amount),
      status: p.status,
      mp_preference_id: p.mp_preference_id,
      mp_payment_id: p.mp_payment_id,
      created_at: p.created_at,
      cargo_type: p.load?.cargo_type,
      pickup_city: p.load?.pickup_city,
      dropoff_city: p.load?.dropoff_city,
      driver_name: p.offer?.driver?.name ?? null,
    }));
  }

  async generateInvoicePdf(
    paymentId: string,
    userId: string,
    invoiceNumber: string,
  ): Promise<Buffer> {
    const shipper = await this.shippersRepo.findOne({
      where: { user_id: userId },
    });
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

    const assetsDir = join(__dirname, '..', 'assets');
    const fontR = join(assetsDir, 'Arial-Regular.ttf');
    const fontB = join(assetsDir, 'Arial-Bold.ttf');

    const emisionDate = new Date(payment.created_at).toLocaleDateString(
      'es-AR',
      {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      },
    );
    const viajeDate = load?.ready_at
      ? new Date(load.ready_at).toLocaleDateString('es-AR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
      : '-';
    const monto = Number(payment.amount);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 0, size: 'A4' });
      doc.registerFont('R', fontR);
      doc.registerFont('B', fontB);

      const chunks: Buffer[] = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const L = 40;
      const R = doc.page.width - 40;
      const W = R - L;
      const GREEN = '#3a806b';
      const GREEN2 = '#e0f0ea';
      const GREEN3 = '#ddeae4';
      const TEXT1 = '#0f1f19';
      const TEXT2 = '#4a6b5e';
      const BGPAGE = '#f4f7f5';
      const WHITE = '#ffffff';
      let y = 0;

      // ── Banda superior ────────────────────────────────────────
      doc.rect(0, 0, doc.page.width, 8).fill(GREEN);
      y = 24;

      // ── Cabecera: logo izq | bloque comprobante der ──────────
      doc
        .font('B')
        .fontSize(22)
        .fillColor(GREEN)
        .text('CargaBack', L, y, { continued: false });
      doc
        .font('R')
        .fontSize(8.5)
        .fillColor(TEXT2)
        .text('Plataforma de logística de cargas', L, y + 27);
      doc
        .font('R')
        .fontSize(8)
        .fillColor(TEXT2)
        .text(
          'CUIT: 30-00000000-0  ·  Cond. IVA: Responsable Inscripto',
          L,
          y + 39,
        );

      const cX = R - 210;
      doc.rect(cX, y - 4, 210, 68).fill(GREEN2);
      doc
        .font('B')
        .fontSize(8.5)
        .fillColor(GREEN)
        .text('COMPROBANTE DE SERVICIO', cX + 12, y + 4);
      doc
        .font('B')
        .fontSize(15)
        .fillColor(TEXT1)
        .text(invoiceNumber, cX + 12, y + 17);
      doc
        .font('R')
        .fontSize(7.5)
        .fillColor(TEXT2)
        .text(`Fecha de emisión: ${emisionDate}`, cX + 12, y + 40)
        .text(`Período del servicio: ${viajeDate}`, cX + 12, y + 52)
        .text(
          `N° operación MP: ${payment.mp_payment_id ?? '—'}`,
          cX + 12,
          y + 64,
        );

      y += 84;

      // ── Separador ─────────────────────────────────────────────
      doc.rect(L, y, W, 0.5).fill(GREEN3);
      y += 14;

      // ── Partes (dos columnas) ─────────────────────────────────
      const colW = (W - 12) / 2;

      doc
        .font('B')
        .fontSize(7)
        .fillColor(GREEN)
        .text('DADOR DE CARGA  (Comprador del servicio)', L, y)
        .text('TRANSPORTISTA  (Prestador del servicio)', L + colW + 12, y);
      y += 11;

      const boxH = 90;

      // Caja izquierda
      doc.rect(L, y, colW, boxH).fillAndStroke(BGPAGE, GREEN3);
      const lx = L + 12;
      let ly = y + 11;
      doc
        .font('B')
        .fontSize(9.5)
        .fillColor(TEXT1)
        .text(shipper.razon_social || dadorUser?.name || '—', lx, ly, {
          width: colW - 24,
        });
      ly += 15;
      doc.font('R').fontSize(8).fillColor(TEXT2);
      if (shipper.cuit) {
        doc.text(`CUIT: ${shipper.cuit}`, lx, ly, { width: colW - 24 });
        ly += 12;
      }
      if (shipper.cuil) {
        doc.text(`CUIL: ${shipper.cuil}`, lx, ly, { width: colW - 24 });
        ly += 12;
      }
      doc.text('Cond. IVA: Responsable Inscripto / Consumidor Final', lx, ly, {
        width: colW - 24,
      });
      ly += 12;
      if (shipper.address) {
        doc.text(shipper.address, lx, ly, { width: colW - 24 });
        ly += 12;
      }
      if (dadorUser?.email) {
        doc.text(dadorUser.email, lx, ly, { width: colW - 24 });
        ly += 12;
      }
      if (dadorUser?.phone) {
        doc.text(`Tel: ${dadorUser.phone}`, lx, ly, { width: colW - 24 });
      }

      // Caja derecha
      const rx = L + colW + 12;
      doc.rect(rx, y, colW, boxH).fillAndStroke(BGPAGE, GREEN3);
      let ry = y + 11;
      doc
        .font('B')
        .fontSize(9.5)
        .fillColor(TEXT1)
        .text(driver?.name || '—', rx + 12, ry, { width: colW - 24 });
      ry += 15;
      doc.font('R').fontSize(8).fillColor(TEXT2);
      if (driver?.dni) {
        doc.text(`DNI: ${driver.dni}`, rx + 12, ry, { width: colW - 24 });
        ry += 12;
      }
      doc.text(
        'Cond. IVA: Monotributista / Responsable Inscripto',
        rx + 12,
        ry,
        { width: colW - 24 },
      );
      ry += 12;
      if (driver?.email) {
        doc.text(driver.email, rx + 12, ry, { width: colW - 24 });
        ry += 12;
      }
      if (driver?.phone) {
        doc.text(`Tel: ${driver.phone}`, rx + 12, ry, { width: colW - 24 });
      }

      y += boxH + 14;

      // ── Tabla de servicios ────────────────────────────────────
      // Columnas: desc 0–57%, cant centro ~62%, precio unit 64–78%, total 78–100%
      const C1 = L + 10; // desc start
      const C2 = L + W * 0.615; // CANT. center
      const C3 = L + W * 0.72; // PRECIO UNIT. center
      const C4 = R - 10; // TOTAL right edge

      doc.rect(L, y, W, 22).fill(GREEN);
      doc
        .font('B')
        .fontSize(7.5)
        .fillColor(WHITE)
        .text('DESCRIPCIÓN DEL SERVICIO', C1, y + 7, { width: W * 0.56 })
        .text('CANT.', C2 - 20, y + 7, { width: 40, align: 'center' })
        .text('PRECIO UNIT.', C3 - 36, y + 7, { width: 72, align: 'center' })
        .text('TOTAL', C4 - 60, y + 7, { width: 60, align: 'right' });
      y += 22;

      const rowH = 58;
      const montoFmt = `$${monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
      const desc =
        `Servicio de transporte de carga\n` +
        `${load?.pickup_city ?? '—'} → ${load?.dropoff_city ?? '—'}` +
        (load?.cargo_type ? `\nTipo: ${load.cargo_type}` : '') +
        (load?.weight_kg
          ? `  ·  ${Number(load.weight_kg).toLocaleString('es-AR')} kg`
          : '');

      doc.rect(L, y, W, rowH).fillAndStroke(WHITE, GREEN3);
      doc
        .font('R')
        .fontSize(8)
        .fillColor(TEXT1)
        .text(desc, C1, y + 10, { width: W * 0.56, lineGap: 2.5 });
      const midRow = y + rowH / 2 - 5;
      doc
        .font('R')
        .fontSize(8.5)
        .fillColor(TEXT1)
        .text('1', C2 - 20, midRow, { width: 40, align: 'center' })
        .text(montoFmt, C3 - 36, midRow, { width: 72, align: 'right' })
        .text(montoFmt, C4 - 60, midRow, { width: 60, align: 'right' });
      y += rowH;

      // ── Forma de pago / Fecha ─────────────────────────────────
      doc.rect(L, y, W, 22).fillAndStroke(BGPAGE, GREEN3);
      doc
        .font('B')
        .fontSize(7.5)
        .fillColor(TEXT2)
        .text('FORMA DE PAGO:', C1, y + 7);
      doc
        .font('R')
        .fontSize(7.5)
        .fillColor(TEXT1)
        .text(
          `Contado — MercadoPago  ·  Fecha del servicio: ${viajeDate}`,
          C1 + 92,
          y + 7,
        );
      y += 22;

      // ── Subtotal / IVA / Total ────────────────────────────────
      y += 10;
      const totX = L + W * 0.52;
      const totW = R - totX;
      const valW = 90; // ancho fijo para columna de valores

      const drawTotRow = (
        label: string,
        val: string,
        bold = false,
        highlight = false,
      ) => {
        const rH = 24;
        if (highlight) {
          doc.rect(totX, y, totW, rH).fill(GREEN);
        } else {
          doc.rect(totX, y, totW, rH).fillAndStroke(BGPAGE, GREEN3);
        }
        const labelW = totW - valW - 16;
        doc
          .font(bold ? 'B' : 'R')
          .fontSize(bold ? 9 : 8)
          .fillColor(highlight ? WHITE : bold ? TEXT1 : TEXT2)
          .text(label, totX + 8, y + 7, { width: labelW })
          .text(val, totX + totW - valW, y + 7, {
            width: valW - 8,
            align: 'right',
          });
        y += rH;
      };

      drawTotRow('Subtotal neto', montoFmt);
      drawTotRow('IVA — Exento (art. 7 Ley 23.349)', '$ 0,00');
      drawTotRow('TOTAL ARS', montoFmt, true, true);

      y += 16;

      // ── Condiciones legales ───────────────────────────────────
      doc.rect(L, y, W, 0.5).fill(GREEN3);
      y += 12;
      doc
        .font('B')
        .fontSize(7.5)
        .fillColor(TEXT2)
        .text('CONDICIONES Y OBSERVACIONES', L, y);
      y += 11;
      doc
        .font('R')
        .fontSize(7)
        .fillColor(TEXT2)
        .text(
          'El servicio de transporte de cargas está exento de IVA conforme Ley 23.349, art. 7, inc. e) (transporte de cargas en el país).\n' +
            'Este comprobante acredita el pago realizado a través de la plataforma CargaBack y NO reemplaza la factura fiscal ' +
            'que el transportista debe emitir ante AFIP según su categoría impositiva.\n' +
            'Moneda: Peso Argentino (ARS). Precio final sin cargos adicionales. Ante consultas: soporte@cargaback.com',
          L,
          y,
          { width: W, lineGap: 2.5 },
        );

      // ── Footer ───────────────────────────────────────────────
      const footerY = doc.page.height - 36;
      doc.rect(0, footerY, doc.page.width, 36).fill(GREEN);
      doc
        .font('R')
        .fontSize(7)
        .fillColor(WHITE)
        .text(
          `CargaBack · Plataforma de logística · CUIT 30-00000000-0 · Responsable Inscripto · Comprobante ${invoiceNumber} · Emitido el ${emisionDate}`,
          L,
          footerY + 14,
          { align: 'center', width: W },
        );

      doc.end();
    });
  }
}
