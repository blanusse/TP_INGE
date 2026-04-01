import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { User } from '../entities/user.entity';
import { Shipper } from '../entities/shipper.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(Shipper) private shippersRepo: Repository<Shipper>,
    private jwtService: JwtService,
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

    return { ok: true };
  }

  async login(dto: LoginDto) {
    const user = await this.usersRepo.findOne({
      where: { email: dto.email.toLowerCase() },
    });
    if (!user) throw new UnauthorizedException('Credenciales inválidas.');

    const valid = await bcrypt.compare(dto.password, user.password_hash);
    if (!valid) throw new UnauthorizedException('Credenciales inválidas.');

    const payload = { sub: user.id, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    };
  }

  async checkEmail(email: string): Promise<{ available: boolean }> {
    const exists = await this.usersRepo.findOne({
      where: { email: email.toLowerCase() },
    });
    return { available: !exists };
  }
}
