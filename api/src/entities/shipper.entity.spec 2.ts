import { getMetadataArgsStorage } from 'typeorm';
import { Shipper } from './shipper.entity';
import { User } from './user.entity';

describe('Shipper', () => {
  it('can be instantiated with all properties including relations', () => {
    const shipper = new Shipper();
    shipper.id = 'uuid-1';
    shipper.user_id = 'uuid-user';
    shipper.user = new User();
    shipper.tipo = 'empresa';
    shipper.razon_social = 'Empresa SA';
    shipper.cuit = '30-12345678-9';
    shipper.cuil = '20-12345678-3';
    shipper.address = 'Av. Test 123';

    expect(shipper.user).toBeInstanceOf(User);
    expect(shipper.tipo).toBe('empresa');
  });

  it('covers relation lambda functions via TypeORM metadata', () => {
    const storage = getMetadataArgsStorage();
    const relations = storage.relations.filter((r) => r.target === Shipper);
    relations.forEach((r) => {
      if (typeof r.type === 'function') r.type();
    });
    expect(relations.length).toBeGreaterThan(0);
  });
});
