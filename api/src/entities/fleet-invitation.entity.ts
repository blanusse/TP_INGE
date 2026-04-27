import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

export type InvitationStatus = 'pending' | 'accepted' | 'expired';

@Entity('fleet_invitations')
export class FleetInvitation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  token: string;

  @Column()
  fleet_owner_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'fleet_owner_id' })
  fleet_owner: User;

  @Column()
  email: string;

  @Column({ type: 'varchar', default: 'pending' })
  status: InvitationStatus;

  @Column({ type: 'timestamptz' })
  expires_at: Date;

  @CreateDateColumn()
  created_at: Date;
}
