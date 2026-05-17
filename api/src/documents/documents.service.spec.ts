import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';

jest.mock('@nestjs/axios', () => ({ HttpService: class {} }));

import { DocumentsService } from './documents.service';

describe('DocumentsService', () => {
  let service: DocumentsService;
  let documentsRepo: Record<string, jest.Mock>;
  let usersRepo: Record<string, jest.Mock>;
  let trucksRepo: Record<string, jest.Mock>;
  let visionService: Record<string, jest.Mock>;
  let afipService: Record<string, jest.Mock>;

  beforeEach(() => {
    documentsRepo = {
      delete: jest.fn(),
      create: jest.fn((d) => d),
      save: jest.fn((d) => Promise.resolve({ id: 'doc-1', ...d })),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
    };
    usersRepo = {
      findOne: jest.fn(),
      findOneBy: jest.fn(),
      findBy: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
    };
    trucksRepo = {
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    };
    visionService = {
      extractTextFromFile: jest.fn().mockResolvedValue(''),
      isDniDocument: jest.fn().mockReturnValue(true),
      isLicenseDocument: jest.fn().mockReturnValue(true),
      isVtvDocument: jest.fn().mockReturnValue(true),
      isSeguroDocument: jest.fn().mockReturnValue(true),
      isCedulaVerdeDocument: jest.fn().mockReturnValue(true),
      isCedulaAzulDocument: jest.fn().mockReturnValue(true),
      isRucttDocument: jest.fn().mockReturnValue(true),
      dniFoundInText: jest.fn().mockReturnValue(true),
      plateFoundInText: jest.fn().mockReturnValue(true),
      extractExpiryDate: jest.fn().mockReturnValue(null),
    };
    afipService = {
      verificarIdentidad: jest.fn(),
    };

    service = new DocumentsService(
      documentsRepo as any,
      usersRepo as any,
      trucksRepo as any,
      visionService as any,
      afipService as any,
    );
  });

  // ── createDocument ────────────────────────────────────────────────────────

  describe('createDocument', () => {
    test('GIVEN tipo y url WHEN createDocument THEN borra existente y crea nuevo', async () => {
      const result = await service.createDocument('d1', 'dni', 'http://url');
      expect(documentsRepo.delete).toHaveBeenCalledWith({ driver_id: 'd1', tipo: 'dni' });
      expect(documentsRepo.save).toHaveBeenCalled();
      expect(result.status).toBe('pending');
    });
  });

  // ── getMyDocuments ────────────────────────────────────────────────────────

  describe('getMyDocuments', () => {
    test('GIVEN driverId WHEN getMyDocuments THEN busca por driver_id', async () => {
      await service.getMyDocuments('d1');
      expect(documentsRepo.find).toHaveBeenCalledWith({ where: { driver_id: 'd1' } });
    });
  });

  // ── getPendingDocuments ───────────────────────────────────────────────────

  describe('getPendingDocuments', () => {
    test('GIVEN docs pendientes WHEN getPendingDocuments THEN enriquece con nombre', async () => {
      documentsRepo.find.mockResolvedValue([{ driver_id: 'u1', tipo: 'dni' }]);
      usersRepo.findBy.mockResolvedValue([{ id: 'u1', name: 'Juan', email: 'j@x.com' }]);

      const result = await service.getPendingDocuments();
      expect(result[0].driver_name).toBe('Juan');
      expect(result[0].driver_email).toBe('j@x.com');
    });

    test('GIVEN sin docs WHEN getPendingDocuments THEN no consulta usuarios', async () => {
      documentsRepo.find.mockResolvedValue([]);
      await service.getPendingDocuments();
      expect(usersRepo.findBy).not.toHaveBeenCalled();
    });
  });

  // ── getAllDocuments ────────────────────────────────────────────────────────

  describe('getAllDocuments', () => {
    test('GIVEN docs existentes WHEN getAllDocuments THEN enriquece con driver info', async () => {
      documentsRepo.find.mockResolvedValue([{ driver_id: 'u1' }]);
      usersRepo.findBy.mockResolvedValue([{ id: 'u1', name: 'Ana', email: 'a@x.com' }]);

      const result = await service.getAllDocuments();
      expect(result[0].driver_name).toBe('Ana');
    });
  });

  // ── getDniStatus ──────────────────────────────────────────────────────────

  describe('getDniStatus', () => {
    test('GIVEN usuario existe WHEN getDniStatus THEN devuelve estado', async () => {
      usersRepo.findOne.mockResolvedValue({ dni_verified: true, dni_photo_url: 'url' });
      const result = await service.getDniStatus('u1');
      expect(result.dni_verified).toBe(true);
    });

    test('GIVEN usuario no existe WHEN getDniStatus THEN lanza NotFoundException', async () => {
      usersRepo.findOne.mockResolvedValue(null);
      await expect(service.getDniStatus('u1')).rejects.toThrow(NotFoundException);
    });
  });

  // ── verifyDni ─────────────────────────────────────────────────────────────

  describe('verifyDni', () => {
    const user = { id: 'u1', dni: '30123456' };

    test('GIVEN usuario no existe WHEN verifyDni THEN lanza NotFoundException', async () => {
      usersRepo.findOne.mockResolvedValue(null);
      await expect(service.verifyDni('u1', '/path')).rejects.toThrow(NotFoundException);
    });

    test('GIVEN usuario sin DNI WHEN verifyDni THEN lanza BadRequestException', async () => {
      usersRepo.findOne.mockResolvedValue({ id: 'u1', dni: null });
      await expect(service.verifyDni('u1', '/path')).rejects.toThrow(BadRequestException);
    });

    test('GIVEN documento no es DNI WHEN verifyDni THEN devuelve verified false', async () => {
      usersRepo.findOne.mockResolvedValue(user);
      visionService.isDniDocument.mockReturnValue(false);
      const result = await service.verifyDni('u1', '/path');
      expect(result.verified).toBe(false);
    });

    test('GIVEN DNI coincide WHEN verifyDni THEN devuelve verified true y actualiza', async () => {
      usersRepo.findOne.mockResolvedValue(user);
      visionService.dniFoundInText.mockReturnValue(true);
      const result = await service.verifyDni('u1', '/path/foto.jpg');
      expect(result.verified).toBe(true);
      expect(usersRepo.update).toHaveBeenCalledWith(
        { id: 'u1' },
        expect.objectContaining({ dni_verified: true }),
      );
    });

    test('GIVEN DNI no coincide WHEN verifyDni THEN devuelve verified false y actualiza photo_url', async () => {
      usersRepo.findOne.mockResolvedValue(user);
      visionService.dniFoundInText.mockReturnValue(false);
      const result = await service.verifyDni('u1', '/path/foto.jpg');
      expect(result.verified).toBe(false);
      expect(usersRepo.update).toHaveBeenCalledWith({ id: 'u1' }, expect.objectContaining({ dni_photo_url: expect.any(String) }));
    });
  });

  // ── verifyLicense ─────────────────────────────────────────────────────────

  describe('verifyLicense', () => {
    const user = { id: 'u1', dni: '30123456' };

    test('GIVEN usuario no existe WHEN verifyLicense THEN lanza NotFoundException', async () => {
      usersRepo.findOne.mockResolvedValue(null);
      await expect(service.verifyLicense('u1', '/path')).rejects.toThrow(NotFoundException);
    });

    test('GIVEN usuario sin DNI WHEN verifyLicense THEN lanza BadRequestException', async () => {
      usersRepo.findOne.mockResolvedValue({ id: 'u1', dni: null });
      await expect(service.verifyLicense('u1', '/path')).rejects.toThrow(BadRequestException);
    });

    test('GIVEN no es licencia WHEN verifyLicense THEN devuelve false', async () => {
      usersRepo.findOne.mockResolvedValue(user);
      visionService.isLicenseDocument.mockReturnValue(false);
      const result = await service.verifyLicense('u1', '/path');
      expect(result.verified).toBe(false);
    });

    test('GIVEN DNI coincide WHEN verifyLicense THEN actualiza license_verified', async () => {
      usersRepo.findOne.mockResolvedValue(user);
      visionService.dniFoundInText.mockReturnValue(true);
      const result = await service.verifyLicense('u1', '/path');
      expect(result.verified).toBe(true);
      expect(usersRepo.update).toHaveBeenCalledWith({ id: 'u1' }, { license_verified: true });
    });

    test('GIVEN DNI no coincide en licencia WHEN verifyLicense THEN devuelve verified false', async () => {
      usersRepo.findOne.mockResolvedValue(user);
      visionService.dniFoundInText.mockReturnValue(false);
      const result = await service.verifyLicense('u1', '/path');
      expect(result.verified).toBe(false);
    });
  });

  // ── verifyTruckVtv ────────────────────────────────────────────────────────

  describe('verifyTruckVtv', () => {
    const truck = { id: 't1', owner_id: 'u1', patente: 'AB123CD' };

    test('GIVEN camión no existe WHEN verifyTruckVtv THEN lanza NotFoundException', async () => {
      trucksRepo.findOne.mockResolvedValue(null);
      await expect(service.verifyTruckVtv('u1', 't1', '/p')).rejects.toThrow(NotFoundException);
    });

    test('GIVEN no es owner WHEN verifyTruckVtv THEN lanza ForbiddenException', async () => {
      trucksRepo.findOne.mockResolvedValue({ ...truck, owner_id: 'otro' });
      await expect(service.verifyTruckVtv('u1', 't1', '/p')).rejects.toThrow(ForbiddenException);
    });

    test('GIVEN no es documento VTV WHEN verifyTruckVtv THEN devuelve verified false', async () => {
      trucksRepo.findOne.mockResolvedValue(truck);
      visionService.isVtvDocument.mockReturnValue(false);
      const result = await service.verifyTruckVtv('u1', 't1', '/p');
      expect(result.verified).toBe(false);
    });

    test('GIVEN patente no encontrada en VTV WHEN verifyTruckVtv THEN devuelve verified false', async () => {
      trucksRepo.findOne.mockResolvedValue(truck);
      visionService.plateFoundInText.mockReturnValue(false);
      const result = await service.verifyTruckVtv('u1', 't1', '/p');
      expect(result.verified).toBe(false);
    });

    test('GIVEN VTV válida con patente WHEN verifyTruckVtv THEN devuelve verified true', async () => {
      trucksRepo.findOne.mockResolvedValue(truck);
      const result = await service.verifyTruckVtv('u1', 't1', '/p');
      expect(result.verified).toBe(true);
    });

    test('GIVEN VTV válida con fecha de vencimiento futura WHEN verifyTruckVtv THEN incluye expiry en respuesta', async () => {
      trucksRepo.findOne.mockResolvedValue(truck);
      visionService.extractExpiryDate.mockReturnValue(new Date('2030-06-01'));
      const result = await service.verifyTruckVtv('u1', 't1', '/p');
      expect(result.verified).toBe(true);
      expect(result.expiry).toBe('2030-06-01');
    });

    test('GIVEN VTV vencida WHEN verifyTruckVtv THEN devuelve verified false', async () => {
      trucksRepo.findOne.mockResolvedValue(truck);
      visionService.extractExpiryDate.mockReturnValue(new Date('2020-01-01'));
      const result = await service.verifyTruckVtv('u1', 't1', '/p');
      expect(result.verified).toBe(false);
    });
  });

  // ── verifyTruckSeguro ─────────────────────────────────────────────────────

  describe('verifyTruckSeguro', () => {
    const truck = { id: 't1', owner_id: 'u1', patente: 'AB123CD' };

    test('GIVEN no es póliza de seguro WHEN verifyTruckSeguro THEN devuelve verified false', async () => {
      trucksRepo.findOne.mockResolvedValue(truck);
      visionService.isSeguroDocument.mockReturnValue(false);
      const result = await service.verifyTruckSeguro('u1', 't1', '/p');
      expect(result.verified).toBe(false);
    });

    test('GIVEN patente no encontrada en seguro WHEN verifyTruckSeguro THEN devuelve verified false', async () => {
      trucksRepo.findOne.mockResolvedValue(truck);
      visionService.plateFoundInText.mockReturnValue(false);
      const result = await service.verifyTruckSeguro('u1', 't1', '/p');
      expect(result.verified).toBe(false);
    });

    test('GIVEN seguro válido WHEN verifyTruckSeguro THEN devuelve verified true', async () => {
      trucksRepo.findOne.mockResolvedValue(truck);
      const result = await service.verifyTruckSeguro('u1', 't1', '/p');
      expect(result.verified).toBe(true);
    });

    test('GIVEN seguro con fecha futura WHEN verifyTruckSeguro THEN incluye expiry', async () => {
      trucksRepo.findOne.mockResolvedValue(truck);
      visionService.extractExpiryDate.mockReturnValue(new Date('2030-06-01'));
      const result = await service.verifyTruckSeguro('u1', 't1', '/p');
      expect(result.verified).toBe(true);
      expect(result.expiry).toBe('2030-06-01');
    });

    test('GIVEN seguro vencido WHEN verifyTruckSeguro THEN devuelve verified false', async () => {
      trucksRepo.findOne.mockResolvedValue(truck);
      visionService.extractExpiryDate.mockReturnValue(new Date('2020-01-01'));
      const result = await service.verifyTruckSeguro('u1', 't1', '/p');
      expect(result.verified).toBe(false);
    });
  });

  // ── verifyCedulaVerde ─────────────────────────────────────────────────────

  describe('verifyCedulaVerde', () => {
    const truck = { id: 't1', owner_id: 'u1', patente: 'AB123CD' };

    test('GIVEN camión no existe WHEN verifyCedulaVerde THEN lanza NotFoundException', async () => {
      trucksRepo.findOne.mockResolvedValue(null);
      await expect(service.verifyCedulaVerde('u1', 't1', '/p')).rejects.toThrow(NotFoundException);
    });

    test('GIVEN no es owner WHEN verifyCedulaVerde THEN lanza ForbiddenException', async () => {
      trucksRepo.findOne.mockResolvedValue({ ...truck, owner_id: 'otro' });
      await expect(service.verifyCedulaVerde('u1', 't1', '/p')).rejects.toThrow(ForbiddenException);
    });

    test('GIVEN no es cédula verde WHEN verifyCedulaVerde THEN devuelve verified false', async () => {
      trucksRepo.findOne.mockResolvedValue(truck);
      visionService.isCedulaVerdeDocument.mockReturnValue(false);
      const result = await service.verifyCedulaVerde('u1', 't1', '/p');
      expect(result.verified).toBe(false);
    });

    test('GIVEN cédula verde válida WHEN verifyCedulaVerde THEN actualiza truck', async () => {
      trucksRepo.findOne.mockResolvedValue(truck);
      const result = await service.verifyCedulaVerde('u1', 't1', '/p');
      expect(result.verified).toBe(true);
      expect(trucksRepo.update).toHaveBeenCalledWith({ id: 't1' }, { cedula_verde_verified: true });
    });

    test('GIVEN patente no coincide WHEN verifyCedulaVerde THEN devuelve false', async () => {
      trucksRepo.findOne.mockResolvedValue(truck);
      visionService.plateFoundInText.mockReturnValue(false);
      const result = await service.verifyCedulaVerde('u1', 't1', '/p');
      expect(result.verified).toBe(false);
    });
  });

  // ── verifyCedulaAzul ──────────────────────────────────────────────────────

  describe('verifyCedulaAzul', () => {
    test('GIVEN usuario no existe WHEN verifyCedulaAzul THEN lanza NotFoundException', async () => {
      usersRepo.findOne.mockResolvedValue(null);
      await expect(service.verifyCedulaAzul('u1', '/p')).rejects.toThrow(NotFoundException);
    });

    test('GIVEN usuario sin DNI WHEN verifyCedulaAzul THEN verifica sin chequear DNI', async () => {
      usersRepo.findOne.mockResolvedValue({ id: 'u1', dni: null });
      const result = await service.verifyCedulaAzul('u1', '/p');
      expect(result.verified).toBe(true);
      expect(visionService.dniFoundInText).not.toHaveBeenCalled();
    });

    test('GIVEN cédula azul válida WHEN verifyCedulaAzul THEN actualiza user', async () => {
      usersRepo.findOne.mockResolvedValue({ id: 'u1', dni: '30123456' });
      const result = await service.verifyCedulaAzul('u1', '/p');
      expect(result.verified).toBe(true);
      expect(usersRepo.update).toHaveBeenCalledWith({ id: 'u1' }, { cedula_azul_verified: true });
    });

    test('GIVEN DNI no coincide WHEN verifyCedulaAzul THEN devuelve false', async () => {
      usersRepo.findOne.mockResolvedValue({ id: 'u1', dni: '30123456' });
      visionService.dniFoundInText.mockReturnValue(false);
      const result = await service.verifyCedulaAzul('u1', '/p');
      expect(result.verified).toBe(false);
    });
  });

  // ── verifyRuctt ───────────────────────────────────────────────────────────

  describe('verifyRuctt', () => {
    test('GIVEN usuario no existe WHEN verifyRuctt THEN lanza NotFoundException', async () => {
      usersRepo.findOne.mockResolvedValue(null);
      await expect(service.verifyRuctt('u1', '/p')).rejects.toThrow(NotFoundException);
    });

    test('GIVEN RUCTT válido WHEN verifyRuctt THEN actualiza user', async () => {
      usersRepo.findOne.mockResolvedValue({ id: 'u1' });
      const result = await service.verifyRuctt('u1', '/p');
      expect(result.verified).toBe(true);
      expect(usersRepo.update).toHaveBeenCalledWith({ id: 'u1' }, { ructt_verified: true });
    });

    test('GIVEN no es RUCTT WHEN verifyRuctt THEN devuelve false', async () => {
      usersRepo.findOne.mockResolvedValue({ id: 'u1' });
      visionService.isRucttDocument.mockReturnValue(false);
      const result = await service.verifyRuctt('u1', '/p');
      expect(result.verified).toBe(false);
    });
  });

  // ── verifyIdentityAfip ────────────────────────────────────────────────────

  describe('verifyIdentityAfip', () => {
    test('GIVEN usuario sin DNI WHEN verifyIdentityAfip THEN lanza BadRequest', async () => {
      usersRepo.findOneBy.mockResolvedValue({ id: 'u1', dni: null });
      await expect(service.verifyIdentityAfip('u1')).rejects.toThrow(BadRequestException);
    });

    test('GIVEN DNI no verificado WHEN verifyIdentityAfip THEN lanza BadRequest', async () => {
      usersRepo.findOneBy.mockResolvedValue({ id: 'u1', dni: '123', dni_verified: false });
      await expect(service.verifyIdentityAfip('u1')).rejects.toThrow(BadRequestException);
    });

    test('GIVEN ya verificado WHEN verifyIdentityAfip THEN devuelve true sin consultar', async () => {
      usersRepo.findOneBy.mockResolvedValue({ id: 'u1', dni: '123', dni_verified: true, identity_verified: true });
      const result = await service.verifyIdentityAfip('u1');
      expect(result.verified).toBe(true);
      expect(afipService.verificarIdentidad).not.toHaveBeenCalled();
    });

    test('GIVEN AFIP confirma WHEN verifyIdentityAfip THEN actualiza identity_verified', async () => {
      usersRepo.findOneBy.mockResolvedValue({ id: 'u1', dni: '123', dni_verified: true, identity_verified: false, name: 'Juan' });
      afipService.verificarIdentidad.mockResolvedValue({ verified: true, cuil_encontrado: '20001234563', message: 'OK' });
      const result = await service.verifyIdentityAfip('u1');
      expect(result.verified).toBe(true);
      expect(usersRepo.update).toHaveBeenCalledWith('u1', { identity_verified: true });
    });
  });

  // ── getIdentityStatus ─────────────────────────────────────────────────────

  describe('getIdentityStatus', () => {
    test('GIVEN usuario existe WHEN getIdentityStatus THEN devuelve estado', async () => {
      usersRepo.findOneBy.mockResolvedValue({ identity_verified: true, dni_verified: true });
      const result = await service.getIdentityStatus('u1');
      expect(result.identity_verified).toBe(true);
    });
  });

  // ── getDriverVerificationStatus ───────────────────────────────────────────

  describe('getDriverVerificationStatus', () => {
    test('GIVEN usuario WHEN getDriverVerificationStatus THEN devuelve todos los flags', async () => {
      usersRepo.findOne.mockResolvedValue({
        dni_verified: true,
        license_verified: false,
        ructt_verified: true,
        cedula_azul_verified: false,
        dni_photo_url: 'url',
      });
      const result = await service.getDriverVerificationStatus('u1');
      expect(result.dni_verified).toBe(true);
      expect(result.license_verified).toBe(false);
    });
  });

  // ── updateStatus ──────────────────────────────────────────────────────────

  describe('updateStatus', () => {
    test('GIVEN doc no existe WHEN updateStatus THEN lanza NotFoundException', async () => {
      documentsRepo.findOne.mockResolvedValue(null);
      await expect(service.updateStatus('x', 'a1', 'approved')).rejects.toThrow(NotFoundException);
    });

    test('GIVEN doc aprobado y todos tipos aprobados WHEN updateStatus THEN marca is_verified true', async () => {
      const doc = { id: 'doc-1', driver_id: 'd1', status: 'pending', admin_note: null, reviewed_by: null, reviewed_at: null };
      documentsRepo.findOne.mockResolvedValue(doc);
      documentsRepo.save.mockResolvedValue(doc);
      documentsRepo.find.mockResolvedValue([
        { tipo: 'dni', status: 'approved' },
        { tipo: 'vtv', status: 'approved' },
        { tipo: 'seguro', status: 'approved' },
        { tipo: 'carnet', status: 'approved' },
      ]);

      await service.updateStatus('doc-1', 'admin-1', 'approved', 'OK');
      expect(usersRepo.update).toHaveBeenCalledWith({ id: 'd1' }, { is_verified: true });
    });

    test('GIVEN falta tipo aprobado WHEN updateStatus THEN is_verified false', async () => {
      const doc = { id: 'doc-1', driver_id: 'd1', status: 'pending', admin_note: null, reviewed_by: null, reviewed_at: null };
      documentsRepo.findOne.mockResolvedValue(doc);
      documentsRepo.save.mockResolvedValue(doc);
      documentsRepo.find.mockResolvedValue([
        { tipo: 'dni', status: 'approved' },
        { tipo: 'vtv', status: 'pending' },
      ]);

      await service.updateStatus('doc-1', 'admin-1', 'approved');
      expect(usersRepo.update).toHaveBeenCalledWith({ id: 'd1' }, { is_verified: false });
    });
  });
});
