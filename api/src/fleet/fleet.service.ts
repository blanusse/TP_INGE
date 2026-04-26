import { Injectable, ForbiddenException, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Truck } from '../entities/truck.entity';
import { User } from '../entities/user.entity';
import * as bcrypt from 'bcryptjs';

// ── Helpers de validación ────────────────────────────────────────────────────

/** Formato de patente argentina: ABC123 (vieja) o AB123CD (nueva) */
function validarPatente(patente: string): boolean {
  const p = patente.toUpperCase().replace(/\s/g, '');
  return /^[A-Z]{3}\d{3}$/.test(p) || /^[A-Z]{2}\d{3}[A-Z]{2}$/.test(p);
}

/** Año del camión: entre 1960 y el año siguiente */
function validarAnio(anio: number): boolean {
  const actual = new Date().getFullYear();
  return anio >= 1960 && anio <= actual + 1;
}

/** Fecha de vencimiento: debe ser futura */
function validarVigencia(fecha: string, campo: string): void {
  if (!fecha) return;
  const d = new Date(fecha);
  if (isNaN(d.getTime())) throw new BadRequestException(`La fecha de ${campo} no es válida.`);
  if (d < new Date()) throw new BadRequestException(`La fecha de vencimiento de ${campo} ya está vencida.`);
}

/** DNI argentino básico: 7-8 dígitos, rango plausible */
function validarDni(dni: string): boolean {
  const limpio = dni.replace(/\./g, '');
  if (!/^\d{7,8}$/.test(limpio)) return false;
  const num = parseInt(limpio);
  return num >= 1_000_000 && num <= 99_999_999;
}

// ── Servicio ─────────────────────────────────────────────────────────────────

@Injectable()
export class FleetService {
  constructor(
    @InjectRepository(Truck) private trucksRepo: Repository<Truck>,
    @InjectRepository(User) private usersRepo: Repository<User>,
  ) {}

  async getMyTrucks(userId: string) {
    return this.trucksRepo.find({ where: { owner_id: userId } });
  }

  async addTruck(userId: string, body: Partial<Truck> & { vtv_doc_url?: string; seguro_doc_url?: string }) {
    if (!body.patente?.trim()) throw new BadRequestException('La patente es requerida.');
    if (!body.truck_type)      throw new BadRequestException('El tipo de camión es requerido.');

    // Formato de patente
    if (!validarPatente(body.patente)) {
      throw new BadRequestException(
        'La patente debe tener formato argentino: ABC123 (vieja) o AB123CD (nueva).',
      );
    }
    const patente = body.patente.toUpperCase().replace(/\s/g, '');

    // Patente única globalmente (un camión no puede estar registrado dos veces)
    const patenteExistente = await this.trucksRepo.findOne({ where: { patente } });
    if (patenteExistente) throw new ConflictException('Ya existe un camión registrado con esa patente.');

    // Año
    if (body.año !== undefined && body.año !== null) {
      if (!validarAnio(body.año)) {
        throw new BadRequestException(`El año del camión debe estar entre 1960 y ${new Date().getFullYear() + 1}.`);
      }
    }

    // Vigencias
    validarVigencia(body.vtv_vence, 'VTV');
    validarVigencia(body.seguro_vence, 'seguro');

    const truck = this.trucksRepo.create({ ...body, patente, owner_id: userId });
    return this.trucksRepo.save(truck);
  }

  async updateTruck(userId: string, truckId: string, body: Partial<Truck>) {
    const truck = await this.trucksRepo.findOne({ where: { id: truckId } });
    if (!truck) throw new NotFoundException('Camión no encontrado.');
    if (truck.owner_id !== userId) throw new ForbiddenException();

    // Si se actualiza la patente, validar formato y unicidad
    if (body.patente && body.patente !== truck.patente) {
      if (!validarPatente(body.patente)) {
        throw new BadRequestException('La patente debe tener formato argentino: ABC123 o AB123CD.');
      }
      const patente = body.patente.toUpperCase().replace(/\s/g, '');
      const existente = await this.trucksRepo.findOne({ where: { patente } });
      if (existente && existente.id !== truckId) throw new ConflictException('Ya existe un camión con esa patente.');
      body.patente = patente;
    }

    if (body.año !== undefined && !validarAnio(body.año)) {
      throw new BadRequestException(`El año debe estar entre 1960 y ${new Date().getFullYear() + 1}.`);
    }
    validarVigencia(body.vtv_vence, 'VTV');
    validarVigencia(body.seguro_vence, 'seguro');

    const { owner_id, id, ...updates } = body as any;
    Object.assign(truck, updates);
    return this.trucksRepo.save(truck);
  }

