import { getMetadataArgsStorage } from 'typeorm';
import { Message } from './message.entity';

describe('Message', () => {
  it('can be instantiated with all properties', () => {
    const msg = new Message();
    msg.id = 'uuid-1';
    msg.offer_id = 'offer-uuid';
    msg.sender_id = 'user-uuid';
    msg.content = 'Hola, ¿cómo va?';
    msg.is_read = false;
    msg.created_at = new Date();

    expect(msg.content).toBe('Hola, ¿cómo va?');
    expect(msg.is_read).toBe(false);
  });

  it('covers relation lambda functions via TypeORM metadata', () => {
    const storage = getMetadataArgsStorage();
    const relations = storage.relations.filter((r) => r.target === Message);
    relations.forEach((r) => {
      if (typeof r.type === 'function') r.type();
    });
    expect(relations.length).toBeGreaterThan(0);
  });
});
