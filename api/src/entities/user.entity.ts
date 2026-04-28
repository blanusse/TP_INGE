import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  OneToOne, OneToMany, ManyToOne, JoinColumn,
} from 'typeorm';

export type UserRole = 'transportista' | 'shipper' | 'admin';

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

  @Column({ nullable: true, type: 'varchar' })
  phone: string | null;

  @Column({ nullable: true, type: 'varchar' })
  dni: string | null;

  @Column({ default: false })
  is_verified: boolean;

  @Column({ default: false })
  dni_verified: boolean;

  @Column({ default: false })
  license_verified: boolean;

  // URL de la foto del DNI subida a Supabase Storage
  @Column({ nullable: true, type: 'varchar' })
  dni_photo_url: string | null;

  // For fleet sub-drivers: points to the owner transportista
  @Column({ nullable: true, type: 'uuid' })
  fleet_id: string | null;

  @Column({ default: true })
  show_as_fleet_driver: boolean;

  @Column({ default: false })
  is_fleet_owner: boolean;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'fleet_id' })
  fleet_owner: User;

  // MercadoPago OAuth — se completa cuando el transportista conecta su cuenta MP
  @Column({ nullable: true, type: 'varchar' })
  mp_user_id: string | null;


  @CreateDateColumn()
  created_at: Date;
}
