import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  admin_id: string;

  @Column({ type: 'varchar' })
  admin_email: string;

  @Column({ type: 'uuid' })
  target_user_id: string;

  @Column({ type: 'varchar' })
  target_user_email: string;

  /** suspend | unsuspend | ban | unban */
  @Column({ type: 'varchar' })
  action: string;

  @Column({ nullable: true, type: 'varchar' })
  reason: string | null;

  @CreateDateColumn()
  created_at: Date;
}
