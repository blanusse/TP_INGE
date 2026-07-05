import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { OnboardingService } from './onboarding.service';

type AuthReq = { user?: { id?: string; email?: string } };

// Toggle por env: si ENFORCE_ONBOARDING=true, el guard bloquea con 403.
// Si está apagado (default), solo loguea un warning y deja pasar — útil para
// no romper usuarios pre-existentes que aún no completaron el flujo nuevo.
@Injectable()
export class RequireOnboardingCompleteGuard implements CanActivate {
  private readonly logger = new Logger(RequireOnboardingCompleteGuard.name);

  constructor(private onboardingService: OnboardingService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthReq>();
    const userId = req.user?.id;
    if (!userId) throw new ForbiddenException('No autorizado.');

    const status = await this.onboardingService.getStatus(userId);
    if (status.ready_to_operate) return true;

    const enforce = process.env.ENFORCE_ONBOARDING === 'true';
    const missingStep = status.next_step?.key ?? 'unknown';

    if (!enforce) {
      this.logger.warn(
        `[soft] Usuario ${req.user?.email ?? userId} sin onboarding completo (falta: ${missingStep}, ${status.percent_complete}%). ENFORCE_ONBOARDING=false → permitido.`,
      );
      return true;
    }

    throw new ForbiddenException({
      code: 'ONBOARDING_INCOMPLETE',
      message: 'Tenés que completar la configuración de tu cuenta para realizar esta acción.',
      next_step: status.next_step,
      percent_complete: status.percent_complete,
    });
  }
}
