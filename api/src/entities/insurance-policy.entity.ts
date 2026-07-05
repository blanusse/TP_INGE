import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('insurance_policies')
export class InsurancePolicy {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'uuid', nullable: true })
  load_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  product_id: string | null;

  @Column({ type: 'varchar', nullable: true })
  insurance_name: string | null;

  @Column({ type: 'varchar', nullable: true })
  insurer_name: string | null;

  @Column({ type: 'varchar', nullable: true })
  coverage_type: string | null;

  @Column({ type: 'timestamp', nullable: true })
  coverage_starts_at: Date | null;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  declared_value: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  premium: number;

  @Column({ type: 'varchar' })
  cargo_type: string;

  @Column({ type: 'varchar' })
  pickup_city: string;

  @Column({ type: 'varchar' })
  dropoff_city: string;

  @Column({ type: 'int', nullable: true })
  distance_km: number | null;

  /** 'active' | 'expired' | 'claimed' */
  @Column({ type: 'varchar', default: 'active' })
  status: string;

  /**
   * Identifier of the provider used to issue this policy.
   * 'mock' for simulated, 'loadsure' for the real integration, etc.
   * Allows querying which policies were issued via which provider.
   */
  @Column({ type: 'varchar', default: 'mock' })
  provider: string;

  /**
   * Policy ID returned by the external provider.
   * null for mock policies; populated when a real provider is integrated.
   */
  @Column({ type: 'varchar', nullable: true })
  external_policy_id: string | null;

  /**
   * Raw response from the external provider (quote + purchase response).
   * Stored as-is so that when a real provider is integrated, all data is preserved
   * and no migrations are needed to add new fields from the provider's response.
   */
  @Column({ type: 'jsonb', nullable: true })
  provider_data: Record<string, unknown> | null;

  @CreateDateColumn()
  created_at: Date;

  @Column({ type: 'timestamp' })
  coverage_ends_at: Date;
}
