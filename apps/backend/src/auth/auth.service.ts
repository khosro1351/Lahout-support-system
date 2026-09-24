import {contextFor,ROLE_LABELS} from './role-context';
import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import { PG_POOL } from '../database/database.constants';
import { AppError } from '../common/app-error';
import { loadConfig } from '../common/config';
import type { AuthUser, RoleAssignment } from './auth.types';

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  private readonly dummyHash = argon2.hash(randomBytes(32), { type: argon2.argon2id });

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async login(username: string, password: string, previousToken?: string): Promise<{ token: string; user: AuthUser }> {
    username = username.replace(/[۰-۹]/g, c => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/[٠-٩]/g, c => String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)));
    if (/^\+989\d{9}$/.test(username)) username = '0' + username.slice(3);
    const accountResult = await this.pool.query(
      `SELECT a.id AS account_id, a.person_id, a.username, a.password_hash, a.status,
              p.first_name, p.last_name
         FROM identity.accounts a
         JOIN identity.people p ON p.id = a.person_id
        WHERE lower(a.username) = lower($1) OR p.mobile = $1
        LIMIT 2`,
      [username],
    );

    const row = accountResult.rows[0];
    const valid = await argon2.verify(row?.password_hash ?? await this.dummyHash, password);
    if (accountResult.rows.length !== 1 || !row || row.status !== 'ACTIVE' || !valid) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'نام کاربری یا رمز عبور صحیح نیست.');
    }

    const roles = await this.loadRoles(row.account_id);
    if (!roles.length) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'نام کاربری یا رمز عبور صحیح نیست.');
    }
    if (previousToken) await this.pool.query('UPDATE identity.auth_sessions SET revoked_at = now() WHERE token_hash = $1', [tokenHash(previousToken)]);
    const token = randomBytes(32).toString('base64url');
    const csrfToken = randomBytes(24).toString('base64url');
    const config = loadConfig();
    const expiresAt = new Date(Date.now() + config.sessionTtlHours * 60 * 60 * 1000);

    const sessionResult = await this.pool.query(
      `INSERT INTO identity.auth_sessions (account_id, token_hash, csrf_token, expires_at, selected_role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [row.account_id, tokenHash(token), csrfToken, expiresAt, new Set(roles.map(r=>r.roleCode)).size===1?roles[0].roleCode:null],
    );

    await this.audit('LOGIN_SUCCESS', row.account_id, 'ACCOUNT', row.account_id);

    return {
      token,
      user: {
        accountId: row.account_id,
        personId: row.person_id,
        username: row.username,
        displayName: `${row.first_name} ${row.last_name}`,
        ...await contextFor(this.pool,row.account_id,sessionResult.rows[0].id),
        sessionId: sessionResult.rows[0].id,
        csrfToken,
      },
    };
  }

  async authenticate(token?: string): Promise<AuthUser> {
    if (!token) throw new AppError(401, 'UNAUTHORIZED', 'ابتدا وارد سامانه شوید.');

    const result = await this.pool.query(
      `SELECT s.id AS session_id, s.csrf_token, s.account_id,
              a.person_id, a.username, a.status,
              p.first_name, p.last_name
         FROM identity.auth_sessions s
         JOIN identity.accounts a ON a.id = s.account_id
         JOIN identity.people p ON p.id = a.person_id
        WHERE s.token_hash = $1
          AND s.revoked_at IS NULL
          AND s.expires_at > now()
        LIMIT 1`,
      [tokenHash(token)],
    );

    const row = result.rows[0];
    if (!row || row.status !== 'ACTIVE') {
      throw new AppError(401, 'SESSION_INVALID', 'نشست شما معتبر نیست یا منقضی شده است.');
    }

    await this.pool.query(`UPDATE identity.auth_sessions SET last_seen_at = now() WHERE id = $1`, [row.session_id]);
    const roles = await this.loadRoles(row.account_id);

    return {
      accountId: row.account_id,
      personId: row.person_id,
      username: row.username,
      displayName: `${row.first_name} ${row.last_name}`,
      ...await contextFor(this.pool,row.account_id,row.session_id),
      sessionId: row.session_id,
      csrfToken: row.csrf_token,
    };
  }

  async logout(sessionId: string, accountId: string): Promise<void> {
    await this.pool.query(`UPDATE identity.auth_sessions SET revoked_at = now() WHERE id = $1`, [sessionId]);
    await this.audit('LOGOUT', accountId, 'SESSION', sessionId);
  }


  async selectRole(user:AuthUser,body:any){
    if(!body||typeof body.roleCode!=='string'||!ROLE_LABELS[body.roleCode])throw new AppError(400,'ROLE','نقش معتبر را انتخاب کنید.');
    const c=await this.pool.connect();try{await c.query('BEGIN');
      const roles=await this.loadRoles(user.accountId);
      if(!roles.some(r=>r.roleCode===body.roleCode))throw new AppError(403,'ROLE','این نقش به شما واگذار نشده است.');
      await c.query('UPDATE identity.auth_sessions SET selected_role=$2,simulation_role=NULL,simulation_group_id=NULL WHERE id=$1',[user.sessionId,body.roleCode]);
      await c.query("INSERT INTO admin.audit_events(event_type,actor_account_id,entity_type,entity_id,effective_role,metadata) VALUES('ROLE_SELECTED',$1,'SESSION',$2,$3,$4)",[user.accountId,user.sessionId,body.roleCode,JSON.stringify({previousRole:user.effectiveRole})]);
      await c.query('COMMIT');
    }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
    return {...user,...await contextFor(this.pool,user.accountId,user.sessionId)};
  }
  async simulate(user:AuthUser,body:any,stop=false){
    const roles=await this.loadRoles(user.accountId);
    if(!roles.some(r=>r.roleCode==='TECH_ADMIN'&&r.scopeType==='ORGANIZATION'&&r.scopeId===null)||(!stop&&!user.simulation&&user.effectiveRole!=='TECH_ADMIN'))throw new AppError(403,'TECH_ONLY','این عملیات ویژه پشتیبان فنی است.');
    const role=stop?null:body?.roleCode,group=stop?null:body?.groupId??null;
    if(!stop&&(!ROLE_LABELS[role]||role==='TECH_ADMIN'))throw new AppError(400,'ROLE','نقش آزمایش معتبر نیست.');
    if(!stop&&['GROUP_LEADER','HELPER'].includes(role)){
      if(typeof group!=='string'||! /^[0-9a-f-]{36}$/i.test(group)||!(await this.pool.query("SELECT 1 FROM organization.groups WHERE id=$1 AND status='ACTIVE'",[group])).rowCount)throw new AppError(400,'GROUP','یک گروه فعال برای محدوده آزمایش انتخاب کنید.');
    }else if(group!==null)throw new AppError(400,'SCOPE','این نقش محدوده سازمانی دارد.');
    const c=await this.pool.connect();try{await c.query('BEGIN');
      await c.query("UPDATE identity.auth_sessions SET selected_role='TECH_ADMIN',simulation_role=$2,simulation_group_id=$3 WHERE id=$1",[user.sessionId,role,group]);
      await c.query("INSERT INTO admin.audit_events(event_type,actor_account_id,entity_type,entity_id,effective_role,effective_scopes,simulation,metadata) VALUES($1,$2,'SESSION',$3,$4,$5,$6,$7)",[stop?'SIMULATION_ENDED':'SIMULATION_STARTED',user.accountId,user.sessionId,stop?'TECH_ADMIN':role,JSON.stringify(group?[group]:[]),!stop,JSON.stringify({realRole:'TECH_ADMIN',previousRole:user.effectiveRole})]);
      await c.query('COMMIT');
    }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
    return {...user,...await contextFor(this.pool,user.accountId,user.sessionId)};
  }

  private async loadRoles(accountId: string): Promise<RoleAssignment[]> {
    const result = await this.pool.query(
      `SELECT role_code, scope_type, scope_id
         FROM identity.role_assignments
        WHERE account_id = $1
          AND valid_from <= now()
          AND (valid_to IS NULL OR valid_to > now())`,
      [accountId],
    );
    return result.rows.map((r) => ({ roleCode: r.role_code, scopeType: r.scope_type, scopeId: r.scope_id }));
  }

  private async audit(eventType: string, actorId: string, entityType: string, entityId: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO admin.audit_events (event_type, actor_account_id, entity_type, entity_id)
       VALUES ($1,$2,$3,$4)`,
      [eventType, actorId, entityType, entityId],
    );
  }
}
