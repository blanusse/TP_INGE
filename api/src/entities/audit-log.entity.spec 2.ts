import { AuditLog } from './audit-log.entity';

describe('AuditLog', () => {
  it('can be instantiated with all properties', () => {
    const log = new AuditLog();
    log.id = 'uuid-1';
    log.admin_id = 'uuid-admin';
    log.admin_email = 'admin@test.com';
    log.target_user_id = 'uuid-user';
    log.target_user_email = 'user@test.com';
    log.action = 'suspend';
    log.reason = 'violated terms';
    log.created_at = new Date();

    expect(log.action).toBe('suspend');
    expect(log.admin_email).toBe('admin@test.com');
  });
});
