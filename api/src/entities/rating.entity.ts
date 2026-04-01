import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,
  CreateDateColumn, Unique,
} from 'typeorm';
import { Load } from './load.entity';
import { Offer } from './offer.entity';
import { User } from './user.entity';

@Entity('ratings')
@Unique(['offer_id', 'from_user_id'])
export class Rating {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  load_id: string;

  @ManyToOne(() => Load)
  @JoinColumn({ name: 'load_id' })
  load: Load;

  @Column({ type: 'uuid' })
  offer_id: string;

  @ManyToOne(() => Offer)
  @JoinColumn({ name: 'offer_id' })
  offer: Offer;

  @Column({ type: 'uuid' })
  from_user_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'from_user_id' })
  from_user: User;

  @Column({ type: 'uuid' })
  to_user_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'to_user_id' })
  to_user: User;

  @Column({ type: 'int' })
  score: number;

  @CreateDateColumn()
  created_at: Date;
}
