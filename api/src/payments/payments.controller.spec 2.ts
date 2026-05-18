import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { UnauthorizedException } from '@nestjs/common';

const mockService = {
  createPayment: jest.fn(),
  confirmPayment: jest.fn(),
  getMyPayments: jest.fn(),
  getDeliveryCode: jest.fn(),
  confirmDelivery: jest.fn(),
  getAdminPayouts: jest.fn(),
  markPayoutDone: jest.fn(),
  generateInvoicePdf: jest.fn(),
};

const mockReq = (role = 'dador') => ({ user: { id: 'user-1', role, email: 'a@b.com' } });
const INTERNAL_SECRET = 'secret-123';

describe('PaymentsController', () => {
  let controller: PaymentsController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [{ provide: PaymentsService, useValue: mockService }],
    }).compile();
    controller = module.get<PaymentsController>(PaymentsController);
  });

  it('should be defined', () => expect(controller).toBeDefined());

  // ── createPayment ─────────────────────────────────────────────────────────

  it('createPayment delegates to service', () => {
    mockService.createPayment.mockReturnValue({ id: 'pay-1' });
    controller.createPayment({ offerId: 'o-1', amount: 5000, mpPreferenceId: 'mp-1' });
    expect(mockService.createPayment).toHaveBeenCalledWith('o-1', 5000, 'mp-1');
  });

  // ── confirmPayment ────────────────────────────────────────────────────────

  it('confirmPayment delegates to service with optional mpPaymentId', () => {
    mockService.confirmPayment.mockReturnValue({ status: 'confirmed' });
    controller.confirmPayment('o-1', { mpPaymentId: 'mp-pay-1' });
    expect(mockService.confirmPayment).toHaveBeenCalledWith('o-1', 'mp-pay-1');
  });

  // ── confirmPaymentInternal ─────────────────────────────────────────────────

  describe('confirmPaymentInternal', () => {
    beforeEach(() => { process.env.INTERNAL_SECRET = INTERNAL_SECRET; });

    it('confirms with correct secret', () => {
      mockService.confirmPayment.mockReturnValue({});
      controller.confirmPaymentInternal('o-1', { mpPaymentId: 'mp-1' }, INTERNAL_SECRET);
      expect(mockService.confirmPayment).toHaveBeenCalledWith('o-1', 'mp-1');
    });

    it('throws UnauthorizedException with wrong secret', () => {
      expect(() => controller.confirmPaymentInternal('o-1', {}, 'wrong')).toThrow(UnauthorizedException);
    });
  });

  // ── getMyPayments ─────────────────────────────────────────────────────────

  it('getMyPayments delegates to service', () => {
    mockService.getMyPayments.mockReturnValue([]);
    controller.getMyPayments(mockReq() as any);
    expect(mockService.getMyPayments).toHaveBeenCalledWith('user-1');
  });

  // ── getDeliveryCode ───────────────────────────────────────────────────────

  it('getDeliveryCode delegates to service', () => {
    mockService.getDeliveryCode.mockReturnValue({ delivery_code: 'ABC12345' });
    controller.getDeliveryCode(mockReq() as any, 'load-1');
    expect(mockService.getDeliveryCode).toHaveBeenCalledWith('user-1', 'load-1');
  });

  // ── confirmDelivery ───────────────────────────────────────────────────────

  it('confirmDelivery delegates to service', () => {
    mockService.confirmDelivery.mockReturnValue({ ok: true });
    const body = { loadId: 'l-1', code: 'ABC12345', payoutMethod: 'mercadopago', payoutDestination: 'user@mp.com' };
    controller.confirmDelivery(mockReq() as any, body);
    expect(mockService.confirmDelivery).toHaveBeenCalledWith('user-1', 'l-1', 'ABC12345', 'mercadopago', 'user@mp.com');
  });

  // ── getAdminPayouts ───────────────────────────────────────────────────────

  describe('getAdminPayouts', () => {
    beforeEach(() => { process.env.INTERNAL_SECRET = INTERNAL_SECRET; });

    it('admin role can access payouts', () => {
      mockService.getAdminPayouts.mockReturnValue([]);
      controller.getAdminPayouts(mockReq('admin') as any, INTERNAL_SECRET);
      expect(mockService.getAdminPayouts).toHaveBeenCalled();
    });

    it('correct internal secret can access payouts without admin role', () => {
      mockService.getAdminPayouts.mockReturnValue([]);
      controller.getAdminPayouts(mockReq('dador') as any, INTERNAL_SECRET);
      expect(mockService.getAdminPayouts).toHaveBeenCalled();
    });

    it('throws UnauthorizedException when not admin and wrong secret', () => {
      expect(() => controller.getAdminPayouts(mockReq('dador') as any, 'wrong'))
        .toThrow(UnauthorizedException);
    });
  });

  // ── markPaid ──────────────────────────────────────────────────────────────

  describe('markPaid', () => {
    beforeEach(() => { process.env.INTERNAL_SECRET = INTERNAL_SECRET; });

    it('admin can mark payment as paid', () => {
      mockService.markPayoutDone.mockReturnValue({ ok: true });
      controller.markPaid('pay-1', mockReq('admin') as any, INTERNAL_SECRET);
      expect(mockService.markPayoutDone).toHaveBeenCalledWith('pay-1');
    });

    it('correct internal secret can mark payment without admin role', () => {
      mockService.markPayoutDone.mockReturnValue({ ok: true });
      controller.markPaid('pay-1', mockReq('dador') as any, INTERNAL_SECRET);
      expect(mockService.markPayoutDone).toHaveBeenCalledWith('pay-1');
    });

    it('throws UnauthorizedException when not admin and wrong secret', () => {
      expect(() => controller.markPaid('pay-1', mockReq('dador') as any, 'wrong'))
        .toThrow(UnauthorizedException);
    });
  });

  // ── downloadInvoice ───────────────────────────────────────────────────────

  it('downloadInvoice generates PDF and sends response', async () => {
    const buffer = Buffer.from('PDF content');
    mockService.generateInvoicePdf.mockResolvedValue(buffer);
    const res = { set: jest.fn(), end: jest.fn() };

    await controller.downloadInvoice('pay-1', 'F-0001-001', mockReq() as any, res as any);

    expect(mockService.generateInvoicePdf).toHaveBeenCalledWith('pay-1', 'user-1', 'F-0001-001');
    expect(res.set).toHaveBeenCalledWith(expect.objectContaining({ 'Content-Type': 'application/pdf' }));
    expect(res.end).toHaveBeenCalledWith(buffer);
  });

  it('downloadInvoice uses paymentId as filename fallback when numero is undefined', async () => {
    const buffer = Buffer.from('PDF');
    mockService.generateInvoicePdf.mockResolvedValue(buffer);
    const res = { set: jest.fn(), end: jest.fn() };

    await controller.downloadInvoice('pay-1', undefined as any, mockReq() as any, res as any);

    expect(mockService.generateInvoicePdf).toHaveBeenCalledWith('pay-1', 'user-1', 'F-0000-000');
    expect(res.set).toHaveBeenCalledWith(
      expect.objectContaining({ 'Content-Disposition': expect.stringContaining('pay-1') }),
    );
  });
});
