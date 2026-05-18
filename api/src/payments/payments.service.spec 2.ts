// PDFKit must be mocked before any imports (jest hoists this to the top)
jest.mock('pdfkit', () => {
  return jest.fn().mockImplementation(() => {
    const EventEmitter = require('events');
    const emitter = new EventEmitter();
    const doc: any = {
      page: { width: 595.28, height: 841.89 },
      registerFont: jest.fn().mockReturnThis(),
      font: jest.fn().mockReturnThis(),
      fontSize: jest.fn().mockReturnThis(),
      fillColor: jest.fn().mockReturnThis(),
      rect: jest.fn().mockReturnThis(),
      fill: jest.fn().mockReturnThis(),
      fillAndStroke: jest.fn().mockReturnThis(),
      stroke: jest.fn().mockReturnThis(),
      text: jest.fn().mockReturnThis(),
      on: jest.fn().mockImplementation((event: string, cb: (...args: any[]) => void) => {
        emitter.on(event, cb);
        return doc;
      }),
      end: jest.fn().mockImplementation(() => {
        setImmediate(() => emitter.emit('end'));
      }),
    };
    return doc;
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { Payment } from '../entities/payment.entity';
import { Offer } from '../entities/offer.entity';
import { Shipper } from '../entities/shipper.entity';
import { User } from '../entities/user.entity';
import { Load } from '../entities/load.entity';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRepo() {
  return {
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('PaymentsService', () => {
  let service: PaymentsService;
  let paymentsRepo: ReturnType<typeof makeRepo>;
  let offersRepo: ReturnType<typeof makeRepo>;
  let shippersRepo: ReturnType<typeof makeRepo>;
  let usersRepo: ReturnType<typeof makeRepo>;
  let loadsRepo: ReturnType<typeof makeRepo>;

  const OFFER_ID = 'offer-uuid-1';
  const LOAD_ID = 'load-uuid-1';
  const DRIVER_ID = 'driver-uuid-1';
  const SHIPPER_ID = 'shipper-uuid-1';
  const SHIPPER_USER_ID = 'shipper-user-uuid-1';

  beforeEach(async () => {
    paymentsRepo = makeRepo();
    offersRepo = makeRepo();
    shippersRepo = makeRepo();
    usersRepo = makeRepo();
    loadsRepo = makeRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: getRepositoryToken(Payment), useValue: paymentsRepo },
        { provide: getRepositoryToken(Offer), useValue: offersRepo },
        { provide: getRepositoryToken(Shipper), useValue: shippersRepo },
        { provide: getRepositoryToken(User), useValue: usersRepo },
        { provide: getRepositoryToken(Load), useValue: loadsRepo },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── createPayment ──────────────────────────────────────────────────────────

  describe('createPayment', () => {
    test('GIVEN oferta existente WHEN se registra el pago THEN se crea con status pending', async () => {
      // GIVEN
      const MOCK_OFFER = { id: OFFER_ID, load_id: LOAD_ID, driver_id: DRIVER_ID };
      offersRepo.findOne.mockResolvedValue(MOCK_OFFER);
      const savedPayment = {
        id: 'payment-1',
        offer_id: OFFER_ID,
        load_id: LOAD_ID,
        amount: 80_000,
        mp_preference_id: 'mp-pref-123',
        status: 'pending',
      };
      paymentsRepo.create.mockReturnValue(savedPayment);
      paymentsRepo.save.mockResolvedValue(savedPayment);

      // WHEN
      const result = await service.createPayment(OFFER_ID, 80_000, 'mp-pref-123');

      // THEN
      expect(result.status).toBe('pending');
      expect(result.offer_id).toBe(OFFER_ID);
      expect(paymentsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          offer_id: OFFER_ID,
          load_id: LOAD_ID,
          amount: 80_000,
          mp_preference_id: 'mp-pref-123',
          status: 'pending',
        }),
      );
      expect(paymentsRepo.save).toHaveBeenCalledTimes(1);
    });

    test('GIVEN oferta inexistente WHEN se intenta crear pago THEN lanza NotFoundException', async () => {
      // GIVEN
      offersRepo.findOne.mockResolvedValue(null);

      // WHEN / THEN
      await expect(service.createPayment(OFFER_ID, 80_000, 'mp-pref-123'))
        .rejects.toThrow(NotFoundException);
      expect(paymentsRepo.save).not.toHaveBeenCalled();
    });
  });

  // ── confirmDelivery ────────────────────────────────────────────────────────

  describe('confirmDelivery', () => {
    const DELIVERY_CODE = 'ABC12345';

    // Función helper — devuelve un objeto nuevo en cada llamada para evitar
    // que el servicio (que muta payment.delivery_code_used) contamine otros tests
    const makePayment = () => ({
      id: 'payment-1',
      load_id: LOAD_ID,
      offer_id: OFFER_ID,
      amount: 80_000,
      status: 'confirmed',
      delivery_code: DELIVERY_CODE,
      delivery_code_used: false,
    });

    test('DADO código de entrega correcto WHEN camionero confirma entrega THEN pago queda con payout_status requested', async () => {
      // GIVEN
      offersRepo.findOne.mockResolvedValue({
        id: OFFER_ID,
        load_id: LOAD_ID,
        driver_id: DRIVER_ID,
        status: 'accepted',
      });
      paymentsRepo.findOne.mockResolvedValueOnce(makePayment());
      const updatedPayment = {
        ...makePayment(),
        delivery_code_used: true,
        payout_status: 'requested',
        payout_method: 'cvu_cbu',
        payout_destination: '0000003100012345678901',
      };
      paymentsRepo.save.mockResolvedValueOnce(updatedPayment);
      // load update
      loadsRepo.findOne.mockResolvedValue({ id: LOAD_ID, status: 'in_transit', shipper_id: SHIPPER_ID });
      loadsRepo.save.mockResolvedValue({ id: LOAD_ID, status: 'delivered' });
      paymentsRepo.save.mockResolvedValueOnce(updatedPayment); // segunda llamada (double save)

      // WHEN
      const result = await service.confirmDelivery(
        DRIVER_ID, LOAD_ID, DELIVERY_CODE, 'cvu_cbu', '0000003100012345678901',
      );

      // THEN
      expect(result.ok).toBe(true);
      expect(result.payout_status).toBe('requested');
      expect(result.payout_method).toBe('cvu_cbu');
    });

    test('DADO código de entrega incorrecto WHEN camionero intenta confirmar THEN lanza BadRequestException', async () => {
      // GIVEN
      offersRepo.findOne.mockResolvedValue({
        id: OFFER_ID, load_id: LOAD_ID, driver_id: DRIVER_ID, status: 'accepted',
      });
      paymentsRepo.findOne.mockResolvedValue(makePayment());

      // WHEN / THEN
      await expect(
        service.confirmDelivery(DRIVER_ID, LOAD_ID, 'WRONG999', 'cvu_cbu', '0000003100012345678901'),
      ).rejects.toThrow(BadRequestException);
      expect(paymentsRepo.save).not.toHaveBeenCalled();
    });

    test('GIVEN código ya utilizado WHEN camionero intenta usar de nuevo THEN lanza ConflictException', async () => {
      // GIVEN
      offersRepo.findOne.mockResolvedValue({
        id: OFFER_ID, load_id: LOAD_ID, driver_id: DRIVER_ID, status: 'accepted',
      });
      paymentsRepo.findOne.mockResolvedValue({
        ...makePayment(),
        delivery_code_used: true, // ← ya usado
      });

      // WHEN / THEN
      await expect(
        service.confirmDelivery(DRIVER_ID, LOAD_ID, DELIVERY_CODE, 'cvu_cbu', '0000003100012345678901'),
      ).rejects.toThrow(ConflictException);
    });

    test('GIVEN pago no confirmado aún WHEN camionero intenta confirmar entrega THEN lanza BadRequestException', async () => {
      // GIVEN
      offersRepo.findOne.mockResolvedValue({
        id: OFFER_ID, load_id: LOAD_ID, driver_id: DRIVER_ID, status: 'accepted',
      });
      paymentsRepo.findOne.mockResolvedValue({
        ...makePayment(),
        status: 'pending', // ← pago no confirmado por MP
      });

      // WHEN / THEN
      await expect(
        service.confirmDelivery(DRIVER_ID, LOAD_ID, DELIVERY_CODE, 'cvu_cbu', '0000003100012345678901'),
      ).rejects.toThrow(BadRequestException);
    });

    test('GIVEN driver sin oferta aceptada en esa carga WHEN intenta confirmar THEN lanza ForbiddenException', async () => {
      // GIVEN
      offersRepo.findOne.mockResolvedValue(null); // no accepted offer found

      // WHEN / THEN
      await expect(
        service.confirmDelivery(DRIVER_ID, LOAD_ID, DELIVERY_CODE, 'cvu_cbu', '0000003100012345678901'),
      ).rejects.toThrow(ForbiddenException);
    });

    test('payment not found throws NotFoundException', async () => {
      offersRepo.findOne.mockResolvedValue({ id: OFFER_ID, load_id: LOAD_ID, driver_id: DRIVER_ID, status: 'accepted' });
      paymentsRepo.findOne.mockResolvedValue(null);
      await expect(
        service.confirmDelivery(DRIVER_ID, LOAD_ID, DELIVERY_CODE, 'cvu_cbu', 'dest'),
      ).rejects.toThrow(NotFoundException);
    });

    test('invalid payout method throws BadRequestException', async () => {
      const payment = { id: 'p-1', load_id: LOAD_ID, status: 'confirmed', delivery_code: DELIVERY_CODE, delivery_code_used: false, amount: 1000 };
      offersRepo.findOne.mockResolvedValue({ id: OFFER_ID, load_id: LOAD_ID, driver_id: DRIVER_ID, status: 'accepted' });
      paymentsRepo.findOne.mockResolvedValue(payment);
      await expect(
        service.confirmDelivery(DRIVER_ID, LOAD_ID, DELIVERY_CODE, 'invalid_method', 'dest'),
      ).rejects.toThrow(BadRequestException);
    });

    test('empty payout destination throws BadRequestException', async () => {
      const payment = { id: 'p-1', load_id: LOAD_ID, status: 'confirmed', delivery_code: DELIVERY_CODE, delivery_code_used: false, amount: 1000 };
      offersRepo.findOne.mockResolvedValue({ id: OFFER_ID, load_id: LOAD_ID, driver_id: DRIVER_ID, status: 'accepted' });
      paymentsRepo.findOne.mockResolvedValue(payment);
      await expect(
        service.confirmDelivery(DRIVER_ID, LOAD_ID, DELIVERY_CODE, 'mercadopago', '   '),
      ).rejects.toThrow(BadRequestException);
    });

    test('delivery with mercadopago sets mp_transfer_url with recipient', async () => {
      const payment = { id: 'p-1', load_id: LOAD_ID, status: 'confirmed', delivery_code: DELIVERY_CODE, delivery_code_used: false, amount: 10000 };
      offersRepo.findOne.mockResolvedValue({ id: OFFER_ID, load_id: LOAD_ID, driver_id: DRIVER_ID, status: 'accepted' });
      paymentsRepo.findOne.mockResolvedValue(payment);
      paymentsRepo.save.mockResolvedValue({ ...payment, delivery_code_used: true, payout_status: 'requested' });
      loadsRepo.findOne.mockResolvedValue({ id: LOAD_ID, status: 'delivered' }); // already delivered
      paymentsRepo.save.mockResolvedValue({ ...payment });

      const result = await service.confirmDelivery(DRIVER_ID, LOAD_ID, DELIVERY_CODE, 'mercadopago', 'user@mp.com');
      expect(result.mp_transfer_url).toContain('recipient=user%40mp.com');
    });

    test('delivery with alias sets mp_transfer_url with alias', async () => {
      const payment = { id: 'p-1', load_id: LOAD_ID, status: 'confirmed', delivery_code: DELIVERY_CODE, delivery_code_used: false, amount: 5000 };
      offersRepo.findOne.mockResolvedValue({ id: OFFER_ID, load_id: LOAD_ID, driver_id: DRIVER_ID, status: 'accepted' });
      paymentsRepo.findOne.mockResolvedValue(payment);
      paymentsRepo.save.mockResolvedValue(payment);
      loadsRepo.findOne.mockResolvedValue(null); // no load found
      paymentsRepo.save.mockResolvedValue(payment);

      const result = await service.confirmDelivery(DRIVER_ID, LOAD_ID, DELIVERY_CODE, 'alias', 'mi.alias.banco');
      expect(result.mp_transfer_url).toContain('mi.alias.banco');
    });

    test('null delivery_code throws BadRequestException', async () => {
      const payment = { id: 'p-1', load_id: LOAD_ID, status: 'confirmed', delivery_code: null, delivery_code_used: false, amount: 1000 };
      offersRepo.findOne.mockResolvedValue({ id: OFFER_ID, load_id: LOAD_ID, driver_id: DRIVER_ID, status: 'accepted' });
      paymentsRepo.findOne.mockResolvedValue(payment);
      await expect(
        service.confirmDelivery(DRIVER_ID, LOAD_ID, DELIVERY_CODE, 'cvu_cbu', 'dest'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── confirmPayment ──────────────────────────────────────────────────────────

  describe('confirmPayment', () => {
    test('payment not found throws NotFoundException', async () => {
      paymentsRepo.findOne.mockResolvedValue(null);
      await expect(service.confirmPayment(OFFER_ID)).rejects.toThrow(NotFoundException);
    });

    test('sets status confirmed and generates delivery code when none exists', async () => {
      const payment = { id: 'p-1', offer_id: OFFER_ID, status: 'pending', delivery_code: null };
      paymentsRepo.findOne
        .mockResolvedValueOnce(payment)   // find payment by offer_id
        .mockResolvedValueOnce(null);     // code collision check → not found → unique
      paymentsRepo.save.mockResolvedValue({ ...payment, status: 'confirmed', delivery_code: 'XXXXXXXX' });

      const result = await service.confirmPayment(OFFER_ID, 'mp-pay-1');
      expect(paymentsRepo.save).toHaveBeenCalled();
      expect(payment.status).toBe('confirmed');
    });

    test('skips code generation when delivery_code already exists', async () => {
      const payment = { id: 'p-1', offer_id: OFFER_ID, status: 'pending', delivery_code: 'EXISTING1' };
      paymentsRepo.findOne.mockResolvedValueOnce(payment);
      paymentsRepo.save.mockResolvedValue({ ...payment, status: 'confirmed' });

      await service.confirmPayment(OFFER_ID);
      // findOne called only once (for the payment lookup), NOT again for collision check
      expect(paymentsRepo.findOne).toHaveBeenCalledTimes(1);
    });

    test('retries code generation on collision', async () => {
      const payment = { id: 'p-1', offer_id: OFFER_ID, status: 'pending', delivery_code: null };
      paymentsRepo.findOne
        .mockResolvedValueOnce(payment)          // find payment
        .mockResolvedValueOnce({ id: 'other' }) // first code collides
        .mockResolvedValueOnce(null);            // second code is unique
      paymentsRepo.save.mockResolvedValue({ ...payment, status: 'confirmed' });

      await service.confirmPayment(OFFER_ID);
      expect(paymentsRepo.findOne).toHaveBeenCalledTimes(3);
    });
  });

  // ── getDeliveryCode ─────────────────────────────────────────────────────────

  describe('getDeliveryCode', () => {
    test('shipper not found throws ForbiddenException', async () => {
      shippersRepo.findOne.mockResolvedValue(null);
      await expect(service.getDeliveryCode('u-1', LOAD_ID)).rejects.toThrow(ForbiddenException);
    });

    test('payment not found throws NotFoundException', async () => {
      shippersRepo.findOne.mockResolvedValue({ id: SHIPPER_ID, user_id: SHIPPER_USER_ID });
      paymentsRepo.findOne.mockResolvedValue(null);
      await expect(service.getDeliveryCode(SHIPPER_USER_ID, LOAD_ID)).rejects.toThrow(NotFoundException);
    });

    test('load shipper mismatch throws ForbiddenException', async () => {
      shippersRepo.findOne.mockResolvedValue({ id: SHIPPER_ID, user_id: SHIPPER_USER_ID });
      paymentsRepo.findOne.mockResolvedValue({
        id: 'p-1',
        load: { shipper_id: 'other-shipper' },
        status: 'confirmed',
        delivery_code: 'ABC12345',
      });
      await expect(service.getDeliveryCode(SHIPPER_USER_ID, LOAD_ID)).rejects.toThrow(ForbiddenException);
    });

    test('payment not confirmed throws BadRequestException', async () => {
      shippersRepo.findOne.mockResolvedValue({ id: SHIPPER_ID, user_id: SHIPPER_USER_ID });
      paymentsRepo.findOne.mockResolvedValue({
        id: 'p-1',
        load: { shipper_id: SHIPPER_ID },
        status: 'pending',
        delivery_code: 'ABC12345',
      });
      await expect(service.getDeliveryCode(SHIPPER_USER_ID, LOAD_ID)).rejects.toThrow(BadRequestException);
    });

    test('returns delivery code info when valid', async () => {
      shippersRepo.findOne.mockResolvedValue({ id: SHIPPER_ID, user_id: SHIPPER_USER_ID });
      paymentsRepo.findOne.mockResolvedValue({
        id: 'p-1',
        load: { shipper_id: SHIPPER_ID },
        status: 'confirmed',
        delivery_code: 'ABC12345',
        delivery_code_used: false,
        payout_status: 'requested',
      });

      const result = await service.getDeliveryCode(SHIPPER_USER_ID, LOAD_ID);
      expect(result.delivery_code).toBe('ABC12345');
      expect(result.payout_status).toBe('requested');
    });

    test('returns null payout_status when payout_status is undefined', async () => {
      shippersRepo.findOne.mockResolvedValue({ id: SHIPPER_ID, user_id: SHIPPER_USER_ID });
      paymentsRepo.findOne.mockResolvedValue({
        id: 'p-1',
        load: { shipper_id: SHIPPER_ID },
        status: 'confirmed',
        delivery_code: 'XYZ',
        delivery_code_used: false,
        payout_status: undefined,
      });
      const result = await service.getDeliveryCode(SHIPPER_USER_ID, LOAD_ID);
      expect(result.payout_status).toBeNull();
    });
  });

  // ── markPayoutDone ──────────────────────────────────────────────────────────

  describe('markPayoutDone', () => {
    test('payment not found throws NotFoundException', async () => {
      paymentsRepo.findOne.mockResolvedValue(null);
      await expect(service.markPayoutDone('pay-1')).rejects.toThrow(NotFoundException);
    });

    test('sets payout_status to done and returns ok', async () => {
      const payment = { id: 'pay-1', payout_status: 'requested' };
      paymentsRepo.findOne.mockResolvedValue(payment);
      paymentsRepo.save.mockResolvedValue({ ...payment, payout_status: 'done' });

      const result = await service.markPayoutDone('pay-1');
      expect(result).toEqual({ ok: true });
      expect(payment.payout_status).toBe('done');
    });
  });

  // ── getAdminPayouts ─────────────────────────────────────────────────────────

  describe('getAdminPayouts', () => {
    test('returns mapped payout list with net amounts', async () => {
      const payments = [
        {
          id: 'p-1',
          amount: 10000,
          payout_status: 'requested',
          payout_method: 'cvu_cbu',
          payout_destination: '0001234',
          payout_transfer_id: null,
          created_at: new Date(),
          load_id: LOAD_ID,
          load: { pickup_city: 'BA', dropoff_city: 'CBA' },
          offer: { driver: { name: 'Pedro', email: 'p@e.com' } },
        },
      ];
      paymentsRepo.find.mockResolvedValue(payments);

      const result = await service.getAdminPayouts();
      expect(result).toHaveLength(1);
      expect(result[0].amount).toBe(9000); // 10000 * 0.9
      expect(result[0].driver_name).toBe('Pedro');
      expect(result[0].mp_transfer_url).toBeNull();
    });

    test('handles missing load and driver gracefully', async () => {
      const payments = [
        {
          id: 'p-2', amount: 5000, payout_status: 'done', payout_method: 'alias',
          payout_destination: 'mi.alias', payout_transfer_id: 'T-001', created_at: new Date(),
          load_id: LOAD_ID, load: null, offer: null,
        },
      ];
      paymentsRepo.find.mockResolvedValue(payments);
      const result = await service.getAdminPayouts();
      expect(result[0].pickup_city).toBeNull();
      expect(result[0].driver_name).toBeNull();
    });
  });

  // ── getMyPayments ───────────────────────────────────────────────────────────

  describe('getMyPayments', () => {
    test('shipper not found throws ForbiddenException', async () => {
      shippersRepo.findOne.mockResolvedValue(null);
      await expect(service.getMyPayments('u-1')).rejects.toThrow(ForbiddenException);
    });

    test('returns mapped payments with load and driver info', async () => {
      shippersRepo.findOne.mockResolvedValue({ id: SHIPPER_ID, user_id: SHIPPER_USER_ID });
      paymentsRepo.find.mockResolvedValue([
        {
          id: 'p-1', offer_id: OFFER_ID, amount: 8000, status: 'confirmed',
          mp_preference_id: 'mp-1', mp_payment_id: 'mp-pay-1', created_at: new Date(),
          load: { cargo_type: 'granos', pickup_city: 'BA', dropoff_city: 'CBA' },
          offer: { driver: { name: 'Pedro' } },
        },
      ]);

      const result = await service.getMyPayments(SHIPPER_USER_ID);
      expect(result).toHaveLength(1);
      expect(result[0].driver_name).toBe('Pedro');
      expect(result[0].cargo_type).toBe('granos');
    });

    test('handles missing driver gracefully', async () => {
      shippersRepo.findOne.mockResolvedValue({ id: SHIPPER_ID, user_id: SHIPPER_USER_ID });
      paymentsRepo.find.mockResolvedValue([
        {
          id: 'p-2', offer_id: OFFER_ID, amount: 5000, status: 'pending',
          mp_preference_id: 'mp-2', mp_payment_id: null, created_at: new Date(),
          load: null, offer: null,
        },
      ]);
      const result = await service.getMyPayments(SHIPPER_USER_ID);
      expect(result[0].driver_name).toBeNull();
    });
  });

  // ── generateInvoicePdf ──────────────────────────────────────────────────────

  describe('generateInvoicePdf', () => {
    const PAYMENT_ID = 'pay-uuid-1';
    const baseShipper = { id: SHIPPER_ID, user_id: SHIPPER_USER_ID, razon_social: 'Empresa SA', cuit: '30-1234', cuil: null, address: 'Calle 1', tipo: 'empresa' };
    const basePayment = {
      id: PAYMENT_ID,
      amount: 50000,
      created_at: new Date('2025-01-15'),
      mp_payment_id: 'mp-pay-1',
      load: {
        shipper_id: SHIPPER_ID,
        pickup_city: 'BA',
        dropoff_city: 'CBA',
        cargo_type: 'granos',
        weight_kg: 5000,
        ready_at: new Date('2025-01-10'),
      },
      offer: { driver: { name: 'Pedro', dni: '12345678', email: 'p@e.com', phone: '1122334455' } },
    };
    const dadorUser = { id: SHIPPER_USER_ID, name: 'Carlos', email: 'c@e.com', phone: '1199887766' };

    test('shipper not found throws ForbiddenException', async () => {
      shippersRepo.findOne.mockResolvedValue(null);
      await expect(service.generateInvoicePdf(PAYMENT_ID, 'u-1', 'F-001')).rejects.toThrow(ForbiddenException);
    });

    test('payment not found throws NotFoundException', async () => {
      shippersRepo.findOne.mockResolvedValue(baseShipper);
      paymentsRepo.findOne.mockResolvedValue(null);
      await expect(service.generateInvoicePdf(PAYMENT_ID, SHIPPER_USER_ID, 'F-001')).rejects.toThrow(NotFoundException);
    });

    test('payment load shipper mismatch throws ForbiddenException', async () => {
      shippersRepo.findOne.mockResolvedValue(baseShipper);
      paymentsRepo.findOne.mockResolvedValue({ ...basePayment, load: { shipper_id: 'other-shipper' } });
      await expect(service.generateInvoicePdf(PAYMENT_ID, SHIPPER_USER_ID, 'F-001')).rejects.toThrow(ForbiddenException);
    });

    test('generates PDF buffer successfully (full shipper fields)', async () => {
      shippersRepo.findOne.mockResolvedValue(baseShipper);
      paymentsRepo.findOne.mockResolvedValue(basePayment);
      usersRepo.findOne.mockResolvedValue(dadorUser);

      const result = await service.generateInvoicePdf(PAYMENT_ID, SHIPPER_USER_ID, 'F-0001-001');
      expect(Buffer.isBuffer(result)).toBe(true);
    });

    test('generates PDF with cuil field present', async () => {
      shippersRepo.findOne.mockResolvedValue({ ...baseShipper, cuil: '27-1234-5' });
      paymentsRepo.findOne.mockResolvedValue(basePayment);
      usersRepo.findOne.mockResolvedValue(dadorUser);

      const result = await service.generateInvoicePdf(PAYMENT_ID, SHIPPER_USER_ID, 'F-0001-003');
      expect(Buffer.isBuffer(result)).toBe(true);
    });

    test('generates PDF when optional fields are missing (no cuit, no address, no driver details, no ready_at)', async () => {
      shippersRepo.findOne.mockResolvedValue({ ...baseShipper, cuit: null, cuil: null, address: null });
      paymentsRepo.findOne.mockResolvedValue({
        ...basePayment,
        mp_payment_id: null,
        load: { ...basePayment.load, ready_at: null, weight_kg: null, cargo_type: null },
        offer: { driver: { name: 'Pedro', dni: null, email: null, phone: null } },
      });
      usersRepo.findOne.mockResolvedValue({ ...dadorUser, email: null, phone: null });

      const result = await service.generateInvoicePdf(PAYMENT_ID, SHIPPER_USER_ID, 'F-0001-002');
      expect(Buffer.isBuffer(result)).toBe(true);
    });
  });
});
