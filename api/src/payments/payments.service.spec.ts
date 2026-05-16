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
  });
});
