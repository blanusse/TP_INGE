import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

type AuthReq = { user: { id: string; role: string; email: string } };
import { MessagesService } from './messages.service';
import { MessagesGateway } from './messages.gateway';

@Controller()
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(
    private messagesService: MessagesService,
    private messagesGateway: MessagesGateway,
  ) {}

  @Get('messages/unread-count')
  getUnreadCount(@Request() req: AuthReq) {
    return this.messagesService.getUnreadCount(req.user.id);
  }

  @Get('messages')
  getMessages(@Request() req: AuthReq, @Query('offerId') offerId: string) {
    return this.messagesService.getMessages(req.user.id, offerId);
  }

  @Post('messages')
  sendMessage(@Request() req: AuthReq, @Body() body) {
    return this.messagesService.sendMessage(req.user.id, body, this.messagesGateway);
  }

  @Get('conversations')
  getConversations(@Request() req: AuthReq) {
    return this.messagesService.getConversations(req.user.id);
  }
}
