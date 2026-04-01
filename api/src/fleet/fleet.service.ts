import { Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Truck } from '../entities/truck.entity';
import { User } from '../entities/user.entity';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class FleetService {
  constructor(
    @InjectRepository(Truck) private trucksRepo: Repository<Truck>,
    @InjectRepository(User) private usersRepo: Repository<User>,
  ) {}

  async getMyTrucks(userId: string) {
    return this.trucksRepo.find({ where: { owner_id: userId } });
  }

  async addTruck(userId: string, body: Partial<Truck>) {
    if (!body.patente || !body.truck_type) {
      throw new BadRequestException('patente y truck_type son requeridos.');
    }
    const truck = this.trucksRepo.create({ ...body, owner_id: userId });
    return this.trucksRepo.save(truck);
  }

  async getFleetDrivers(userId: string) {
    return this.usersRepo.find({
      where: { fleet_id: userId },
      select: ['id', 'name', 'email', 'phone', 'role', 'created_at'],
    });
  }

  async addFleetDriver(userId: string, body: { email: string; password: string; name: string; phone?: string }) {
    const owner = await this.usersRepo.findOne({ where: { id: userId } });
    if (!owner || owner.role !== 'transportista') throw new ForbiddenException();

    const existing = await this.usersRepo.findOne({ where: { email: body.email.toLowerCase() } });
    if (existing) throw new BadRequestException('Ya existe una cuenta con ese email.');

    const password_hash = await bcrypt.hash(body.password, 12);
    const driver = this.usersRepo.create({
      email: body.email.toLowerCase(),
      name: body.name,
      password_hash,
      role: 'transportista',
      phone: body.phone,
      fleet_id: userId,
    });
    return this.usersRepo.save(driver);
  }
}
