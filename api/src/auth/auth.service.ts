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
    const existing = await this.usersRepo.findOne({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) throw new ConflictException('Ya existe una cuenta con ese email.');

    const password_hash = await bcrypt.hash(dto.password, 12);
    const dbRole = dto.role === 'dador' ? 'shipper' : 'transportista';

    const user = this.usersRepo.create({
      email: dto.email.toLowerCase(),
      name: dto.name,
      password_hash,
      role: dbRole,
      phone: dto.phone,
      dni: dto.dni,
      is_verified: false,
    });
    await this.usersRepo.save(user);

    if (dto.role === 'dador') {
      const shipper = this.shippersRepo.create({
        user_id: user.id,
        tipo: dto.tipo_dador === 'empresa' ? 'empresa' : 'persona',
        razon_social: dto.razon_social,
        cuit: dto.tipo_dador === 'empresa' ? dto.cuit : undefined,
        cuil: dto.tipo_dador === 'personal' ? dto.dni : undefined,
        address: dto.address,
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

  async checkEmail(email: string): Promise<{ available: boolean; is_verified?: boolean }> {
    const exists = await this.usersRepo.findOne({
      where: { email: email.toLowerCase() },
    });
    if (!exists) return { available: true };
    return { available: false, is_verified: exists.is_verified };
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
