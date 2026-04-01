import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('trucks')
export class Truck {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  owner_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'owner_id' })
  owner: User;

  @Column()
  patente: string;

  @Column({ nullable: true })
  marca: string;

  @Column({ nullable: true })
  modelo: string;

  @Column({ nullable: true, type: 'int' })
  año: number;

  @Column()
  truck_type: string;

  @Column({ nullable: true, type: 'decimal', precision: 10, scale: 2 })
  capacity_kg: number;

  @Column({ nullable: true })
  vtv_vence: string;

  @Column({ nullable: true })
  seguro_poliza: string;

  @Column({ nullable: true })
  seguro_vence: string;

  @Column({ nullable: true })
  patente_remolque: string;
}
