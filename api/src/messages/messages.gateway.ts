import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Offer } from '../entities/offer.entity';
import { Load } from '../entities/load.entity';
import { Shipper } from '../entities/shipper.entity';
import { Message } from '../entities/message.entity';
import { User } from '../entities/user.entity';

@WebSocketGateway({ namespace: 'messages' })
export class MessagesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private jwtService: JwtService,
    @InjectRepository(Offer) private offersRepo: Repository<Offer>,
    @InjectRepository(Load) private loadsRepo: Repository<Load>,
    @InjectRepository(Shipper) private shippersRepo: Repository<Shipper>,
    @InjectRepository(Message) private messagesRepo: Repository<Message>,
    @InjectRepository(User) private usersRepo: Repository<User>,
  ) {}

  private extractUserId(client: Socket): string | null {
    const token =
      client.handshake.auth?.token ??
      client.handshake.headers?.authorization?.replace('Bearer ', '');
    if (!token) return null;
    try {
      const payload = this.jwtService.verify(token);
      return payload.sub ?? payload.id ?? null;
    } catch {
      return null;
    }
  }

  handleConnection(client: Socket) {
    const userId = this.extractUserId(client);
    if (!userId) {
      client.disconnect();
      return;
    }
    client.data.userId = userId;
  }

  handleDisconnect(_client: Socket) {}

  @SubscribeMessage('join')
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() offerId: string,
  ) {
    const userId = client.data.userId as string;
    if (!userId) { client.disconnect(); return; }

    const offer = await this.offersRepo.findOne({ where: { id: offerId } });
    if (!offer) return;

    const load = await this.loadsRepo.findOne({ where: { id: offer.load_id } });
    if (!load || !['matched', 'in_transit'].includes(load.status)) return;

    const shipper = await this.shippersRepo.findOne({ where: { user_id: userId } });
    const isDriver = offer.driver_id === userId;
    const isShipper = shipper && load.shipper_id === shipper.id;
    if (!isDriver && !isShipper) return;

    client.join(offerId);
    client.emit('joined', offerId);
  }

  emitNewMessage(offerId: string, message: Message & { sender_name?: string }) {
    this.server.to(offerId).emit('new_message', message);
  }
}
