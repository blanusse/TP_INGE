import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { MpOauthController } from './mp-oauth.controller';
import { MpOauthService } from './mp-oauth.service';
import { User } from '../entities/user.entity';
import { Shipper } from '../entities/shipper.entity';
import { EmailVerification } from '../entities/email-verification.entity';
import { FleetInvitation } from '../entities/fleet-invitation.entity';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Shipper, EmailVerification, FleetInvitation]),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '30s' },
      }),
      inject: [ConfigService],
    }),
    EmailModule,
  ],
  controllers: [AuthController, MpOauthController],
  providers: [AuthService, JwtStrategy, MpOauthService],
  exports: [JwtStrategy, PassportModule],
})
export class AuthModule {}
