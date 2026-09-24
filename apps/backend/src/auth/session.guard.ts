import {permissionFor,enforce} from './permissions';
import {Inject} from '@nestjs/common';
import {Pool} from 'pg';
import {PG_POOL} from '../database/database.constants';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { AuthService } from './auth.service';
import type { AuthUser } from './auth.types';

export type AuthenticatedRequest = FastifyRequest & { user: AuthUser };

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly authService: AuthService,@Inject(PG_POOL) private readonly pool:Pool) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    request.user = await this.authService.authenticate(request.cookies?.lahout_session);
    const p=permissionFor(context.getClass().name,context.getHandler().name,request.method);
    if(p)enforce(request.user,p.domain,p.action);
    if(request.user.simulation&&p)await this.pool.query(`INSERT INTO admin.audit_events(event_type,actor_account_id,entity_type,entity_id,effective_role,effective_scopes,simulation,metadata) VALUES('SIMULATION_OPERATION_ATTEMPT',$1,'SESSION',$2,$3,$4,true,$5)`,[request.user.accountId,request.user.sessionId,request.user.effectiveRole,JSON.stringify(request.user.roles),JSON.stringify({domain:p.domain,action:p.action,handler:context.getHandler().name,realRole:'TECH_ADMIN'})]);
    return true;
  }
}
