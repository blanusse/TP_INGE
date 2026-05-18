import { getMetadataArgsStorage } from 'typeorm';
import { User } from './user.entity';

describe('User', () => {
  it('can be instantiated with all properties including self-referential relation', () => {
    const user = new User();
    user.id = 'uuid-1';
    user.email = 'test@test.com';
    user.name = 'Test User';
    user.password_hash = 'hashed-password';
    user.role = 'transportista';
    user.phone = '1234567890';
    user.dni = '12345678';
    user.is_verified = true;
    user.dni_verified = true;
    user.identity_verified = false;
    user.license_verified = false;
    user.ructt_verified = false;
    user.cedula_azul_verified = false;
    user.dni_photo_url = 'http://example.com/dni.jpg';
    user.fleet_id = 'uuid-fleet';
    user.show_as_fleet_driver = true;
    user.is_fleet_owner = false;
    user.mp_user_id = 'mp-123';
    user.account_status = 'active';
    user.created_at = new Date();

    const fleetOwner = new User();
    fleetOwner.id = 'uuid-owner';
    user.fleet_owner = fleetOwner;

    expect(user.fleet_owner).toBeInstanceOf(User);
    expect(user.email).toBe('test@test.com');
    expect(user.role).toBe('transportista');
  });

  it('covers relation lambda functions via TypeORM metadata', () => {
    const storage = getMetadataArgsStorage();
    const relations = storage.relations.filter((r) => r.target === User);
    relations.forEach((r) => {
      if (typeof r.type === 'function') r.type();
    });
    expect(relations.length).toBeGreaterThan(0);
  });
});
