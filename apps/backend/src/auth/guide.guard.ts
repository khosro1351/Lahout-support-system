import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AppError } from '../common/app-error';
import type { AuthenticatedRequest } from './session.guard';

@Injectable()
export class GuideGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!user.roles.some(r => r.roleCode === 'SUPREME_GUIDE' && r.scopeType === 'ORGANIZATION' && r.scopeId === null)) {
      throw new AppError(403, 'FORBIDDEN', 'دسترسی به این صفحه مجاز نیست.');
    }
    return true;
  }
}
