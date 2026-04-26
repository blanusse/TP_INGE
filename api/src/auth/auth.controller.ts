import { Controller, Post, Get, Body, Query } from '@nestjs/common';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  // Máx. 5 registros cada 15 minutos por IP
  @Throttle({ auth: { ttl: 900_000, limit: 5 } })
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  // Máx. 10 intentos de login cada 15 minutos por IP (previene brute force)
  @Throttle({ auth: { ttl: 900_000, limit: 10 } })
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  // Sin límite estricto para checks en tiempo real (ya tiene el límite global)
  @SkipThrottle()
  @Get('check')
  check(@Query('field') field: string, @Query('value') value: string, @Query('email') email: string) {
    // Compatibilidad con llamadas ?email= (legacy) y ?field=email&value=
    const f = field ?? 'email';
    const v = value ?? email ?? '';
    return this.authService.checkField(f, v);
  }

  @Post('verify-email')
  verifyEmail(@Body() body: { email: string; code: string }) {
    return this.authService.verifyEmail(body.email, body.code);
  }

  @Post('resend-code')
  resendCode(@Body() body: { email: string }) {
    return this.authService.resendCode(body.email);
  }
}
