import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';
import { ThrottlerLimitDetail, ThrottlerRequest } from '@nestjs/throttler/dist/throttler.guard.interface';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  /**
   * Selecciona el throttler correcto según si el request tiene un JWT:
   *  - Sin auth  → aplica el límite 'public' (60 req/min)
   *  - Con auth  → aplica el límite 'authenticated' (120 req/min)
   *  - Endpoints de auth mantienen su propio límite 'auth' via @Throttle()
   */
  protected async handleRequest(requestProps: ThrottlerRequest): Promise<boolean> {
    const { context, throttler } = requestProps;
    const { req } = this.getRequestResponse(context);
    const hasAuth = !!(req.headers?.authorization as string | undefined);

    if (throttler.name === 'public' && hasAuth) return true;
    if (throttler.name === 'authenticated' && !hasAuth) return true;

    return super.handleRequest(requestProps);
  }

  /**
   * Agrega el header Retry-After (en segundos) antes de lanzar el 429.
   */
  protected async throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: ThrottlerLimitDetail,
  ): Promise<void> {
    const { res } = this.getRequestResponse(context);
    const retryAfter = Math.ceil(throttlerLimitDetail.ttl / 1000);
    (res as { header: (name: string, value: string) => void }).header(
      'Retry-After',
      String(retryAfter),
    );
    throw new ThrottlerException();
  }
}
