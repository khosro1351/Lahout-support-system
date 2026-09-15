import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AppError } from '../common/app-error';
import type { AuthenticatedRequest } from './session.guard';

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers['x-csrf-token'];
    const provided = Array.isArray(header) ? header[0] : header;
    if (!provided || provided !== request.user.csrfToken) {
      throw new AppError(403, 'CSRF_FAILED', 'درخواست امنیتی معتبر نیست. صفحه را تازه‌سازی و دوباره تلاش کنید.');
    }
    return true;
  }
}
