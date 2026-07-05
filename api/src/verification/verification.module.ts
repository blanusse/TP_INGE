import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { IdentityVerification } from '../entities/identity-verification.entity';
import { VerificationController } from './verification.controller';
import { VerificationService } from './verification.service';
import { VERIFF_CLIENT } from './veriff-client.interface';
import { MockVeriffClient } from './mock-veriff.client';
import { RealVeriffClient } from './real-veriff.client';

// El provider se elige por env:
//   VERIFF_PROVIDER=veriff  → RealVeriffClient (requiere VERIFF_API_KEY, VERIFF_API_SECRET)
//   cualquier otra cosa    → MockVeriffClient (default, sin dependencias externas)
const veriffClientProvider = {
  provide: VERIFF_CLIENT,
  useClass:
    process.env.VERIFF_PROVIDER === 'veriff' ? RealVeriffClient : MockVeriffClient,
};

@Module({
  imports: [TypeOrmModule.forFeature([User, IdentityVerification])],
  controllers: [VerificationController],
  providers: [
    VerificationService,
    MockVeriffClient,
    RealVeriffClient,
    veriffClientProvider,
  ],
  exports: [VerificationService],
})
export class VerificationModule {}
