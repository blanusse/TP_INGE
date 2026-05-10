import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import * as jwt from 'jsonwebtoken';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const httpAdapter = app.getHttpAdapter();

  // Serve uploads behind JWT auth — prevents unauthenticated access to user documents
  const uploadsPath = join(process.cwd(), 'uploads');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  httpAdapter.get('/uploads/*path', (req: any, res: any, next: () => void) => {
    const authHeader = req.headers?.authorization as string | undefined;
    const queryToken = req.query?.token as string | undefined;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : queryToken;
    if (!token) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }
    try {
      jwt.verify(token, process.env.JWT_SECRET ?? '');
      next();
    } catch {
      res.status(401).json({ message: 'Invalid token' });
    }
  });
  app.useStaticAssets(uploadsPath, { prefix: '/uploads' });

  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
  });

  // Health check para Railway
  httpAdapter.get('/health', (_req, res: { send: (body: unknown) => void }) =>
    res.send({ status: 'ok' }),
  );

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
