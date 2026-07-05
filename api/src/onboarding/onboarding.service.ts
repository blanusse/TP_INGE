import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { Shipper } from '../entities/shipper.entity';
import { Truck } from '../entities/truck.entity';

export type OnboardingStep = {
  key: string;
  label: string;
  description: string;
  completed: boolean;
  optional: boolean;
  cta_label: string;
  cta_path: string;
};

export type OnboardingStatus = {
  role_kind:
    | 'transportista_individual'
    | 'transportista_flota'
    | 'transportista_empleado'
    | 'dador_persona'
    | 'dador_empresa';
  steps: OnboardingStep[];
  completed_count: number;
  required_count: number;
  total_count: number;
  percent_complete: number;
  next_step: OnboardingStep | null;
  ready_to_operate: boolean;
};

@Injectable()
export class OnboardingService {
  constructor(
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(Shipper) private shippersRepo: Repository<Shipper>,
    @InjectRepository(Truck) private trucksRepo: Repository<Truck>,
  ) {}

  async getStatus(userId: string): Promise<OnboardingStatus> {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado.');

    if (user.role === 'shipper') {
      return this.buildDadorStatus(user);
    }
    return this.buildTransportistaStatus(user);
  }

  private async buildDadorStatus(user: User): Promise<OnboardingStatus> {
    const shipper = await this.shippersRepo.findOne({
      where: { user_id: user.id },
    });
    const esEmpresa = shipper?.tipo === 'empresa';

    const steps: OnboardingStep[] = [
      {
        key: 'email',
        label: 'Verificá tu email',
        description: 'Te enviamos un código de 6 dígitos para confirmar tu cuenta.',
        completed: user.is_verified,
        optional: false,
        cta_label: 'Verificar email',
        cta_path: '/verify-email',
      },
      {
        key: 'datos_dador',
        label: esEmpresa ? 'Completá los datos de tu empresa' : 'Completá tus datos personales',
        description: esEmpresa
          ? 'Razón social y CUIT para emitir facturas.'
          : 'CUIL y datos personales para que los transportistas confíen.'
,
        completed: esEmpresa
          ? Boolean(shipper?.razon_social && shipper?.cuit)
          : Boolean(shipper?.cuil),
        optional: false,
        cta_label: 'Completar datos',
        cta_path: '/dador?nav=perfil',
      },
    ];

    return this.summarize(steps, esEmpresa ? 'dador_empresa' : 'dador_persona');
  }

  private async buildTransportistaStatus(user: User): Promise<OnboardingStatus> {
    const esFlota = Boolean(user.is_fleet_owner);
    const esEmpleado = Boolean(user.fleet_id);

    const truckCount = esEmpleado
      ? 0
      : await this.trucksRepo.count({ where: { owner_id: user.id } });

    const stepsBase: OnboardingStep[] = [
      {
        key: 'email',
        label: 'Verificá tu email',
        description: 'Te enviamos un código de 6 dígitos para confirmar tu cuenta.',
        completed: user.is_verified,
        optional: false,
        cta_label: 'Verificar email',
        cta_path: '/verify-email',
      },
      {
        key: 'dni_foto',
        label: 'Subí tu DNI',
        description: 'Necesitamos la foto del DNI para validar tu identidad.',
        completed: user.dni_verified,
        optional: false,
        cta_label: 'Subir DNI',
        cta_path: this.basePath(user) + '?nav=perfil&tab=documentos',
      },
      {
        key: 'identity_verified',
        label: 'Verificá tu identidad',
        description: 'Selfie con prueba de vida + match contra tu DNI. Lo hace nuestro proveedor (Veriff).',
        completed: user.identity_verified,
        optional: false,
        cta_label: 'Verificar identidad',
        cta_path: '/verificar-identidad',
      },
      {
        key: 'licencia',
        label: 'Subí tu licencia de conducir',
        description: 'Carnet profesional vigente para operar en la plataforma.',
        completed: user.license_verified,
        optional: false,
        cta_label: 'Subir licencia',
        cta_path: this.basePath(user) + '?nav=perfil&tab=documentos',
      },
    ];

    if (!esEmpleado) {
      stepsBase.push({
        key: 'cedula_azul',
        label: 'Subí tu cédula azul',
        description: 'Solo si vas a conducir camión que no es tuyo.',
        completed: user.cedula_azul_verified,
        optional: true,
        cta_label: 'Subir cédula azul',
        cta_path: this.basePath(user) + '?nav=perfil&tab=documentos',
      });
      stepsBase.push({
        key: 'ructt',
        label: 'Subí tu inscripción al RUCCT',
        description: 'Registro Único del Transporte de Cargas Terrestres.',
        completed: user.ructt_verified,
        optional: true,
        cta_label: 'Subir RUCCT',
        cta_path: this.basePath(user) + '?nav=perfil&tab=documentos',
      });
      stepsBase.push({
        key: 'primer_camion',
        label: esFlota
          ? 'Agregá el primer camión de tu flota'
          : 'Agregá tu camión',
        description: 'Patente, tipo de carrocería, capacidad y documentación.',
        completed: truckCount > 0,
        optional: false,
        cta_label: 'Agregar camión',
        cta_path: this.basePath(user) + '?nav=flota',
      });
    }

    let kind: OnboardingStatus['role_kind'];
    if (esEmpleado) kind = 'transportista_empleado';
    else if (esFlota) kind = 'transportista_flota';
    else kind = 'transportista_individual';

    return this.summarize(stepsBase, kind);
  }

  private basePath(user: User): string {
    if (user.fleet_id) return '/empleado';
    if (user.is_fleet_owner) return '/flota';
    return '/transportista';
  }

  private summarize(
    steps: OnboardingStep[],
    kind: OnboardingStatus['role_kind'],
  ): OnboardingStatus {
    const required = steps.filter((s) => !s.optional);
    const completed = steps.filter((s) => s.completed).length;
    const completedRequired = required.filter((s) => s.completed).length;
    const nextStep = steps.find((s) => !s.completed && !s.optional) ?? null;
    const percent = required.length
      ? Math.round((completedRequired / required.length) * 100)
      : 100;

    return {
      role_kind: kind,
      steps,
      completed_count: completed,
      required_count: required.length,
      total_count: steps.length,
      percent_complete: percent,
      next_step: nextStep,
      ready_to_operate: completedRequired === required.length,
    };
  }
}