  async deleteTruck(userId: string, truckId: string) {
    const truck = await this.trucksRepo.findOne({ where: { id: truckId } });
    if (!truck) throw new NotFoundException('Camión no encontrado.');
    if (truck.owner_id !== userId) throw new ForbiddenException();
    await this.trucksRepo.remove(truck);
    return { ok: true };
  }

  async getFleetDrivers(userId: string) {
    return this.usersRepo.find({
      where: { fleet_id: userId },
      select: ['id', 'name', 'email', 'phone', 'dni', 'role', 'created_at'],
    });
  }

  async addFleetDriver(userId: string, body: { email: string; password: string; name: string; phone?: string; dni?: string }) {
    const owner = await this.usersRepo.findOne({ where: { id: userId } });
    if (!owner || owner.role !== 'transportista') throw new ForbiddenException();

    // Validaciones de nombre
    if (!body.name?.trim()) throw new BadRequestException('El nombre del conductor es requerido.');

    // Email único
    const byEmail = await this.usersRepo.findOne({ where: { email: body.email.toLowerCase() } });
    if (byEmail) throw new ConflictException('Ya existe una cuenta con ese email.');

    // Teléfono: formato básico
    if (body.phone && !/^\+?\d{8,15}$/.test(body.phone.replace(/\s/g, ''))) {
      throw new BadRequestException('El teléfono debe tener entre 8 y 15 dígitos.');
    }

    // DNI: formato + rango + unicidad
    if (body.dni) {
      if (!validarDni(body.dni)) {
        throw new BadRequestException('El DNI debe tener 7 u 8 dígitos y estar en el rango argentino.');
      }
      const dniLimpio = body.dni.replace(/\./g, '');
      const byDni = await this.usersRepo.findOne({ where: { dni: dniLimpio, role: 'transportista' } });
      if (byDni) throw new ConflictException('Ya existe un conductor registrado con ese DNI.');
    }

    // Contraseña mínima
    if (!body.password || body.password.length < 8) {
      throw new BadRequestException('La contraseña debe tener al menos 8 caracteres.');
    }

    const password_hash = await bcrypt.hash(body.password, 12);
    const driver = this.usersRepo.create({
      email: body.email.toLowerCase(),
      name: body.name.trim(),
      password_hash,
      role: 'transportista',
      phone: body.phone?.trim() || null,
      dni: body.dni ? body.dni.replace(/\./g, '') : null,
      fleet_id: userId,
      verification_status: 'pending',
    });
    const saved = await this.usersRepo.save(driver);
    const { password_hash: _, ...result } = saved as any;
    return result;
  }

  async updateDriver(userId: string, driverId: string, body: { name?: string; phone?: string; dni?: string }) {
    const driver = await this.usersRepo.findOne({ where: { id: driverId } });
    if (!driver) throw new NotFoundException('Conductor no encontrado.');
    if (driver.fleet_id !== userId) throw new ForbiddenException();

    if (body.phone && !/^\+?\d{8,15}$/.test(body.phone.replace(/\s/g, ''))) {
      throw new BadRequestException('El teléfono debe tener entre 8 y 15 dígitos.');
    }

    if (body.dni) {
      if (!validarDni(body.dni)) {
        throw new BadRequestException('El DNI ingresado no es válido.');
      }
      const dniLimpio = body.dni.replace(/\./g, '');
      const byDni = await this.usersRepo.findOne({ where: { dni: dniLimpio, role: 'transportista' } });
      if (byDni && byDni.id !== driverId) throw new ConflictException('Ya existe un conductor con ese DNI.');
      body.dni = dniLimpio;
    }

    if (body.name !== undefined) driver.name = body.name.trim();
    if (body.phone !== undefined) driver.phone = body.phone.trim();
    if (body.dni !== undefined)   driver.dni   = body.dni;
    const saved = await this.usersRepo.save(driver);
    const { password_hash, ...result } = saved as any;
    return result;
  }

  async deleteDriver(userId: string, driverId: string) {
    const driver = await this.usersRepo.findOne({ where: { id: driverId } });
    if (!driver) throw new NotFoundException('Conductor no encontrado.');
    if (driver.fleet_id !== userId) throw new ForbiddenException();
    await this.usersRepo.remove(driver);
    return { ok: true };
  }
}
