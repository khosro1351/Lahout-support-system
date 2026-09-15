import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.constants';
import type { AuthUser } from '../auth/auth.types';

function hasOrgAccess(user: AuthUser): boolean {
  return user.roles.some((r) =>
    r.scopeType === 'ORGANIZATION' && ['SUPREME_GUIDE', 'EXECUTIVE_MANAGER'].includes(r.roleCode),
  );
}

@Injectable()
export class OrganizationService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async listAccessibleGroups(user: AuthUser) {
    if (hasOrgAccess(user)) {
      const result = await this.pool.query(
        `SELECT id, code, name FROM organization.groups WHERE status = 'ACTIVE' ORDER BY name`,
      );
      return result.rows;
    }

    const groupIds = user.roles
      .filter((r) => r.roleCode === 'GROUP_LEADER' && r.scopeType === 'GROUP' && r.scopeId)
      .map((r) => r.scopeId);
    if (!groupIds.length) return [];
    const result = await this.pool.query(
      `SELECT id, code, name FROM organization.groups WHERE id = ANY($1::uuid[]) AND status = 'ACTIVE' ORDER BY name`,
      [groupIds],
    );
    return result.rows;
  }
}
