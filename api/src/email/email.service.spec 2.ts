import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';

const mockConfig = {
  get: jest.fn((key: string) => {
    const values: Record<string, string> = {
      EMAILJS_SERVICE_ID: 'svc',
      EMAILJS_TEMPLATE_ID: 'tpl',
      EMAILJS_PUBLIC_KEY: 'pub',
      EMAILJS_PRIVATE_KEY: 'priv',
    };
    return values[key];
  }),
};

describe('EmailService', () => {
  let service: EmailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('sends verification code successfully', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true } as Response);

    await expect(
      service.sendVerificationCode('a@b.com', 'Ana', '123456'),
    ).resolves.toBeUndefined();

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.emailjs.com/api/v1.0/email/send',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('throws when EmailJS returns non-ok response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: jest.fn().mockResolvedValue('Bad Request'),
    } as unknown as Response);

    await expect(
      service.sendVerificationCode('a@b.com', 'Ana', '123456'),
    ).rejects.toThrow('EmailJS error: Bad Request');
  });
});
