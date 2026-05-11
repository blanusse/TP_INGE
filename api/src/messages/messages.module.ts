import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Message } from '../entities/message.entity';
import { Offer } from '../entities/offer.entity';
import { Load } from '../entities/load.entity';
import { Shipper } from '../entities/shipper.entity';
import { User } from '../entities/user.entity';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { MessagesGateway } from './messages.gateway';

@Module({
  imports: [
    TypeOrmModule.forFeature([Message, Offer, Load, Shipper, User]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [MessagesController],
  providers: [MessagesService, MessagesGateway],
  exports: [MessagesGateway],
})
export class MessagesModule {}
