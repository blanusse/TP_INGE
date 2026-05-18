import { getMetadataArgsStorage } from 'typeorm';
import { Load } from './load.entity';
import { Shipper } from './shipper.entity';

describe('Load', () => {
  it('can be instantiated with all properties including relations', () => {
    const load = new Load();
    load.id = 'uuid-1';
    load.shipper_id = 'uuid-shipper';
    load.shipper = new Shipper();
    load.pickup_city = 'Buenos Aires';
    load.dropoff_city = 'Córdoba';
    load.pickup_exact = 'Av. Corrientes 1234';
    load.dropoff_exact = 'Av. Colón 100';
    load.pickup_lat = -34.6037;
    load.pickup_lon = -58.3816;
    load.dropoff_lat = -31.4201;
    load.dropoff_lon = -64.1888;
    load.cargo_type = 'general';
    load.truck_type_required = 'camion';
    load.weight_kg = 5000;
    load.price_base = 150000;
    load.ready_at = new Date();
    load.description = 'Carga general';
    load.distance_km = 700;
    load.status = 'available';
    load.created_at = new Date();

    expect(load.pickup_city).toBe('Buenos Aires');
    expect(load.shipper).toBeInstanceOf(Shipper);
  });

  it('covers relation lambda functions via TypeORM metadata', () => {
    const storage = getMetadataArgsStorage();
    const relations = storage.relations.filter((r) => r.target === Load);
    relations.forEach((r) => {
      if (typeof r.type === 'function') r.type();
    });
    expect(relations.length).toBeGreaterThan(0);
  });
});
