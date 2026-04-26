import { Injectable, NotFoundException, ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common';
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

  private static readonly CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin O/0/I/1
  private static readonly CODE_LENGTH = 8;

  private generateDeliveryCode(): string {
    let code = '';
    for (let i = 0; i < PaymentsService.CODE_LENGTH; i++) {
      code += PaymentsService.CODE_CHARS[Math.floor(Math.random() * PaymentsService.CODE_CHARS.length)];
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

  async confirmPayment(offerId: string, mpPaymentId?: string) {
    const payment = await this.paymentsRepo.findOne({ where: { offer_id: offerId } });
    if (!payment) throw new NotFoundException('Pago no encontrado.');

    payment.status = 'confirmed';
    if (mpPaymentId) payment.mp_payment_id = mpPaymentId;

    // Generar código de entrega único si todavía no tiene uno
    if (!payment.delivery_code) {
      let code: string;
      let attempts = 0;
      do {
        code = this.generateDeliveryCode();
        const exists = await this.paymentsRepo.findOne({ where: { delivery_code: code } });
        if (!exists) break;
        attempts++;
      } while (attempts < 10);
      payment.delivery_code = code;
    }

    return this.paymentsRepo.save(payment);
  }

  /** El dador obtiene el código de entrega de una carga (para mostrarlo en su panel) */
  async getDeliveryCode(userId: string, loadId: string) {
    const shipper = await this.shippersRepo.findOne({ where: { user_id: userId } });
    if (!shipper) throw new ForbiddenException();

    const payment = await this.paymentsRepo.findOne({
      where: { load_id: loadId },
      relations: ['load'],
    });
    if (!payment) throw new NotFoundException('Pago no encontrado para esta carga.');
    if (payment.load?.shipper_id !== shipper.id) throw new ForbiddenException();
    if (payment.status !== 'confirmed') throw new BadRequestException('El pago aún no fue confirmado.');

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
    if (!offer) throw new ForbiddenException('No tenés una oferta aceptada en esta carga.');

    const payment = await this.paymentsRepo.findOne({ where: { load_id: loadId } });
    if (!payment) throw new NotFoundException('Pago no encontrado.');
    if (payment.status !== 'confirmed') throw new BadRequestException('El pago del dador todavía no fue procesado.');
    if (payment.delivery_code_used) throw new ConflictException('El código de entrega ya fue utilizado.');
    if (!payment.delivery_code || payment.delivery_code !== code.toUpperCase().trim()) {
      throw new BadRequestException('Código de entrega incorrecto.');
    }

    // Validar método de cobro
    if (!['cvu_cbu', 'mercadopago'].includes(payoutMethod)) {
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

    // Intentar la transferencia a MercadoPago
    const transfer = await this.initiatePayoutTransfer(payment, payoutMethod, payoutDestination.trim());
    if (transfer.success && transfer.transferId) {
      payment.payout_status = 'done';
      payment.payout_transfer_id = transfer.transferId;
    } else if (transfer.mpError === 'MP_ACCESS_TOKEN no configurado') {
      payment.payout_status = 'requested';
    } else {
      // Guardar el error en payout_transfer_id para debugging (si no hay otro uso)
      payment.payout_status = 'transfer_failed';
      payment.payout_transfer_id = `ERR|${transfer.httpStatus ?? 0}|${(transfer.mpError ?? '').slice(0, 100)}`;
    }
    await this.paymentsRepo.save(payment);

    return {
      ok: true,
      amount: Number(payment.amount),
      payout_method: payoutMethod,
      transfer_initiated: transfer.success,
      transfer_id: transfer.transferId ?? null,
      transfer_error: transfer.success ? null : {
        httpStatus: transfer.httpStatus,
        message: transfer.mpError,
        rawBody: transfer.rawBody,
      },
    };
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
    const fontR = join(assetsDir, 'Roboto-Regular.ttf');
    const fontB = join(assetsDir, 'Roboto-Bold.ttf');

    const emisionDate = new Date(payment.created_at).toLocaleDateString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
    const viajeDate = load?.ready_at
      ? new Date(load.ready_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
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

      const L = 40;           // left margin
      const R = doc.page.width - 40; // right edge
      const W = R - L;        // usable width
      const GREEN  = '#1a7a52';
      const GREEN2 = '#e8f5ee';
      const GRAY1  = '#374151';
      const GRAY2  = '#6b7280';
      const GRAY3  = '#f3f4f6';
      const BLACK  = '#111827';
      const WHITE  = '#ffffff';
      let y = 0;

      // ── Banda superior verde ──────────────────────────────────
      doc.rect(0, 0, doc.page.width, 8).fill(GREEN);
      y = 24;

      // ── Cabecera: logo izq | datos comprobante der ──────────
      // Logo / nombre app
      doc.font('B').fontSize(22).fillColor(GREEN).text('CargaBack', L, y, { continued: false });
      doc.font('R').fontSize(9).fillColor(GRAY2).text('Plataforma de logística de cargas · cargaback.up.railway.app', L, y + 26);

      // Bloque comprobante (derecha)
      const cX = R - 200;
      doc.rect(cX, y - 4, 200, 58).fill(GREEN2);
      doc.font('B').fontSize(9).fillColor(GREEN).text('COMPROBANTE DE SERVICIO', cX + 10, y + 2);
      doc.font('B').fontSize(16).fillColor(BLACK).text(invoiceNumber, cX + 10, y + 14);
      doc.font('R').fontSize(8).fillColor(GRAY2)
        .text(`Fecha de emisión: ${emisionDate}`, cX + 10, y + 36)
        .text(`N° pago MP: ${payment.mp_payment_id ?? 'Pendiente'}`, cX + 10, y + 48);

      y += 72;

      // ── Línea divisoria ───────────────────────────────────────
      doc.rect(L, y, W, 0.5).fill('#d1fae5');
      y += 14;

      // ── Datos de las partes (dos columnas) ───────────────────
      const colW = (W - 16) / 2;

      // Título columnas
      doc.font('B').fontSize(7.5).fillColor(GREEN)
        .text('DADOR DE CARGA', L, y)
        .text('TRANSPORTISTA', L + colW + 16, y);
      y += 12;

      // Caja izquierda
      doc.rect(L, y, colW, 90).fill(GRAY3);
      const lx = L + 12;
      let ly = y + 12;
      doc.font('B').fontSize(10).fillColor(BLACK).text(shipper.razon_social || dadorUser?.name || '-', lx, ly, { width: colW - 24 });
      ly += 16;
      doc.font('R').fontSize(8.5).fillColor(GRAY2);
      if (shipper.cuit)    { doc.text(`CUIT: ${shipper.cuit}`,   lx, ly, { width: colW - 24 }); ly += 13; }
      if (shipper.cuil)    { doc.text(`CUIL: ${shipper.cuil}`,   lx, ly, { width: colW - 24 }); ly += 13; }
      if (shipper.address) { doc.text(shipper.address,           lx, ly, { width: colW - 24 }); ly += 13; }
      if (dadorUser?.email){ doc.text(dadorUser.email,           lx, ly, { width: colW - 24 }); ly += 13; }
      if (dadorUser?.phone){ doc.text(`Tel: ${dadorUser.phone}`, lx, ly, { width: colW - 24 }); }

      // Caja derecha
      const rx = L + colW + 16;
      doc.rect(rx, y, colW, 90).fill(GRAY3);
      let ry = y + 12;
      doc.font('B').fontSize(10).fillColor(BLACK).text(driver?.name || '-', rx + 12, ry, { width: colW - 24 });
      ry += 16;
      doc.font('R').fontSize(8.5).fillColor(GRAY2);
      if (driver?.email) { doc.text(driver.email,              rx + 12, ry, { width: colW - 24 }); ry += 13; }
      if (driver?.phone) { doc.text(`Tel: ${driver.phone}`,   rx + 12, ry, { width: colW - 24 }); ry += 13; }
      if (driver?.dni)   { doc.text(`DNI: ${driver.dni}`,     rx + 12, ry, { width: colW - 24 }); }

      y += 104;

      // ── Tabla de servicios ────────────────────────────────────
      // Encabezado tabla
      doc.rect(L, y, W, 22).fill(GREEN);
      doc.font('B').fontSize(8).fillColor(WHITE)
        .text('DESCRIPCIÓN DEL SERVICIO', L + 10, y + 7)
        .text('CANTIDAD', L + W * 0.6, y + 7)
        .text('IMPORTE', L + W * 0.78, y + 7)
        .text('TOTAL', R - 55, y + 7);
      y += 22;

      const serviceRows: [string, string, string, string][] = [
        [
          `Servicio de transporte de carga\n${load?.pickup_city ?? '-'} → ${load?.dropoff_city ?? '-'}` +
          (load?.cargo_type ? `\nTipo: ${load.cargo_type}` : '') +
          (load?.weight_kg  ? `  ·  ${Number(load.weight_kg).toLocaleString('es-AR')} kg` : ''),
          '1',
          `$${monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`,
          `$${monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`,
        ],
      ];

      serviceRows.forEach(([desc, qty, price, total], i) => {
        const rowH = 52;
        doc.rect(L, y, W, rowH).fill(i % 2 === 0 ? WHITE : GRAY3);
        // border
        doc.rect(L, y, W, rowH).stroke('#e5e7eb');
        doc.font('R').fontSize(8.5).fillColor(GRAY1)
          .text(desc, L + 10, y + 8, { width: W * 0.56, lineGap: 2 });
        doc.font('R').fontSize(8.5).fillColor(GRAY1)
          .text(qty,   L + W * 0.6 + 4, y + 16)
          .text(price, L + W * 0.78 + 4, y + 16)
          .text(total, R - 50, y + 16);
        y += rowH;
      });

      // Fila fecha viaje
      doc.rect(L, y, W, 28).fill(GRAY3).stroke('#e5e7eb');
      doc.font('B').fontSize(8).fillColor(GRAY2).text('Fecha del servicio:', L + 10, y + 9);
      doc.font('R').fontSize(8.5).fillColor(GRAY1).text(viajeDate, L + 130, y + 9);
      y += 28;

      // ── Subtotal / IVA / Total ────────────────────────────────
      y += 10;
      const totX = L + W * 0.55;
      const totW = R - totX;

      const drawTotRow = (label: string, val: string, bold = false, highlight = false) => {
        if (highlight) doc.rect(totX, y, totW, 26).fill(GREEN);
        doc.font(bold ? 'B' : 'R').fontSize(bold ? 9.5 : 8.5)
          .fillColor(highlight ? WHITE : bold ? BLACK : GRAY2)
          .text(label, totX + 10, y + 6, { width: totW * 0.55 })
          .text(val,   totX + totW * 0.55, y + 6, { width: totW * 0.42, align: 'right' });
        y += 26;
      };

      drawTotRow('Subtotal (sin IVA)', `$${monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`);
      drawTotRow('IVA (Responsable Inscripto — exento en fletes)', '$ 0,00');
      drawTotRow('TOTAL A PAGAR', `$${monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })} ARS`, true, true);

      y += 20;

      // ── Condiciones ──────────────────────────────────────────
      doc.rect(L, y, W, 0.5).fill('#d1fae5');
      y += 12;
      doc.font('B').fontSize(8).fillColor(GRAY2).text('CONDICIONES Y OBSERVACIONES', L, y);
      y += 12;
      doc.font('R').fontSize(7.5).fillColor(GRAY2).text(
        'El servicio de transporte de carga está exento de IVA según Ley 23.349 art. 7 inc. e) — ' +
        'Transporte internacional y de cargas del país.\n' +
        'El pago fue procesado mediante MercadoPago. Este comprobante no reemplaza la factura fiscal ' +
        'emitida por el transportista ante AFIP.\n' +
        'En caso de reclamos, comunicarse a: soporte@cargaback.com',
        L, y, { width: W, lineGap: 2 },
      );

      // ── Footer ───────────────────────────────────────────────
      const footerY = doc.page.height - 36;
      doc.rect(0, footerY, doc.page.width, 36).fill(GREEN);
      doc.font('R').fontSize(7.5).fillColor(WHITE)
        .text(
          `CargaBack · Plataforma de logística · cargaback.up.railway.app  ·  Comprobante ${invoiceNumber}  ·  Emitido el ${emisionDate}`,
          L, footerY + 13, { align: 'center', width: W },
        );

      doc.end();
    });
  }
}
