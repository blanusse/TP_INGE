jest.mock('fs', () => ({ mkdirSync: jest.fn() }));
jest.mock('@nestjs/axios', () => ({ HttpService: class {} }));
jest.mock('typeorm', () => ({
  Repository: class {},
  In: jest.fn(),
  Entity: () => () => {},
  Column: () => () => {},
  PrimaryGeneratedColumn: () => () => {},
  CreateDateColumn: () => () => {},
  UpdateDateColumn: () => () => {},
  ManyToOne: () => () => {},
  JoinColumn: () => () => {},
}));
jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => {},
  getRepositoryToken: () => 'REPO_TOKEN',
}));

import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

describe('DocumentsController', () => {
  let controller: DocumentsController;
  let service: Record<string, jest.Mock>;

  const REQ = { user: { id: 'u1', role: 'transportista', email: 'test@test.com' } };
  const ADMIN_REQ = { user: { id: 'a1', role: 'admin', email: 'admin@test.com' } };

  beforeEach(async () => {
    service = {
      createDocument: jest.fn().mockResolvedValue({ id: 'doc-1' }),
      getMyDocuments: jest.fn().mockResolvedValue([]),
      verifyIdentityAfip: jest.fn().mockResolvedValue({ verified: true }),
      getIdentityStatus: jest.fn().mockResolvedValue({ identity_verified: true }),
      getDniStatus: jest.fn().mockResolvedValue({ dni_verified: true }),
      getDriverVerificationStatus: jest.fn().mockResolvedValue({}),
      verifyLicense: jest.fn().mockResolvedValue({ verified: true }),
      verifyTruckVtv: jest.fn().mockResolvedValue({ verified: true }),
      verifyTruckSeguro: jest.fn().mockResolvedValue({ verified: true }),
      verifyDni: jest.fn().mockResolvedValue({ verified: true }),
      verifyCedulaVerde: jest.fn().mockResolvedValue({ verified: true }),
      verifyCedulaAzul: jest.fn().mockResolvedValue({ verified: true }),
      verifyRuctt: jest.fn().mockResolvedValue({ verified: true }),
      getPendingDocuments: jest.fn().mockResolvedValue([]),
      getAllDocuments: jest.fn().mockResolvedValue([]),
      updateStatus: jest.fn().mockResolvedValue({ id: 'doc-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DocumentsController],
      providers: [{ provide: DocumentsService, useValue: service }],
    }).compile();

    controller = module.get<DocumentsController>(DocumentsController);
  });

  test('GIVEN usuario WHEN getMyDocuments THEN delega con userId', async () => {
    await controller.getMyDocuments(REQ);
    expect(service.getMyDocuments).toHaveBeenCalledWith('u1');
  });

  test('GIVEN usuario WHEN verifyIdentity THEN delega con userId', async () => {
    await controller.verifyIdentity(REQ);
    expect(service.verifyIdentityAfip).toHaveBeenCalledWith('u1');
  });

  test('GIVEN usuario WHEN getIdentityStatus THEN delega', async () => {
    await controller.getIdentityStatus(REQ);
    expect(service.getIdentityStatus).toHaveBeenCalledWith('u1');
  });

  test('GIVEN admin WHEN getPending THEN delega', async () => {
    await controller.getPending(ADMIN_REQ);
    expect(service.getPendingDocuments).toHaveBeenCalled();
  });

  test('GIVEN no admin WHEN getPending THEN lanza ForbiddenException', () => {
    expect(() => controller.getPending(REQ)).toThrow(ForbiddenException);
  });

  test('GIVEN admin WHEN updateStatus THEN delega con params', async () => {
    await controller.updateStatus(ADMIN_REQ, 'doc-1', { status: 'approved', admin_note: 'ok' });
    expect(service.updateStatus).toHaveBeenCalledWith('doc-1', 'a1', 'approved', 'ok');
  });

  test('GIVEN no admin WHEN updateStatus THEN lanza ForbiddenException', () => {
    expect(() => controller.updateStatus(REQ, 'doc-1', { status: 'approved' })).toThrow(ForbiddenException);
  });

  test('GIVEN usuario WHEN getDniStatus THEN delega con userId', async () => {
    await controller.getDniStatus(REQ);
    expect(service.getDniStatus).toHaveBeenCalledWith('u1');
  });

  test('GIVEN usuario WHEN getDriverStatus THEN delega con userId', async () => {
    await controller.getDriverStatus(REQ);
    expect(service.getDriverVerificationStatus).toHaveBeenCalledWith('u1');
  });

  test('GIVEN file WHEN verifyLicense THEN delega con userId y path', async () => {
    const file = { path: '/uploads/license.jpg' } as any;
    await controller.verifyLicense(REQ, file);
    expect(service.verifyLicense).toHaveBeenCalledWith('u1', '/uploads/license.jpg');
  });

  test('GIVEN file y truckId WHEN verifyTruckVtv THEN delega correctamente', async () => {
    const file = { path: '/uploads/vtv.jpg' } as any;
    await controller.verifyTruckVtv(REQ, 'truck-1', file);
    expect(service.verifyTruckVtv).toHaveBeenCalledWith('u1', 'truck-1', '/uploads/vtv.jpg');
  });

  test('GIVEN file y truckId WHEN verifyTruckSeguro THEN delega correctamente', async () => {
    const file = { path: '/uploads/seguro.jpg' } as any;
    await controller.verifyTruckSeguro(REQ, 'truck-1', file);
    expect(service.verifyTruckSeguro).toHaveBeenCalledWith('u1', 'truck-1', '/uploads/seguro.jpg');
  });

  test('GIVEN file WHEN verifyDni THEN delega con userId y path', async () => {
    const file = { path: '/uploads/dni.jpg' } as any;
    await controller.verifyDni(REQ, file);
    expect(service.verifyDni).toHaveBeenCalledWith('u1', '/uploads/dni.jpg');
  });

  test('GIVEN file y truckId WHEN verifyCedulaVerde THEN delega correctamente', async () => {
    const file = { path: '/uploads/cedula.jpg' } as any;
    await controller.verifyCedulaVerde(REQ, 'truck-1', file);
    expect(service.verifyCedulaVerde).toHaveBeenCalledWith('u1', 'truck-1', '/uploads/cedula.jpg');
  });

  test('GIVEN file WHEN verifyCedulaAzul THEN delega con userId y path', async () => {
    const file = { path: '/uploads/azul.jpg' } as any;
    await controller.verifyCedulaAzul(REQ, file);
    expect(service.verifyCedulaAzul).toHaveBeenCalledWith('u1', '/uploads/azul.jpg');
  });

  test('GIVEN file WHEN verifyRuctt THEN delega con userId y path', async () => {
    const file = { path: '/uploads/ructt.jpg' } as any;
    await controller.verifyRuctt(REQ, file);
    expect(service.verifyRuctt).toHaveBeenCalledWith('u1', '/uploads/ructt.jpg');
  });

  test('GIVEN file y tipo WHEN uploadDocument THEN construye url y delega al service', async () => {
    process.env.BACKEND_URL = 'http://test.com';
    const file = { filename: 'doc.jpg' } as any;
    await controller.uploadDocument(REQ, file, { tipo: 'dni' } as any);
    expect(service.createDocument).toHaveBeenCalledWith('u1', 'dni', 'http://test.com/uploads/documents/doc.jpg');
  });

  test('GIVEN admin WHEN getAll THEN delega al service', async () => {
    await controller.getAll(ADMIN_REQ);
    expect(service.getAllDocuments).toHaveBeenCalled();
  });

  test('GIVEN no admin WHEN getAll THEN lanza ForbiddenException', () => {
    expect(() => controller.getAll(REQ)).toThrow(ForbiddenException);
  });
});
