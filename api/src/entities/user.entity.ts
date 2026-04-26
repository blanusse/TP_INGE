import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  OneToOne, OneToMany, ManyToOne, JoinColumn,
} from 'typeorm';

export type UserRole = 'transportista' | 'shipper';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  name: string;

  @Column()
  password_hash: string;

  @Column({ type: 'varchar' })
  role: UserRole;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  dni: string;

  // URL de la foto del DNI subida a Supabase Storage
  @Column({ nullable: true })
  dni_photo_url: string;

  // Estado de verificación de identidad
  @Column({ default: 'pending' })
  verification_status: string;

  // For fleet sub-drivers: points to the owner transportista
  @Column({ nullable: true, type: 'uuid' })
  fleet_id: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'fleet_id' })
  fleet_owner: User;

  @CreateDateColumn()
  created_at: Date;
}
