import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('email_verifications')
export class EmailVerification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ length: 6 })
  code: string;

  @Column({ type: 'timestamptz' })
  expires_at: Date;

  @Column({ default: 0 })
  attempts: number;

  @Column({ default: false })
  used: boolean;

  @CreateDateColumn()
  created_at: Date;
}
