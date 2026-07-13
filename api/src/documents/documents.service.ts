import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { basename } from 'path';
import {
  TruckerDocument,
  DocumentTipo,
  DocumentStatus,
} from '../entities/trucker-document.entity';
import { User } from '../entities/user.entity';
import { Truck } from '../entities/truck.entity';
import { DniVisionService } from './dni-vision.service';
import { AfipVerificationService } from './afip-verification.service';

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(TruckerDocument)
    private documentsRepo: Repository<TruckerDocument>,
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    @InjectRepository(Truck)
    private trucksRepo: Repository<Truck>,
    private visionService: DniVisionService,
    private afipService: AfipVerificationService,
  ) {}

  async createDocument(
    driverId: string,
    tipo: DocumentTipo,
    url: string,
  ): Promise<TruckerDocument> {
    // Replace existing document of the same type
    await this.documentsRepo.delete({ driver_id: driverId, tipo });
    const doc = this.documentsRepo.create({
      driver_id: driverId,
      tipo,
      url,
      status: 'pending',
    });
    return this.documentsRepo.save(doc);
  }

  async getMyDocuments(driverId: string): Promise<TruckerDocument[]> {
    return this.documentsRepo.find({ where: { driver_id: driverId } });
  }

  async getPendingDocuments(): Promise<
    (TruckerDocument & { driver_name: string; driver_email: string })[]
  > {
    const docs = await this.documentsRepo.find({
      where: { status: 'pending' },
    });
    const driverIds = [...new Set(docs.map((d) => d.driver_id))];
    const users =
      driverIds.length > 0
        ? await this.usersRepo.findBy({ id: In(driverIds) })
        : [];
    const userMap = new Map(users.map((u) => [u.id, u]));
    return docs.map((d) => ({
      ...d,
      driver_name: userMap.get(d.driver_id)?.name ?? 'Desconocido',
      driver_email: userMap.get(d.driver_id)?.email ?? '',
    }));
  }

  async getAllDocuments(): Promise<
    (TruckerDocument & { driver_name: string; driver_email: string })[]
  > {
    const docs = await this.documentsRepo.find({
      order: { created_at: 'DESC' },
    });
    const driverIds = [...new Set(docs.map((d) => d.driver_id))];
    const users =
      driverIds.length > 0
        ? await this.usersRepo.findBy({ id: In(driverIds) })
        : [];
    const userMap = new Map(users.map((u) => [u.id, u]));
    return docs.map((d) => ({
      ...d,
      driver_name: userMap.get(d.driver_id)?.name ?? 'Desconocido',
      driver_email: userMap.get(d.driver_id)?.email ?? '',
    }));
  }

  async getDniStatus(
    userId: string,
  ): Promise<{ dni_verified: boolean; dni_photo_url: string | null }> {
    const user = await this.usersRepo.findOne({
      where: { id: userId },
      select: ['dni_verified', 'dni_photo_url'],
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return {
      dni_verified: user.dni_verified,
      dni_photo_url: user.dni_photo_url,
    };
  }

  async verifyDni(
    userId: string,
    filePath: string,
  ): Promise<{ verified: boolean; message: string }> {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const text = await this.visionService.extractTextFromFile(filePath);

    if (!this.visionService.isDniDocument(text)) {
      return {
        verified: false,
        message:
          'El documento no parece ser un DNI argentino válido. Asegurate de fotografiar el frente del DNI.',
      };
    }

    const backendUrl =
      process.env.BACKEND_URL ?? `http://localhost:${process.env.PORT ?? 3001}`;
    const photoUrl = `${backendUrl}/uploads/documents/${basename(filePath)}`;

    // Si el usuario no declaró DNI al registrarse, lo extraemos del OCR y lo
    // guardamos. Esto permite completar el onboarding sin haber cargado el
    // número previamente.
    if (!user.dni) {
      const extractedDni = this.visionService.extractDniFromText(text);
      if (!extractedDni) {
        return {
          verified: false,
          message:
            'No pudimos leer el número de DNI de la foto. Sacá una foto más clara del frente del documento.',
        };
      }
      const existing = await this.usersRepo.findOne({
        where: { dni: extractedDni, role: user.role },
      });
      if (existing && existing.id !== userId) {
        return {
          verified: false,
          message: 'Ya existe una cuenta con ese DNI.',
        };
      }
      await this.usersRepo.update(
        { id: userId },
        { dni: extractedDni, dni_verified: true, dni_photo_url: photoUrl },
      );
      return { verified: true, message: 'DNI verificado correctamente' };
    }

    const found = this.visionService.dniFoundInText(text, user.dni);

    if (found) {
      await this.usersRepo.update(
        { id: userId },
        { dni_verified: true, dni_photo_url: photoUrl },
      );
      return { verified: true, message: 'DNI verificado correctamente' };
    } else {
      await this.usersRepo.update({ id: userId }, { dni_photo_url: photoUrl });
      return {
        verified: false,
        message:
          'El número de DNI en la foto no coincide con el registrado. Asegurate de fotografiar el frente del DNI con buena iluminación.',
      };
    }
  }

  async verifyLicense(
    userId: string,
    filePath: string,
  ): Promise<{ verified: boolean; message: string }> {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (!user.dni)
      throw new BadRequestException('El usuario no tiene DNI registrado');

    const text = await this.visionService.extractTextFromFile(filePath);

    if (!this.visionService.isLicenseDocument(text)) {
      return {
        verified: false,
        message:
          'El documento no parece ser un registro de conducir válido. Asegurate de fotografiar el frente del carnet.',
      };
    }

    const found = this.visionService.dniFoundInText(text, user.dni);

    if (found) {
      await this.usersRepo.update({ id: userId }, { license_verified: true });
      return { verified: true, message: 'Registro de conducir verificado.' };
    }
    return {
      verified: false,
      message:
        'El DNI en el registro de conducir no coincide con el registrado. Asegurate de fotografiar el frente del carnet con buena iluminación.',
    };
  }

  async verifyTruckVtv(
    userId: string,
    truckId: string,
    filePath: string,
  ): Promise<{ verified: boolean; message: string; expiry?: string }> {
    const truck = await this.trucksRepo.findOne({ where: { id: truckId } });
    if (!truck) throw new NotFoundException('Camión no encontrado');
    if (truck.owner_id !== userId) throw new ForbiddenException();

    const text = await this.visionService.extractTextFromFile(filePath);

    if (!this.visionService.isVtvDocument(text)) {
      return {
        verified: false,
        message:
          'El documento no parece ser una VTV válida. Asegurate de fotografiar el certificado de verificación técnica vehicular.',
      };
    }

    const plateFound = this.visionService.plateFoundInText(text, truck.patente);

    if (!plateFound) {
      return {
        verified: false,
        message: `La patente en el documento no coincide con la registrada (${truck.patente}). Revisá que la foto sea legible.`,
      };
    }

    const expiry = this.visionService.extractExpiryDate(text);
    const now = new Date();

    if (expiry && expiry < now) {
      return {
        verified: false,
        message: `La VTV está vencida (${expiry.toLocaleDateString('es-AR')}). Renovála antes de continuar.`,
      };
    }

    const updates: Partial<Truck> = { vtv_verified: true };
    if (expiry) updates.vtv_vence = expiry.toISOString().split('T')[0];
    await this.trucksRepo.update({ id: truckId }, updates);

    const msg = expiry
      ? `VTV verificada. Vence el ${expiry.toLocaleDateString('es-AR')}.`
      : 'VTV verificada (no se pudo leer la fecha de vencimiento — revisala manualmente).';
    return {
      verified: true,
      message: msg,
      expiry: expiry?.toISOString().split('T')[0],
    };
  }

  async verifyTruckSeguro(
    userId: string,
    truckId: string,
    filePath: string,
  ): Promise<{ verified: boolean; message: string; expiry?: string }> {
    const truck = await this.trucksRepo.findOne({ where: { id: truckId } });
    if (!truck) throw new NotFoundException('Camión no encontrado');
    if (truck.owner_id !== userId) throw new ForbiddenException();

    const text = await this.visionService.extractTextFromFile(filePath);

    if (!this.visionService.isSeguroDocument(text)) {
      return {
        verified: false,
        message:
          'El documento no parece ser una póliza de seguro válida. Asegurate de fotografiar el certificado o la tarjeta del seguro del vehículo.',
      };
    }

    const plateFound = this.visionService.plateFoundInText(text, truck.patente);

    if (!plateFound) {
      return {
        verified: false,
        message: `La patente en el documento no coincide con la registrada (${truck.patente}). Revisá que la foto sea legible.`,
      };
    }

    const expiry = this.visionService.extractExpiryDate(text);
    const now = new Date();

    if (expiry && expiry < now) {
      return {
        verified: false,
        message: `El seguro está vencido (${expiry.toLocaleDateString('es-AR')}). Renovalo antes de continuar.`,
      };
    }

    const updates: Partial<Truck> = { seguro_verified: true };
    if (expiry) updates.seguro_vence = expiry.toISOString().split('T')[0];
    await this.trucksRepo.update({ id: truckId }, updates);

    const msg = expiry
      ? `Seguro verificado. Vence el ${expiry.toLocaleDateString('es-AR')}.`
      : 'Seguro verificado (no se pudo leer la fecha de vencimiento — revisala manualmente).';
    return {
      verified: true,
      message: msg,
      expiry: expiry?.toISOString().split('T')[0],
    };
  }

  async verifyCedulaVerde(
    userId: string,
    truckId: string,
    filePath: string,
  ): Promise<{ verified: boolean; message: string }> {
    const truck = await this.trucksRepo.findOne({ where: { id: truckId } });
    if (!truck) throw new NotFoundException('Camión no encontrado');
    if (truck.owner_id !== userId) throw new ForbiddenException();

    const text = await this.visionService.extractTextFromFile(filePath);

    if (!this.visionService.isCedulaVerdeDocument(text)) {
      return {
        verified: false,
        message:
          'El documento no parece ser una cédula verde. Fotografiá la cédula verde del vehículo emitida por el DNRPA.',
      };
    }

    const plateFound = this.visionService.plateFoundInText(text, truck.patente);
    if (!plateFound) {
      return {
        verified: false,
        message: `La patente en el documento no coincide con la registrada (${truck.patente}). Revisá que la foto sea legible.`,
      };
    }

    await this.trucksRepo.update(
      { id: truckId },
      { cedula_verde_verified: true },
    );
    return {
      verified: true,
      message: 'Cédula verde verificada correctamente.',
    };
  }

  async verifyCedulaAzul(
    userId: string,
    filePath: string,
  ): Promise<{ verified: boolean; message: string }> {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const text = await this.visionService.extractTextFromFile(filePath);

    if (!this.visionService.isCedulaAzulDocument(text)) {
      return {
        verified: false,
        message:
          'El documento no parece ser una cédula azul. Fotografiá la autorización emitida por el titular del vehículo.',
      };
    }

    if (user.dni && !this.visionService.dniFoundInText(text, user.dni)) {
      return {
        verified: false,
        message:
          'El DNI en la cédula azul no coincide con el tuyo. Verificá que la autorización esté a tu nombre.',
      };
    }

    await this.usersRepo.update({ id: userId }, { cedula_azul_verified: true });
    return { verified: true, message: 'Cédula azul verificada correctamente.' };
  }

  async verifyRuctt(
    userId: string,
    filePath: string,
  ): Promise<{ verified: boolean; message: string }> {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const text = await this.visionService.extractTextFromFile(filePath);

    if (!this.visionService.isRucttDocument(text)) {
      return {
        verified: false,
        message:
          'El documento no parece ser un certificado RUCTT válido. Asegurate de fotografiar la habilitación emitida por la CNRT.',
      };
    }

    await this.usersRepo.update({ id: userId }, { ructt_verified: true });
    return {
      verified: true,
      message: 'Habilitación RUCTT verificada correctamente.',
    };
  }

  async verifyIdentityAfip(
    userId: string,
  ): Promise<{ verified: boolean; cuil?: string; message: string }> {
    const user = await this.usersRepo.findOneBy({ id: userId });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (!user.dni)
      throw new BadRequestException('El usuario no tiene DNI cargado');
    if (!user.dni_verified)
      throw new BadRequestException(
        'Primero debe verificar el DNI con foto',
      );
    if (user.identity_verified)
      return { verified: true, message: 'La identidad ya fue verificada' };

    const resultado = await this.afipService.verificarIdentidad(
      user.dni,
      user.name,
    );

    if (resultado.verified) {
      await this.usersRepo.update(userId, { identity_verified: true });
    }

    return {
      verified: resultado.verified,
      cuil: resultado.cuil_encontrado,
      message: resultado.message,
    };
  }

  async getIdentityStatus(
    userId: string,
  ): Promise<{ identity_verified: boolean; dni_verified: boolean }> {
    const user = await this.usersRepo.findOneBy({ id: userId });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return {
      identity_verified: user.identity_verified,
      dni_verified: user.dni_verified,
    };
  }

  async getDriverVerificationStatus(userId: string): Promise<{
    dni_verified: boolean;
    license_verified: boolean;
    ructt_verified: boolean;
    cedula_azul_verified: boolean;
    dni_photo_url: string | null;
  }> {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return {
      dni_verified: user.dni_verified,
      license_verified: user.license_verified,
      ructt_verified: user.ructt_verified,
      cedula_azul_verified: user.cedula_azul_verified,
      dni_photo_url: user.dni_photo_url,
    };
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
    const allDocs = await this.documentsRepo.find({
      where: { driver_id: doc.driver_id },
    });
    const tipos: DocumentTipo[] = ['dni', 'vtv', 'seguro', 'carnet'];
    const allApproved = tipos.every((tipo) =>
      allDocs.some((d) => d.tipo === tipo && d.status === 'approved'),
    );
    await this.usersRepo.update(
      { id: doc.driver_id },
      { is_verified: allApproved },
    );

    return saved;
  }
}
