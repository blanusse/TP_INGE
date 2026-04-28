import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { basename } from 'path';
import { TruckerDocument, DocumentTipo, DocumentStatus } from '../entities/trucker-document.entity';
import { User } from '../entities/user.entity';
import { DniVisionService } from './dni-vision.service';

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(TruckerDocument)
    private documentsRepo: Repository<TruckerDocument>,
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    private visionService: DniVisionService,
  ) {}

  async createDocument(driverId: string, tipo: DocumentTipo, url: string): Promise<TruckerDocument> {
    // Replace existing document of the same type
    await this.documentsRepo.delete({ driver_id: driverId, tipo });
    const doc = this.documentsRepo.create({ driver_id: driverId, tipo, url, status: 'pending' });
    return this.documentsRepo.save(doc);
  }

  async getMyDocuments(driverId: string): Promise<TruckerDocument[]> {
    return this.documentsRepo.find({ where: { driver_id: driverId } });
  }

  async getPendingDocuments(): Promise<(TruckerDocument & { driver_name: string; driver_email: string })[]> {
    const docs = await this.documentsRepo.find({ where: { status: 'pending' } });
    const driverIds = [...new Set(docs.map((d) => d.driver_id))];
    const users = driverIds.length > 0
      ? await this.usersRepo.findBy({ id: In(driverIds) })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));
    return docs.map((d) => ({
      ...d,
      driver_name: userMap.get(d.driver_id)?.name ?? 'Desconocido',
      driver_email: userMap.get(d.driver_id)?.email ?? '',
    }));
  }

  async getAllDocuments(): Promise<(TruckerDocument & { driver_name: string; driver_email: string })[]> {
    const docs = await this.documentsRepo.find({ order: { created_at: 'DESC' } });
    const driverIds = [...new Set(docs.map((d) => d.driver_id))];
    const users = driverIds.length > 0
      ? await this.usersRepo.findBy({ id: In(driverIds) })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));
    return docs.map((d) => ({
      ...d,
      driver_name: userMap.get(d.driver_id)?.name ?? 'Desconocido',
      driver_email: userMap.get(d.driver_id)?.email ?? '',
    }));
  }

  async getDniStatus(userId: string): Promise<{ dni_verified: boolean; dni_photo_url: string | null }> {
    const user = await this.usersRepo.findOne({ where: { id: userId }, select: ['dni_verified', 'dni_photo_url'] });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return { dni_verified: user.dni_verified, dni_photo_url: user.dni_photo_url };
  }

  async verifyDni(userId: string, filePath: string): Promise<{ verified: boolean; message: string }> {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (!user.dni) throw new BadRequestException('El usuario no tiene DNI registrado');

    const text = await this.visionService.extractTextFromFile(filePath);
    const found = this.visionService.dniFoundInText(text, user.dni);

    const backendUrl = process.env.BACKEND_URL ?? `http://localhost:${process.env.PORT ?? 3001}`;
    const photoUrl = `${backendUrl}/uploads/documents/${basename(filePath)}`;

    if (found) {
      await this.usersRepo.update({ id: userId }, { dni_verified: true, dni_photo_url: photoUrl });
      return { verified: true, message: 'DNI verificado correctamente' };
    } else {
      // Save the photo anyway so admin can review manually if needed
      await this.usersRepo.update({ id: userId }, { dni_photo_url: photoUrl });
      return { verified: false, message: 'El número de DNI en la foto no coincide con el registrado. Asegurate de fotografiar el frente del DNI con buena iluminación.' };
    }
  }

  async updateStatus(
    docId: string,
    adminId: string,
    status: DocumentStatus,
    admin_note?: string,
  ): Promise<TruckerDocument> {
    const doc = await this.documentsRepo.findOne({ where: { id: docId } });
    if (!doc) throw new NotFoundException('Documento no encontrado');
    doc.status = status;
    doc.admin_note = admin_note ?? null;
    doc.reviewed_by = adminId;
    doc.reviewed_at = new Date();
    const saved = await this.documentsRepo.save(doc);

    // Update user is_verified if all 4 types are approved for this driver
    const allDocs = await this.documentsRepo.find({ where: { driver_id: doc.driver_id } });
    const tipos: DocumentTipo[] = ['dni', 'vtv', 'seguro', 'carnet'];
    const allApproved = tipos.every((tipo) => allDocs.some((d) => d.tipo === tipo && d.status === 'approved'));
    await this.usersRepo.update({ id: doc.driver_id }, { is_verified: allApproved });

    return saved;
  }
}
