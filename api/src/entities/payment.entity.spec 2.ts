import { getMetadataArgsStorage } from 'typeorm';
import { Payment } from './payment.entity';
import { Offer } from './offer.entity';
import { Load } from './load.entity';

describe('Payment', () => {
  it('can be instantiated with all properties including relations', () => {
    const payment = new Payment();
    payment.id = 'uuid-1';
    payment.offer_id = 'uuid-offer';
    payment.offer = new Offer();
    payment.load_id = 'uuid-load';
    payment.load = new Load();
    payment.amount = 100000;
    payment.mp_preference_id = 'pref-123';
    payment.mp_payment_id = 'pay-456';
    payment.status = 'pending';
    payment.delivery_code = 'ABC123';
    payment.delivery_code_used = false;
    payment.payout_method = 'cvu_cbu';
    payment.payout_destination = '1234567890';
    payment.payout_status = 'requested';
    payment.payout_transfer_id = 'transfer-789';
    payment.created_at = new Date();

    expect(payment.offer).toBeInstanceOf(Offer);
    expect(payment.load).toBeInstanceOf(Load);
    expect(payment.status).toBe('pending');
  });

  it('covers relation lambda functions via TypeORM metadata', () => {
    const storage = getMetadataArgsStorage();
    const relations = storage.relations.filter((r) => r.target === Payment);
    relations.forEach((r) => {
      if (typeof r.type === 'function') r.type();
    });
    expect(relations.length).toBeGreaterThan(0);
  });
});
