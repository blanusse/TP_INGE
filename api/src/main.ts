import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
  });

  // Health check para Railway
  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get('/health', (_req, res) => res.send({ status: 'ok' }));

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
