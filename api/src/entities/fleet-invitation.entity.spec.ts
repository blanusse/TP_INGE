import { getMetadataArgsStorage } from 'typeorm';
import { FleetInvitation } from './fleet-invitation.entity';

describe('FleetInvitation', () => {
  it('can be instantiated with all properties', () => {
    const inv = new FleetInvitation();
    inv.id = 'uuid-1';
    inv.token = 'tok-abc';
    inv.fleet_owner_id = 'owner-uuid';
    inv.email = 'driver@test.com';
    inv.status = 'pending';
    inv.expires_at = new Date();
    inv.created_at = new Date();

    expect(inv.token).toBe('tok-abc');
    expect(inv.status).toBe('pending');
  });

  it('covers relation lambda functions via TypeORM metadata', () => {
    const storage = getMetadataArgsStorage();
    const relations = storage.relations.filter((r) => r.target === FleetInvitation);
    relations.forEach((r) => {
      if (typeof r.type === 'function') r.type();
    });
    expect(relations.length).toBeGreaterThan(0);
  });
});
