import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('load_alerts')
export class LoadAlert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  /** Nombre descriptivo generado automáticamente */
  @Column({ nullable: true, type: 'varchar' })
  name: string | null;

  /** Tipos de carga separados por coma, ej: "General,Refrigerado" — null = cualquiera */
  @Column({ nullable: true, type: 'varchar' })
  cargo_types: string | null;

  /** Tipos de camión separados por coma — null = cualquiera */
  @Column({ nullable: true, type: 'varchar' })
  truck_types: string | null;

  @Column({ nullable: true, type: 'varchar' })
  origin_city: string | null;

  @Column({ nullable: true, type: 'varchar' })
  dest_city: string | null;

  @Column({ nullable: true, type: 'decimal', precision: 12, scale: 2 })
  price_min: number | null;

  @Column({ nullable: true, type: 'decimal', precision: 12, scale: 2 })
  price_max: number | null;

  @CreateDateColumn()
  created_at: Date;
}
