import { Injectable, ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { User } from '../entities/user.entity';
import { Shipper } from '../entities/shipper.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

// ── Helpers de validación ────────────────────────────────────────────────────

/** Verifica el dígito verificador del CUIT/CUIL argentino */
function validarCuit(cuit: string): boolean {
  const limpio = cuit.replace(/[-\s]/g, '');
  if (!/^\d{11}$/.test(limpio)) return false;
  const factores = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const suma = factores.reduce((acc, f, i) => acc + f * parseInt(limpio[i]), 0);
  const resto = 11 - (suma % 11);
  if (resto === 11) return parseInt(limpio[10]) === 0;
  if (resto === 10) return false;
  return parseInt(limpio[10]) === resto;
}

/** Valida que el DNI sea un número argentino plausible (1.000.000 – 99.999.999) */
function validarDni(dni: string): boolean {
  const limpio = dni.replace(/\./g, '');
  if (!/^\d{7,8}$/.test(limpio)) return false;
  const num = parseInt(limpio);
  return num >= 1_000_000 && num <= 99_999_999;
}

// ── Servicio ─────────────────────────────────────────────────────────────────

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(Shipper) private shippersRepo: Repository<Shipper>,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase().trim();

    // 1. Email único
    const byEmail = await this.usersRepo.findOne({ where: { email } });
    if (byEmail) throw new ConflictException('Ya existe una cuenta con ese email.');

    // 2. Teléfono único (si se provee)
    if (dto.phone) {
      const byPhone = await this.usersRepo.findOne({ where: { phone: dto.phone.trim() } });
      if (byPhone) throw new ConflictException('Ya existe una cuenta con ese número de teléfono.');
    }

    // 3. DNI: validación de formato + rango + unicidad por rol
    if (dto.dni) {
      if (!validarDni(dto.dni)) {
        throw new BadRequestException('El DNI ingresado no es válido. Debe tener entre 7 y 8 dígitos y estar en el rango argentino.');
      }

      const dniLimpio = dto.dni.replace(/\./g, '');
      const dbRole = dto.role === 'dador' ? 'shipper' : 'transportista';

      // Misma persona no puede registrarse dos veces en el mismo rol
      const byDniRole = await this.usersRepo.findOne({
        where: { dni: dniLimpio, role: dbRole },
      });
      if (byDniRole) {
        throw new ConflictException(
          `Ya existe una cuenta ${dto.role === 'dador' ? 'de dador' : 'de transportista'} con ese DNI.`,
        );
      }
    }

    // 4. CUIT argentino (dadores empresa)
    if (dto.tipo_dador === 'empresa' && dto.cuit) {
      if (!validarCuit(dto.cuit)) {
        throw new BadRequestException('El CUIT ingresado no es válido. Verificá el dígito verificador.');
      }
      // CUIT único globalmente
      const byCuit = await this.shippersRepo.findOne({ where: { cuit: dto.cuit } });
      if (byCuit) throw new ConflictException('Ya existe una empresa registrada con ese CUIT.');
    }

    // 5. Contraseña mínima
    if (!dto.password || dto.password.length < 8) {
      throw new BadRequestException('La contraseña debe tener al menos 8 caracteres.');
    }

    const password_hash = await bcrypt.hash(dto.password, 12);
    const dbRole = dto.role === 'dador' ? 'shipper' : 'transportista';

    const user = this.usersRepo.create({
      email,
      name: dto.name.trim(),
      password_hash,
      role: dbRole,
      phone: dto.phone?.trim() || null,
      dni: dto.dni ? dto.dni.replace(/\./g, '') : null,
      dni_photo_url: dto.dni_photo_url ?? null,
      verification_status: 'pending',
    } as DeepPartial<User>);
    await this.usersRepo.save(user);

    if (dto.role === 'dador') {
      const shipper = this.shippersRepo.create({
        user_id: user.id,
        tipo: dto.tipo_dador === 'empresa' ? 'empresa' : 'persona',
        razon_social: dto.razon_social?.trim(),
        cuit: dto.tipo_dador === 'empresa' ? dto.cuit : undefined,
        cuil: dto.tipo_dador === 'personal' ? dto.dni?.replace(/\./g, '') : undefined,
        address: dto.address?.trim(),
      });
      await this.shippersRepo.save(shipper);
    }

    return { ok: true };
  }

  async login(dto: LoginDto) {
    const user = await this.usersRepo.findOne({
      where: { email: dto.email.toLowerCase() },
    });
    // No revelar si el email existe o no (seguridad)
    if (!user) throw new UnauthorizedException('Credenciales inválidas.');

    const valid = await bcrypt.compare(dto.password, user.password_hash);
    if (!valid) throw new UnauthorizedException('Credenciales inválidas.');

    const payload = { sub: user.id, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    };
  }

  /** Verifica disponibilidad de email, teléfono o DNI (para validación en tiempo real) */
  async checkField(field: string, value: string): Promise<{ available: boolean }> {
    if (!value || !field) return { available: true };

    if (field === 'email') {
      const exists = await this.usersRepo.findOne({ where: { email: value.toLowerCase() } });
      return { available: !exists };
    }

    if (field === 'phone') {
      const exists = await this.usersRepo.findOne({ where: { phone: value.trim() } });
      return { available: !exists };
    }

    if (field === 'dni') {
      const limpio = value.replace(/\./g, '');
      const exists = await this.usersRepo.findOne({ where: { dni: limpio } });
      return { available: !exists };
    }

    if (field === 'cuit') {
      const exists = await this.shippersRepo.findOne({ where: { cuit: value } });
      return { available: !exists };
    }

    return { available: true };
  }
}
