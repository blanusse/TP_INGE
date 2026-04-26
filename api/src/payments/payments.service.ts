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

  /** Intenta hacer la transferencia al transportista vía MercadoPago.
   *
   *  MP Argentina usa POST /v1/bank_transfers para enviar a CBU/CVU/alias
   *  (incluyendo cuentas MP, que también tienen CVU).
   *  Para cuentas MP por email primero se resuelve el CVU asociado.
   *
   *  Requiere que la cuenta de MP de la plataforma tenga saldo suficiente
   *  y los permisos de "Money Out" habilitados (solo cuentas de empresa).
   *
   *  Devuelve { success, transferId?, httpStatus?, mpError?, rawBody? }
   *  — nunca lanza excepción para no interrumpir la confirmación de entrega. */
  private async initiatePayoutTransfer(
    payment: Payment,
    payoutMethod: string,
    payoutDestination: string,
  ): Promise<{ success: boolean; transferId?: string; httpStatus?: number; mpError?: string; rawBody?: string }> {
    const mpToken = process.env.MP_ACCESS_TOKEN;
    if (!mpToken) return { success: false, mpError: 'MP_ACCESS_TOKEN no configurado' };

    const amount = Number(payment.amount);
    const idempotencyKey = `payout-${payment.id}`;
    const description = `CargaBack — servicio de transporte ref. ${payment.id.slice(0, 8)}`;

    // Determinar si el destino es un alias (letras/puntos/guiones) o CBU/CVU (22 dígitos)
    const isCBU = /^\d{22}$/.test(payoutDestination.trim());

    // Para ambos métodos (CVU/CBU y MP alias) usamos /v1/bank_transfers.
    // Las cuentas MP en AR tienen CVU, así que un alias de MP también funciona aquí.
    const body: Record<string, unknown> = {
      amount,
      description,
      external_reference: idempotencyKey,
      bank_account: isCBU
        ? { cbu: payoutDestination.trim() }
        : { alias: payoutDestination.trim() },
    };

    try {
      const res = await fetch('https://api.mercadopago.com/v1/bank_transfers', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${mpToken}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(body),
      });

      const rawText = await res.text();
      let data: Record<string, unknown> = {};
      try { data = JSON.parse(rawText); } catch { /* no-op */ }

      console.log(`[payout] ${res.status} → ${rawText.slice(0, 300)}`);

      if ((res.status === 200 || res.status === 201) && data.id) {
        return { success: true, transferId: String(data.id), httpStatus: res.status };
      }
      return {
        success: false,
        httpStatus: res.status,
        mpError: (data.message as string) ?? (data.error as string) ?? `HTTP ${res.status}`,
        rawBody: rawText.slice(0, 500),
      };
    } catch (err) {
      return { success: false, mpError: String(err) };
    }
  }

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
    const fontR = join(assetsDir, 'Arial-Regular.ttf');
    const fontB = join(assetsDir, 'Arial-Bold.ttf');

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

      const L = 40;
      const R = doc.page.width - 40;
      const W = R - L;
      const GREEN  = '#3a806b';
      const GREEN2 = '#e0f0ea';
      const GREEN3 = '#ddeae4';
      const TEXT1  = '#0f1f19';
      const TEXT2  = '#4a6b5e';
      const BGPAGE = '#f4f7f5';
      const WHITE  = '#ffffff';
      let y = 0;

      // ── Banda superior ────────────────────────────────────────
      doc.rect(0, 0, doc.page.width, 8).fill(GREEN);
      y = 24;

      // ── Cabecera: logo izq | bloque comprobante der ──────────
      doc.font('B').fontSize(22).fillColor(GREEN).text('CargaBack', L, y, { continued: false });
      doc.font('R').fontSize(8.5).fillColor(TEXT2).text('Plataforma de logística de cargas', L, y + 27);
      doc.font('R').fontSize(8).fillColor(TEXT2).text('CUIT: 30-00000000-0  ·  Cond. IVA: Responsable Inscripto', L, y + 39);

      const cX = R - 210;
      doc.rect(cX, y - 4, 210, 68).fill(GREEN2);
      doc.font('B').fontSize(8.5).fillColor(GREEN).text('COMPROBANTE DE SERVICIO', cX + 12, y + 4);
      doc.font('B').fontSize(15).fillColor(TEXT1).text(invoiceNumber, cX + 12, y + 17);
      doc.font('R').fontSize(7.5).fillColor(TEXT2)
        .text(`Fecha de emisión: ${emisionDate}`, cX + 12, y + 40)
        .text(`Período del servicio: ${viajeDate}`, cX + 12, y + 52)
        .text(`N° operación MP: ${payment.mp_payment_id ?? '—'}`, cX + 12, y + 64);

      y += 84;

      // ── Separador ─────────────────────────────────────────────
      doc.rect(L, y, W, 0.5).fill(GREEN3);
      y += 14;

      // ── Partes (dos columnas) ─────────────────────────────────
      const colW = (W - 12) / 2;

      doc.font('B').fontSize(7).fillColor(GREEN)
        .text('DADOR DE CARGA  (Comprador del servicio)', L, y)
        .text('TRANSPORTISTA  (Prestador del servicio)', L + colW + 12, y);
      y += 11;

      const boxH = 90;

      // Caja izquierda
      doc.rect(L, y, colW, boxH).fillAndStroke(BGPAGE, GREEN3);
      const lx = L + 12;
      let ly = y + 11;
      doc.font('B').fontSize(9.5).fillColor(TEXT1).text(shipper.razon_social || dadorUser?.name || '—', lx, ly, { width: colW - 24 });
      ly += 15;
      doc.font('R').fontSize(8).fillColor(TEXT2);
      if (shipper.cuit)    { doc.text(`CUIT: ${shipper.cuit}`,           lx, ly, { width: colW - 24 }); ly += 12; }
      if (shipper.cuil)    { doc.text(`CUIL: ${shipper.cuil}`,           lx, ly, { width: colW - 24 }); ly += 12; }
      doc.text('Cond. IVA: Responsable Inscripto / Consumidor Final',     lx, ly, { width: colW - 24 }); ly += 12;
      if (shipper.address) { doc.text(shipper.address,                   lx, ly, { width: colW - 24 }); ly += 12; }
      if (dadorUser?.email){ doc.text(dadorUser.email,                   lx, ly, { width: colW - 24 }); ly += 12; }
      if (dadorUser?.phone){ doc.text(`Tel: ${dadorUser.phone}`,         lx, ly, { width: colW - 24 }); }

      // Caja derecha
      const rx = L + colW + 12;
      doc.rect(rx, y, colW, boxH).fillAndStroke(BGPAGE, GREEN3);
      let ry = y + 11;
      doc.font('B').fontSize(9.5).fillColor(TEXT1).text(driver?.name || '—', rx + 12, ry, { width: colW - 24 });
      ry += 15;
      doc.font('R').fontSize(8).fillColor(TEXT2);
      if (driver?.dni)   { doc.text(`DNI: ${driver.dni}`,               rx + 12, ry, { width: colW - 24 }); ry += 12; }
      doc.text('Cond. IVA: Monotributista / Responsable Inscripto',      rx + 12, ry, { width: colW - 24 }); ry += 12;
      if (driver?.email) { doc.text(driver.email,                       rx + 12, ry, { width: colW - 24 }); ry += 12; }
      if (driver?.phone) { doc.text(`Tel: ${driver.phone}`,             rx + 12, ry, { width: colW - 24 }); }

      y += boxH + 14;

      // ── Tabla de servicios ────────────────────────────────────
      // Columnas: desc 0–57%, cant centro ~62%, precio unit 64–78%, total 78–100%
      const C1 = L + 10;           // desc start
      const C2 = L + W * 0.615;   // CANT. center
      const C3 = L + W * 0.72;    // PRECIO UNIT. center
      const C4 = R - 10;           // TOTAL right edge

      doc.rect(L, y, W, 22).fill(GREEN);
      doc.font('B').fontSize(7.5).fillColor(WHITE)
        .text('DESCRIPCIÓN DEL SERVICIO', C1, y + 7, { width: W * 0.56 })
        .text('CANT.',       C2 - 20, y + 7, { width: 40,  align: 'center' })
        .text('PRECIO UNIT.', C3 - 36, y + 7, { width: 72, align: 'center' })
        .text('TOTAL',        C4 - 60, y + 7, { width: 60,  align: 'right' });
      y += 22;

      const rowH = 58;
      const montoFmt = `$${monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
      const desc =
        `Servicio de transporte de carga\n` +
        `${load?.pickup_city ?? '—'} → ${load?.dropoff_city ?? '—'}` +
        (load?.cargo_type ? `\nTipo: ${load.cargo_type}` : '') +
        (load?.weight_kg  ? `  ·  ${Number(load.weight_kg).toLocaleString('es-AR')} kg` : '');

      doc.rect(L, y, W, rowH).fillAndStroke(WHITE, GREEN3);
      doc.font('R').fontSize(8).fillColor(TEXT1)
        .text(desc, C1, y + 10, { width: W * 0.56, lineGap: 2.5 });
      const midRow = y + rowH / 2 - 5;
      doc.font('R').fontSize(8.5).fillColor(TEXT1)
        .text('1',        C2 - 20, midRow, { width: 40,  align: 'center' })
        .text(montoFmt,   C3 - 36, midRow, { width: 72,  align: 'right' })
        .text(montoFmt,   C4 - 60, midRow, { width: 60,  align: 'right' });
      y += rowH;

      // ── Forma de pago / Fecha ─────────────────────────────────
      doc.rect(L, y, W, 22).fillAndStroke(BGPAGE, GREEN3);
      doc.font('B').fontSize(7.5).fillColor(TEXT2).text('FORMA DE PAGO:', C1, y + 7);
      doc.font('R').fontSize(7.5).fillColor(TEXT1)
        .text(`Contado — MercadoPago  ·  Fecha del servicio: ${viajeDate}`, C1 + 92, y + 7);
      y += 22;

      // ── Subtotal / IVA / Total ────────────────────────────────
      y += 10;
      const totX = L + W * 0.52;
      const totW = R - totX;
      const valW = 90; // ancho fijo para columna de valores

      const drawTotRow = (label: string, val: string, bold = false, highlight = false) => {
        const rH = 24;
        if (highlight) {
          doc.rect(totX, y, totW, rH).fill(GREEN);
        } else {
          doc.rect(totX, y, totW, rH).fillAndStroke(BGPAGE, GREEN3);
        }
        const labelW = totW - valW - 16;
        doc.font(bold ? 'B' : 'R').fontSize(bold ? 9 : 8)
          .fillColor(highlight ? WHITE : bold ? TEXT1 : TEXT2)
          .text(label, totX + 8,            y + 7, { width: labelW })
          .text(val,   totX + totW - valW,  y + 7, { width: valW - 8, align: 'right' });
        y += rH;
      };

      drawTotRow('Subtotal neto', montoFmt);
      drawTotRow('IVA — Exento (art. 7 Ley 23.349)', '$ 0,00');
      drawTotRow('TOTAL ARS', montoFmt, true, true);

      y += 16;

      // ── Condiciones legales ───────────────────────────────────
      doc.rect(L, y, W, 0.5).fill(GREEN3);
      y += 12;
      doc.font('B').fontSize(7.5).fillColor(TEXT2).text('CONDICIONES Y OBSERVACIONES', L, y);
      y += 11;
      doc.font('R').fontSize(7).fillColor(TEXT2).text(
        'El servicio de transporte de cargas está exento de IVA conforme Ley 23.349, art. 7, inc. e) (transporte de cargas en el país).\n' +
        'Este comprobante acredita el pago realizado a través de la plataforma CargaBack y NO reemplaza la factura fiscal ' +
        'que el transportista debe emitir ante AFIP según su categoría impositiva.\n' +
        'Moneda: Peso Argentino (ARS). Precio final sin cargos adicionales. Ante consultas: soporte@cargaback.com',
        L, y, { width: W, lineGap: 2.5 },
      );

      // ── Footer ───────────────────────────────────────────────
      const footerY = doc.page.height - 36;
      doc.rect(0, footerY, doc.page.width, 36).fill(GREEN);
      doc.font('R').fontSize(7).fillColor(WHITE)
        .text(
          `CargaBack · Plataforma de logística · CUIT 30-00000000-0 · Responsable Inscripto · Comprobante ${invoiceNumber} · Emitido el ${emisionDate}`,
          L, footerY + 14, { align: 'center', width: W },
        );

      doc.end();
    });
  }
}
