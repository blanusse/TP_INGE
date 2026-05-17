import { getMetadataArgsStorage } from 'typeorm';
import { Report } from './report.entity';

describe('Report', () => {
  it('can be instantiated with all properties', () => {
    const report = new Report();
    report.id = 'uuid-1';
    report.reporter_id = 'reporter-uuid';
    report.reported_id = 'reported-uuid';
    report.reason = 'fraud';
    report.description = 'Datos falsos presentados';
    report.evidence_url = 'http://example.com/img.jpg';
    report.status = 'pending';
    report.admin_action = 'none';
    report.admin_notes = 'En revisión';
    report.created_at = new Date();
    report.resolved_at = null;

    expect(report.reason).toBe('fraud');
    expect(report.status).toBe('pending');
  });

  it('covers relation lambda functions via TypeORM metadata', () => {
    const storage = getMetadataArgsStorage();
    const relations = storage.relations.filter((r) => r.target === Report);
    relations.forEach((r) => {
      if (typeof r.type === 'function') r.type();
    });
    expect(relations.length).toBeGreaterThan(0);
  });
});
