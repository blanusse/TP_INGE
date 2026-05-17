import { getMetadataArgsStorage } from 'typeorm';
import { Offer } from './offer.entity';
import { Load } from './load.entity';
import { User } from './user.entity';
import { Truck } from './truck.entity';

describe('Offer', () => {
  it('can be instantiated with all properties including relations', () => {
    const offer = new Offer();
    offer.id = 'uuid-1';
    offer.load_id = 'uuid-load';
    offer.load = new Load();
    offer.driver_id = 'uuid-driver';
    offer.driver = new User();
    offer.truck_id = 'uuid-truck';
    offer.truck = new Truck();
    offer.assigned_driver_id = 'uuid-assigned';
    offer.assigned_driver = new User();
    offer.price = 100000;
    offer.counter_price = 95000;
    offer.note = 'Oferta inicial';
    offer.status = 'pending';
    offer.created_at = new Date();

    expect(offer.load).toBeInstanceOf(Load);
    expect(offer.driver).toBeInstanceOf(User);
    expect(offer.truck).toBeInstanceOf(Truck);
    expect(offer.assigned_driver).toBeInstanceOf(User);
    expect(offer.status).toBe('pending');
  });

  it('covers relation lambda functions via TypeORM metadata', () => {
    const storage = getMetadataArgsStorage();
    const relations = storage.relations.filter((r) => r.target === Offer);
    relations.forEach((r) => {
      if (typeof r.type === 'function') r.type();
    });
    expect(relations.length).toBeGreaterThan(0);
  });
});
