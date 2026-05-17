import { getMetadataArgsStorage } from 'typeorm';
import { Rating } from './rating.entity';
import { Load } from './load.entity';
import { Offer } from './offer.entity';
import { User } from './user.entity';

describe('Rating', () => {
  it('can be instantiated with all properties including relations', () => {
    const rating = new Rating();
    rating.id = 'uuid-1';
    rating.load_id = 'uuid-load';
    rating.load = new Load();
    rating.offer_id = 'uuid-offer';
    rating.offer = new Offer();
    rating.from_user_id = 'uuid-from';
    rating.from_user = new User();
    rating.to_user_id = 'uuid-to';
    rating.to_user = new User();
    rating.score = 5;
    rating.created_at = new Date();

    expect(rating.load).toBeInstanceOf(Load);
    expect(rating.offer).toBeInstanceOf(Offer);
    expect(rating.from_user).toBeInstanceOf(User);
    expect(rating.to_user).toBeInstanceOf(User);
    expect(rating.score).toBe(5);
  });

  it('covers relation lambda functions via TypeORM metadata', () => {
    const storage = getMetadataArgsStorage();
    const relations = storage.relations.filter((r) => r.target === Rating);
    relations.forEach((r) => {
      if (typeof r.type === 'function') r.type();
    });
    expect(relations.length).toBeGreaterThan(0);
  });
});
