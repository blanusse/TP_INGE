import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { User } from '../entities/user.entity';
import { Shipper } from '../entities/shipper.entity';
import { EmailVerification } from '../entities/email-verification.entity';
import { EmailService } from '../email/email.service';
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
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(Shipper) private shippersRepo: Repository<Shipper>,
    @InjectRepository(EmailVerification) private verificationsRepo: Repository<EmailVerification>,
    private jwtService: JwtService,
    private emailService: EmailService,
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
      is_verified: false,
    });
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

    await this.createAndSendCode(user);
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

    if (!user.is_verified) {
      throw new ForbiddenException({
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Verificá tu email antes de iniciar sesión.',
      });
    }

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

  async verifyEmail(email: string, code: string) {
    const user = await this.usersRepo.findOne({
      where: { email: email.toLowerCase() },
    });
    if (!user) throw new NotFoundException('Email no registrado.');
    if (user.is_verified) throw new ConflictException('La cuenta ya está verificada.');

    const verification = await this.verificationsRepo.findOne({
      where: { user_id: user.id, used: false },
      order: { created_at: 'DESC' },
    });

    if (!verification) {
      throw new BadRequestException('No hay un código activo. Solicitá uno nuevo.');
    }

    if (new Date() > verification.expires_at) {
      verification.used = true;
      await this.verificationsRepo.save(verification);
      throw new BadRequestException('El código expiró. Solicitá uno nuevo.');
    }

    if (verification.attempts >= 3) {
      throw new BadRequestException('Demasiados intentos. Solicitá un nuevo código.');
    }

    if (verification.code !== code) {
      verification.attempts++;
      await this.verificationsRepo.save(verification);
      const left = 3 - verification.attempts;
      throw new BadRequestException(
        left > 0
          ? `Código incorrecto. Te queda${left === 1 ? '' : 'n'} ${left} intento${left === 1 ? '' : 's'}.`
          : 'Demasiados intentos. Solicitá un nuevo código.',
      );
    }

    verification.used = true;
    await this.verificationsRepo.save(verification);
    user.is_verified = true;
    await this.usersRepo.save(user);
    return { ok: true };
  }

  async resendCode(email: string) {
    const user = await this.usersRepo.findOne({
      where: { email: email.toLowerCase() },
    });
    if (!user) throw new NotFoundException('Email no registrado.');
    if (user.is_verified) throw new ConflictException('La cuenta ya está verificada.');

    await this.verificationsRepo.update(
      { user_id: user.id, used: false },
      { used: true },
    );

    await this.createAndSendCode(user);
    return { ok: true };
  }

  private async createAndSendCode(user: User) {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires_at = new Date(Date.now() + 10 * 60 * 1000);

    const verification = this.verificationsRepo.create({
      user_id: user.id,
      code,
      expires_at,
      attempts: 0,
      used: false,
    });
    await this.verificationsRepo.save(verification);

    this.logger.warn(`[DEV] Código de verificación para ${user.email}: ${code}`);

    try {
      await this.emailService.sendVerificationCode(user.email, user.name, code);
    } catch (err) {
      this.logger.warn(`Email no enviado (${user.email}): ${err?.message}. Usá el código de arriba para probar.`);
    }
  }
}
