import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * En desarrollo (NODE_ENV !== 'production') deja pasar la request aunque no
 * haya un JWT válido, dejando `req.user` en null. En producción se comporta
 * exactamente como JwtAuthGuard: exige un token válido o lanza 401.
 *
 * Pensado para endpoints de solo-lectura usados por la página /dev/mapa, que
 * antes eran públicos y el endurecimiento de auth cerró.
 */
@Injectable()
export class DevPublicJwtGuard extends AuthGuard('jwt') {
  handleRequest<TUser = unknown>(
    err: unknown,
    user: TUser,
    _info: unknown,
    _context: ExecutionContext,
  ): TUser {
    if (process.env.NODE_ENV !== 'production') {
      // En dev: permitir sin autenticar. user queda null si no hay token.
      return (user ?? null) as TUser;
    }
    if (err || !user) {
      throw err instanceof Error ? err : new UnauthorizedException();
    }
    return user;
  }
}
