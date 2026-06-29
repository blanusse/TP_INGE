import { Test, TestingModule } from '@nestjs/testing';
import { LocationService } from './location.service';
import { firstValueFrom, take, toArray } from 'rxjs';

describe('LocationService', () => {
  let service: LocationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LocationService],
    }).compile();

    service = module.get<LocationService>(LocationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('emits and streams location updates for a loadId', async () => {
    const stream$ = service.stream('load-1').pipe(take(1));
    const resultPromise = firstValueFrom(stream$);

    service.emit('load-1', 10.5, 20.3);

    const result = await resultPromise;
    expect(result).toEqual({ data: { lat: 10.5, lng: 20.3 } });
  });

  it('filters out updates for other loadIds', async () => {
    const collected: unknown[] = [];
    const sub = service.stream('load-A').subscribe((v) => collected.push(v));

    service.emit('load-B', 1, 2);
    service.emit('load-A', 3, 4);

    sub.unsubscribe();
    expect(collected).toHaveLength(1);
    expect(collected[0]).toEqual({ data: { lat: 3, lng: 4 } });
  });
});
