import { getMetadataArgsStorage } from 'typeorm';
import { Truck } from './truck.entity';
import { User } from './user.entity';

describe('Truck', () => {
  it('can be instantiated with all properties including relations', () => {
    const truck = new Truck();
    truck.id = 'uuid-1';
    truck.owner_id = 'uuid-owner';
    truck.owner = new User();
    truck.patente = 'ABC123';
    truck.marca = 'Ford';
    truck.modelo = 'Cargo';
    truck.año = 2020;
    truck.truck_type = 'camion';
    truck.capacity_kg = 10000;
    truck.vtv_vence = '2025-12-31';
    truck.seguro_poliza = 'POL-001';
    truck.seguro_vence = '2025-12-31';
    truck.patente_remolque = 'REM456';
    truck.vtv_doc_url = 'http://example.com/vtv.pdf';
    truck.seguro_doc_url = 'http://example.com/seguro.pdf';
    truck.vtv_verified = true;
    truck.seguro_verified = true;
    truck.cedula_verde_verified = true;

    expect(truck.owner).toBeInstanceOf(User);
    expect(truck.patente).toBe('ABC123');
  });

  it('covers relation lambda functions via TypeORM metadata', () => {
    const storage = getMetadataArgsStorage();
    const relations = storage.relations.filter((r) => r.target === Truck);
    relations.forEach((r) => {
      if (typeof r.type === 'function') r.type();
    });
    expect(relations.length).toBeGreaterThan(0);
  });
});
