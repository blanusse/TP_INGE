import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('trip_locations')
export class TripLocation {
  @PrimaryColumn()
  load_id: string;

  @Column({ type: 'decimal', precision: 10, scale: 6 })
  lat: number;

  @Column({ type: 'decimal', precision: 10, scale: 6 })
  lng: number;

  @UpdateDateColumn()
  updated_at: Date;
}
