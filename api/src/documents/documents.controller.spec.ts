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
});
