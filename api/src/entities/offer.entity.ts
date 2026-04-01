import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,
  CreateDateColumn, Unique,
} from 'typeorm';
import { Load } from './load.entity';
import { User } from './user.entity';
import { Truck } from './truck.entity';

export type OfferStatus = 'pending' | 'countered' | 'accepted' | 'rejected' | 'withdrawn';

@Entity('offers')
@Unique(['load_id', 'driver_id'])
export class Offer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  load_id: string;

  @ManyToOne(() => Load)
  @JoinColumn({ name: 'load_id' })
  load: Load;

  @Column({ type: 'uuid' })
  driver_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'driver_id' })
  driver: User;

  @Column({ nullable: true, type: 'uuid' })
  truck_id: string;

  @ManyToOne(() => Truck, { nullable: true })
  @JoinColumn({ name: 'truck_id' })
  truck: Truck;

  @Column({ nullable: true, type: 'uuid' })
  assigned_driver_id: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'assigned_driver_id' })
  assigned_driver: User;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  price: number;

  @Column({ nullable: true, type: 'decimal', precision: 12, scale: 2 })
  counter_price: number;

  @Column({ nullable: true, type: 'text' })
  note: string;

  @Column({ type: 'varchar', default: 'pending' })
  status: OfferStatus;

  @CreateDateColumn()
  created_at: Date;
}
