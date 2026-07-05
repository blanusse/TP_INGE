import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { InsuranceConfirmationMailService } from './insurance-confirmation-mail.service';

const mockSend = jest.fn();

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: mockSend,
    },
  })),
}));

describe('InsuranceConfirmationMailService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sends policy confirmation email via Resend when API key is configured', async () => {
    mockSend.mockResolvedValue({ data: { id: 'mail-1' }, error: null });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InsuranceConfirmationMailService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              ({
                RESEND_API_KEY: 're_test',
                RESEND_FROM_EMAIL: 'seguros@cargaback.com',
              })[key],
          },
        },
      ],
    }).compile();

    const service = module.get<InsuranceConfirmationMailService>(
      InsuranceConfirmationMailService,
    );

    await service.sendPolicyConfirmation({
      to: 'shipper@test.com',
      userName: 'Dador',
      insuranceName: 'Plan Basico',
      insurerName: 'Aseguradora SA',
      coverageType: 'todo-riesgo',
      tripSummary: 'Buenos Aires -> Cordoba',
      loadId: 'load-1',
      coverageStartsAt: new Date('2026-05-20T10:00:00.000Z'),
      coverageEndsAt: new Date('2026-06-20T10:00:00.000Z'),
      premium: 18000,
    });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'shipper@test.com',
        subject: expect.stringContaining('Confirmacion de contratacion de seguro'),
        from: 'CargaBack <seguros@cargaback.com>',
        text: expect.stringContaining('Seguro: Plan Basico'),
        html: expect.stringContaining('Aseguradora SA'),
      }),
    );

    const payload = mockSend.mock.calls[0]?.[0];
    expect(payload.text).toEqual(expect.stringContaining('Viaje asociado: Buenos Aires -> Cordoba'));
    expect(payload.text).toEqual(expect.stringContaining('Vigencia:'));
    expect(payload.html).toEqual(expect.stringContaining('Plan Basico'));
    expect(payload.html).toEqual(expect.stringContaining('Viaje asociado'));
  });

  it('does not attempt to send when RESEND_API_KEY is missing', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InsuranceConfirmationMailService,
        {
          provide: ConfigService,
          useValue: {
            get: () => undefined,
          },
        },
      ],
    }).compile();

    const service = module.get<InsuranceConfirmationMailService>(
      InsuranceConfirmationMailService,
    );

    await service.sendPolicyConfirmation({
      to: 'shipper@test.com',
      userName: 'Dador',
      insuranceName: 'Plan Basico',
      insurerName: 'Aseguradora SA',
      coverageType: 'todo-riesgo',
      tripSummary: 'Buenos Aires -> Cordoba',
      loadId: 'load-1',
      coverageStartsAt: new Date('2026-05-20T10:00:00.000Z'),
      coverageEndsAt: new Date('2026-06-20T10:00:00.000Z'),
      premium: 18000,
    });

    expect(mockSend).not.toHaveBeenCalled();
  });
});
