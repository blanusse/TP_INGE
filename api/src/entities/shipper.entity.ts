import {
  Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

export type ShipperTipo = 'empresa' | 'persona';

@Entity('shippers')
export class Shipper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @OneToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', default: 'empresa' })
  tipo: ShipperTipo;

  @Column({ nullable: true })
  razon_social: string;

  @Column({ nullable: true })
  cuit: string;

  @Column({ nullable: true })
  cuil: string;

  @Column({ nullable: true })
  address: string;
}
