import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Offer } from './offer.entity';
import { Load } from './load.entity';

export type PaymentStatus = 'pending' | 'confirmed';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  offer_id: string;

  @ManyToOne(() => Offer)
  @JoinColumn({ name: 'offer_id' })
  offer: Offer;

  @Column({ type: 'uuid' })
  load_id: string;

  @ManyToOne(() => Load)
  @JoinColumn({ name: 'load_id' })
  load: Load;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', nullable: true })
  mp_preference_id: string;

  @Column({ type: 'varchar', nullable: true })
  mp_payment_id: string;

  @Column({ type: 'varchar', default: 'pending' })
  status: PaymentStatus;

  @CreateDateColumn()
  created_at: Date;
}
