import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn,
} from 'typeorm';
import { Shipper } from './shipper.entity';

export type LoadStatus = 'available' | 'matched' | 'in_transit' | 'delivered' | 'cancelled';

@Entity('loads')
export class Load {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  shipper_id: string;

  @ManyToOne(() => Shipper)
  @JoinColumn({ name: 'shipper_id' })
  shipper: Shipper;

  // Public zone info (visible to all drivers)
  @Column()
  pickup_city: string;

  @Column()
  dropoff_city: string;

  // Exact addresses (revealed only to the accepted driver)
  @Column({ nullable: true })
  pickup_exact: string;

  @Column({ nullable: true })
  dropoff_exact: string;

  @Column({ nullable: true, type: 'decimal', precision: 10, scale: 6 })
  pickup_lat: number;

  @Column({ nullable: true, type: 'decimal', precision: 10, scale: 6 })
  pickup_lon: number;

  @Column({ nullable: true, type: 'decimal', precision: 10, scale: 6 })
  dropoff_lat: number;

  @Column({ nullable: true, type: 'decimal', precision: 10, scale: 6 })
  dropoff_lon: number;

  @Column({ nullable: true })
  cargo_type: string;

  @Column({ nullable: true })
  truck_type_required: string;

  @Column({ nullable: true, type: 'decimal', precision: 10, scale: 2 })
  weight_kg: number;

  @Column({ nullable: true, type: 'decimal', precision: 12, scale: 2 })
  price_base: number;

  @Column({ nullable: true, type: 'timestamptz' })
  ready_at: Date;

  @Column({ nullable: true, type: 'text' })
  description: string;

  @Column({ type: 'varchar', default: 'available' })
  status: LoadStatus;

  @CreateDateColumn()
  created_at: Date;
}
