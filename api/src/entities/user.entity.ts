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

  @Column({ default: false })
  is_verified: boolean;

  // For fleet sub-drivers: points to the owner transportista
  @Column({ nullable: true, type: 'uuid' })
  fleet_id: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'fleet_id' })
  fleet_owner: User;

  @CreateDateColumn()
  created_at: Date;
}
