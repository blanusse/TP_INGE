import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private config: ConfigService) {}

  async sendVerificationCode(to: string, name: string, code: string): Promise<void> {
    const serviceId  = this.config.get<string>('EMAILJS_SERVICE_ID');
    const templateId = this.config.get<string>('EMAILJS_TEMPLATE_ID');
    const publicKey  = this.config.get<string>('EMAILJS_PUBLIC_KEY');
    const privateKey = this.config.get<string>('EMAILJS_PRIVATE_KEY');

    const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id:  serviceId,
        template_id: templateId,
        user_id:     publicKey,
        accessToken: privateKey,
        template_params: {
          to_email: to,
          to_name:  name,
          code,
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`EmailJS error ${res.status}: ${text}`);
      throw new Error(`EmailJS error: ${text}`);
    }
  }
}
