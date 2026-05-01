import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

export type ReportReason = 'fraud' | 'non_delivery' | 'harassment' | 'fake_data' | 'other';
export type ReportStatus = 'pending' | 'under_review' | 'resolved' | 'dismissed';
export type AdminAction = 'none' | 'warned' | 'suspended' | 'banned';

@Entity('reports')
export class Report {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  reporter_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'reporter_id' })
  reporter: User;

  @Column({ type: 'uuid' })
  reported_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'reported_id' })
  reported: User;

  @Column({ type: 'varchar' })
  reason: ReportReason;

  @Column({ type: 'text' })
  description: string;

  @Column({ nullable: true, type: 'varchar' })
  evidence_url: string;

  @Column({ type: 'varchar', default: 'pending' })
  status: ReportStatus;

  @Column({ nullable: true, type: 'varchar' })
  admin_action: AdminAction;

  @Column({ nullable: true, type: 'text' })
  admin_notes: string;

  @CreateDateColumn()
  created_at: Date;

  @Column({ nullable: true, type: 'timestamp' })
  resolved_at: Date;
}
