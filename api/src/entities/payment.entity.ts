import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Offer } from './offer.entity';
import { Load } from './load.entity';

export type PaymentStatus = 'pending' | 'confirmed';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  offer_id: string;

  @ManyToOne(() => Offer)
  @JoinColumn({ name: 'offer_id' })
  offer: Offer;

  @Column({ type: 'uuid' })
  load_id: string;

  @ManyToOne(() => Load)
  @JoinColumn({ name: 'load_id' })
  load: Load;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', nullable: true })
  mp_preference_id: string;

  @Column({ type: 'varchar', nullable: true })
  mp_payment_id: string;

  @Column({ type: 'varchar', default: 'pending' })
  status: PaymentStatus;

  // Código de entrega: se genera cuando el pago es confirmado.
  // El dador lo ve en su panel y lo comparte con quien recibe la carga.
  // El transportista lo ingresa para confirmar la entrega y cobrar.
  @Column({ type: 'varchar', nullable: true, unique: true })
  delivery_code: string;

  @Column({ type: 'boolean', default: false })
  delivery_code_used: boolean;

  // Método de cobro elegido por el transportista
  @Column({ type: 'varchar', nullable: true })
  payout_method: string; // 'cvu_cbu' | 'mercadopago'

  @Column({ type: 'varchar', nullable: true })
  payout_destination: string; // CVU/CBU/alias o email/usuario de MP

  @Column({ type: 'varchar', nullable: true, default: null })
  payout_status: string; // null | 'requested' | 'done'

  @CreateDateColumn()
  created_at: Date;
}
