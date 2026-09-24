import {recheckContext} from '../auth/role-context';
import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.constants';
import { AppError } from '../common/app-error';
import type { AuthUser } from '../auth/auth.types';

const selectRequest = `SELECT r.*, a.username AS requester_username,
  p.first_name || ' ' || p.last_name AS requester_name, role.label_fa AS role_label
  FROM identity.access_requests r
  JOIN identity.accounts a ON a.id = r.requested_by
  JOIN identity.people p ON p.id = a.person_id
  LEFT JOIN identity.roles role ON role.code = r.proposed_role`;

@Injectable()
export class AccessRequestsService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async list() {
    const result = await this.pool.query(`${selectRequest} ORDER BY r.requested_at DESC, r.id`);
    return { requests: result.rows };
  }

  async detail(id: string) {
    this.validateId(id);
    const result = await this.pool.query(`${selectRequest} WHERE r.id = $1`, [id]);
    if (!result.rowCount) throw new AppError(404, 'NOT_FOUND', 'درخواست پیدا نشد.');
    const history = await this.pool.query(`SELECT d.id, d.decision, d.reason, d.decided_at,
      d.decided_by, a.username AS actor_username, p.first_name || ' ' || p.last_name AS actor_name
      FROM identity.access_request_decisions d JOIN identity.accounts a ON a.id = d.decided_by
      JOIN identity.people p ON p.id = a.person_id WHERE d.request_id = $1 ORDER BY d.decided_at, d.id`, [id]);
    return { request: result.rows[0], history: history.rows };
  }

  async decide(id: string, body: unknown, user: AuthUser) {
    this.validateId(id);
    const input = body as { decision?: unknown; reason?: unknown } | null;
    if (!input || typeof input.decision !== 'string' || !['APPROVED', 'REJECTED'].includes(input.decision) ||
      (input.reason !== undefined && typeof input.reason !== 'string')) {
      throw new AppError(400, 'VALIDATION_ERROR', 'تصمیم معتبر را انتخاب کنید.');
    }
    const decision = input.decision as 'APPROVED' | 'REJECTED';
    const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
    if ((decision === 'REJECTED' && !reason) || reason.length > 2000) {
      throw new AppError(400, 'VALIDATION_ERROR', 'برای رد درخواست، دلیل بین ۱ تا ۲۰۰۰ نویسه وارد کنید.');
    }
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const request = await client.query('SELECT status FROM identity.access_requests WHERE id = $1 FOR UPDATE', [id]);
      if (!request.rowCount) throw new AppError(404, 'NOT_FOUND', 'درخواست پیدا نشد.');
      if (request.rows[0].status !== 'PENDING_GUIDE_APPROVAL') {
        throw new AppError(409, 'ALREADY_DECIDED', 'این درخواست قبلاً تصمیم‌گیری شده است و قابل تغییر نیست.');
      }
      // Recheck current role/account inside the transaction, not just in the UI.
      await recheckContext(client,user,true);
      const status = decision === 'APPROVED' ? 'APPROVED_PENDING_TECHNICAL_IMPLEMENTATION' : 'REJECTED';
      await client.query('UPDATE identity.access_requests SET status = $2 WHERE id = $1', [id, status]);
      const history = await client.query(`INSERT INTO identity.access_request_decisions(request_id,decided_by,decision,reason)
        VALUES ($1,$2,$3,$4) RETURNING id,decided_at`, [id, user.accountId, decision, decision === 'REJECTED' ? reason : null]);
      await client.query(`INSERT INTO admin.audit_events(event_type,actor_account_id,entity_type,entity_id,metadata,effective_role,effective_scopes,simulation)
        VALUES ('ACCESS_REQUEST_DECIDED',$1,'ACCESS_REQUEST',$2,$3::jsonb,$4,$5,$6)`,
        [user.accountId, id, JSON.stringify({ decision, status, reason: decision === 'REJECTED' ? reason : null, decisionId: history.rows[0].id }),user.effectiveRole,JSON.stringify(user.roles),user.simulation]);
      await client.query('COMMIT');
      return { status, decision: history.rows[0] };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private validateId(id: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      throw new AppError(400, 'INVALID_ID', 'شناسه درخواست معتبر نیست.');
    }
  }
}
