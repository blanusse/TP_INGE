import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';
import { filter, map } from 'rxjs/operators';

@Injectable()
export class LocationService {
  private readonly updates$ = new Subject<{ loadId: string; lat: number; lng: number }>();

  emit(loadId: string, lat: number, lng: number) {
    this.updates$.next({ loadId, lat, lng });
  }

  stream(loadId: string) {
    return this.updates$.pipe(
      filter((u) => u.loadId === loadId),
      map((u) => ({ data: { lat: u.lat, lng: u.lng } })),
    );
  }
}
