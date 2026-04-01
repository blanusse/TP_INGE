import { Controller, Get, Post, Body, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MessagesService } from './messages.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private messagesService: MessagesService) {}

  @Get('messages')
  getMessages(@Request() req, @Query('offerId') offerId: string) {
    return this.messagesService.getMessages(req.user.id, offerId);
  }

  @Post('messages')
  sendMessage(@Request() req, @Body() body) {
    return this.messagesService.sendMessage(req.user.id, body);
  }

  @Get('conversations')
  getConversations(@Request() req) {
    return this.messagesService.getConversations(req.user.id);
  }
}
