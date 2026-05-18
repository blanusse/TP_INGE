import { Controller, Get, Post, Delete, Patch, Body, Param, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AlertsService } from './alerts.service';

type AuthReq = { user: { id: string } };

@Controller()
@UseGuards(JwtAuthGuard)
export class AlertsController {
  constructor(private alertsService: AlertsService) {}

  // ── Alertas ──────────────────────────────────────────────────────────────────

  @Get('alerts')
  getUserAlerts(@Request() req: AuthReq) {
    return this.alertsService.getUserAlerts(req.user.id);
  }

  @Post('alerts')
  createAlert(@Request() req: AuthReq, @Body() body) {
    return this.alertsService.createAlert(req.user.id, body);
  }

  @Delete('alerts/:id')
  deleteAlert(@Request() req: AuthReq, @Param('id') id: string) {
    return this.alertsService.deleteAlert(req.user.id, id);
  }

  // ── Notificaciones ────────────────────────────────────────────────────────────

  @Get('notifications')
  getNotifications(@Request() req: AuthReq) {
    return this.alertsService.getNotifications(req.user.id);
  }

  @Get('notifications/unread-count')
  getUnreadCount(@Request() req: AuthReq) {
    return this.alertsService.getUnreadCount(req.user.id);
  }

  @Patch('notifications/read-all')
  markAllRead(@Request() req: AuthReq) {
    return this.alertsService.markAllRead(req.user.id);
  }
}
