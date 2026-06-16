import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export type VerificationStatus =
  | 'created'      // sesión generada, esperando que el user inicie
  | 'submitted'    // user envió selfie + DNI, esperando verdict de Veriff
  | 'approved'     // identidad validada
  | 'declined'     // rechazada (mal documento, no es la persona, etc.)
  | 'resubmission'; // Veriff pide reintentar (foto borrosa, mal encuadre)

@Entity('identity_verifications')
export class IdentityVerification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'varchar' })
  veriff_session_id: string;

  @Column({ type: 'varchar', default: 'created' })
  status: VerificationStatus;

  @Column({ type: 'jsonb', nullable: true })
  decision_payload: Record<string, unknown> | null;

  @Column({ nullable: true, type: 'varchar' })
  provider: 'mock' | 'veriff';

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @Column({ nullable: true, type: 'timestamptz' })
  decided_at: Date | null;
}
