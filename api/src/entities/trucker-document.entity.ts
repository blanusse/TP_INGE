import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

export type DocumentTipo = 'dni' | 'vtv' | 'seguro' | 'carnet';
export type DocumentStatus = 'pending' | 'approved' | 'rejected';

@Entity('trucker_documents')
export class TruckerDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  driver_id: string;

  @Column({ type: 'varchar' })
  tipo: DocumentTipo;

  @Column()
  url: string;

  @Column({ type: 'varchar', default: 'pending' })
  status: DocumentStatus;

  @Column({ nullable: true, type: 'text' })
  admin_note: string | null;

  @Column({ nullable: true, type: 'uuid' })
  reviewed_by: string;

  @Column({ nullable: true, type: 'timestamptz' })
  reviewed_at: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
