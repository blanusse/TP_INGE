import { TripLocation } from './trip-location.entity';

describe('TripLocation', () => {
  it('can be instantiated and properties assigned', () => {
    const entity = new TripLocation();
    entity.load_id = 'load-1';
    entity.lat = 10.5;
    entity.lng = 20.3;
    entity.updated_at = new Date('2024-01-01');

    expect(entity.load_id).toBe('load-1');
    expect(entity.lat).toBe(10.5);
    expect(entity.lng).toBe(20.3);
    expect(entity.updated_at).toBeInstanceOf(Date);
  });
});
