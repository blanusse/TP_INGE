import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminService } from './admin.service';

type AuthReq = { user: { id: string; role: string } };

@Controller('admin')
@UseGuards(JwtAuthGuard)
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('users')
  listUsers(
    @Request() req: AuthReq,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.adminService.listUsers(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 50,
      search,
    );
  }

  @Patch('users/:id/status')
  updateUserStatus(
    @Request() req: AuthReq,
    @Param('id') targetId: string,
    @Body('action') action: string,
    @Body('reason') reason?: string,
  ) {
    return this.adminService.updateUserStatus(req.user.id, targetId, action, reason);
  }

  @Get('audit-log')
  getAuditLog(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getAuditLog(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 50,
    );
  }
}
