import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({}),
  }),
}));

import * as nodemailer from 'nodemailer';

const configValues: Record<string, string | number> = {
  MAIL_HOST: 'smtp.test.com',
  MAIL_PORT: 587,
  MAIL_USER: 'user@test.com',
  MAIL_PASS: 'pass',
  MAIL_FROM: 'noreply@test.com',
  FRONTEND_URL: 'http://localhost:3000',
  ADMIN_EMAIL: 'admin@test.com',
};

const mockConfig = {
  get: jest.fn((key: string) => configValues[key]),
};

const baseOfertaOpts = {
  dadorEmail: 'dador@test.com',
  dadorName: 'Carlos',
  camioneroName: 'Pedro',
  pickup: 'Buenos Aires',
  dropoff: 'Córdoba',
  price: 50000,
  loadId: 'load-1',
};

describe('MailService', () => {
  let service: MailService;
  let mockTransporter: { sendMail: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<MailService>(MailService);
    mockTransporter = (nodemailer.createTransport as jest.Mock).mock.results[0].value;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendNuevaOferta', () => {
    it('sends email without note', async () => {
      await service.sendNuevaOferta(baseOfertaOpts);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'dador@test.com' }),
      );
    });

    it('sends email with note', async () => {
      await service.sendNuevaOferta({ ...baseOfertaOpts, note: 'Carga frágil' });
      expect(mockTransporter.sendMail).toHaveBeenCalled();
    });
  });

  describe('sendContraofertaAceptada', () => {
    it('sends email with price', async () => {
      await service.sendContraofertaAceptada(baseOfertaOpts);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'dador@test.com' }),
      );
    });

    it('sends email without price', async () => {
      const { price: _, ...opts } = baseOfertaOpts;
      await service.sendContraofertaAceptada(opts);
      expect(mockTransporter.sendMail).toHaveBeenCalled();
    });
  });

  it('sendContraofertaRechazada sends email', async () => {
    await service.sendContraofertaRechazada(baseOfertaOpts);
    expect(mockTransporter.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'dador@test.com' }),
    );
  });

  it('sendOfertaRetirada sends email', async () => {
    await service.sendOfertaRetirada(baseOfertaOpts);
    expect(mockTransporter.sendMail).toHaveBeenCalled();
  });

  it('sendContraofertaRecibida sends email to camionero', async () => {
    await service.sendContraofertaRecibida({
      camioneroEmail: 'cam@test.com',
      camioneroName: 'Pedro',
      pickup: 'Buenos Aires',
      dropoff: 'Córdoba',
      counterPrice: 45000,
      loadId: 'load-1',
    });
    expect(mockTransporter.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'cam@test.com' }),
    );
  });

  it('sendOfertaAceptada sends email to camionero', async () => {
    await service.sendOfertaAceptada({
      camioneroEmail: 'cam@test.com',
      camioneroName: 'Pedro',
      pickup: 'Buenos Aires',
      dropoff: 'Córdoba',
      price: 50000,
      loadId: 'load-1',
    });
    expect(mockTransporter.sendMail).toHaveBeenCalled();
  });

  it('sendOfertaRechazada sends email to camionero', async () => {
    await service.sendOfertaRechazada({
      camioneroEmail: 'cam@test.com',
      camioneroName: 'Pedro',
      pickup: 'Buenos Aires',
      dropoff: 'Córdoba',
      loadId: 'load-1',
    });
    expect(mockTransporter.sendMail).toHaveBeenCalled();
  });

  it('sendInvitacionFlota sends invitation email', async () => {
    await service.sendInvitacionFlota({
      email: 'driver@test.com',
      ownerName: 'Empresa SA',
      token: 'abc123',
    });
    expect(mockTransporter.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'driver@test.com' }),
    );
  });

  describe('sendNuevoReporte', () => {
    it('sends with known reason label', async () => {
      await service.sendNuevoReporte({
        reporterName: 'Ana',
        reportedName: 'Luis',
        reason: 'fraud',
        description: 'Me estafó',
      });
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'admin@test.com' }),
      );
    });

    it('sends with unknown reason (falls back to raw value)', async () => {
      await service.sendNuevoReporte({
        reporterName: 'Ana',
        reportedName: 'Luis',
        reason: 'custom_reason',
        description: 'Otro motivo',
      });
      expect(mockTransporter.sendMail).toHaveBeenCalled();
    });
  });

  it('logs error and does not throw when sendMail fails', async () => {
    mockTransporter.sendMail.mockRejectedValueOnce(new Error('SMTP down'));
    await expect(
      service.sendNuevaOferta(baseOfertaOpts),
    ).resolves.toBeUndefined();
  });
});
