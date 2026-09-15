import { Inject, Injectable } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { PG_POOL } from '../database/database.constants';
import { AppError } from '../common/app-error';
import type { AuthUser } from '../auth/auth.types';

export type CreateFamilyInput = {
  headFirstName: string;
  headLastName: string;
  mobile?: string;
  nationalId?: string;
  neighborhood?: string;
  groupId: string;
};

function canManageFamilies(user: AuthUser): boolean {
  return user.roles.some((r) => ['SUPREME_GUIDE', 'EXECUTIVE_MANAGER', 'GROUP_LEADER'].includes(r.roleCode));
}

function hasOrgScope(user: AuthUser): boolean {
  return user.roles.some((r) =>
    r.scopeType === 'ORGANIZATION' && ['SUPREME_GUIDE', 'EXECUTIVE_MANAGER'].includes(r.roleCode),
  );
}

function scopedGroupIds(user: AuthUser): string[] {
  return user.roles
    .filter((r) => r.roleCode === 'GROUP_LEADER' && r.scopeType === 'GROUP' && r.scopeId)
    .map((r) => r.scopeId!)
}

@Injectable()
export class FamiliesService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async list(user: AuthUser) {
    this.ensureAllowed(user);
    const baseSql = `
      SELECT f.id, f.family_code, f.status, f.neighborhood, f.created_at,
             g.id AS group_id, g.name AS group_name,
             p.first_name || ' ' || p.last_name AS head_name,
             p.mobile AS head_mobile
        FROM family.families f
        JOIN organization.groups g ON g.id = f.current_group_id
        JOIN family.head_history hh ON hh.family_id = f.id AND hh.valid_to IS NULL
        JOIN identity.people p ON p.id = hh.person_id`;

    const result = hasOrgScope(user)
      ? await this.pool.query(`${baseSql} ORDER BY f.created_at DESC LIMIT 100`)
      : await this.pool.query(
          `${baseSql} WHERE f.current_group_id = ANY($1::uuid[]) ORDER BY f.created_at DESC LIMIT 100`,
          [scopedGroupIds(user)],
        );
    return result.rows;
  }

  async getById(user: AuthUser, id: string) {
    this.ensureAllowed(user);
    const result = await this.pool.query(
      `SELECT f.id, f.family_code, f.status, f.neighborhood, f.current_group_id,
              g.name AS group_name,
              p.id AS head_person_id, p.first_name, p.last_name, p.mobile, p.national_id,
              f.created_at, f.version
         FROM family.families f
         JOIN organization.groups g ON g.id = f.current_group_id
         JOIN family.head_history hh ON hh.family_id = f.id AND hh.valid_to IS NULL
         JOIN identity.people p ON p.id = hh.person_id
        WHERE f.id = $1`,
      [id],
    );
    const row = result.rows[0];
    if (!row || !this.canAccessGroup(user, row.current_group_id)) {
      throw new AppError(404, 'FAMILY_NOT_FOUND', 'پرونده موردنظر یافت نشد.');
    }
    if (!hasOrgScope(user) && row.national_id) {
      row.national_id = `${String(row.national_id).slice(0, 3)}******${String(row.national_id).slice(-1)}`;
    }
    return row;
  }

  async create(user: AuthUser, input: CreateFamilyInput) {
    this.ensureAllowed(user);
    this.validateInput(input);
    if (!this.canAccessGroup(user, input.groupId)) {
      throw new AppError(403, 'GROUP_SCOPE_DENIED', 'اجازه ثبت خانواده در این گروه را ندارید.');
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await this.ensureGroupExists(client, input.groupId);

      if (input.nationalId) {
        const duplicate = await client.query(
          `SELECT id FROM identity.people WHERE national_id = $1 LIMIT 1`,
          [input.nationalId],
        );
        if (duplicate.rowCount) {
          throw new AppError(409, 'PERSON_ALREADY_EXISTS', 'فردی با این کد ملی قبلاً در سامانه ثبت شده است.');
        }
      }

      const personResult = await client.query(
        `INSERT INTO identity.people (first_name, last_name, mobile, national_id)
         VALUES ($1,$2,$3,$4)
         RETURNING id`,
        [input.headFirstName.trim(), input.headLastName.trim(), input.mobile?.trim() || null, input.nationalId?.trim() || null],
      );
      const personId = personResult.rows[0].id;

      const familyResult = await client.query(
        `INSERT INTO family.families (family_code, current_group_id, neighborhood, created_by)
         VALUES (
           'HL-' || lpad(nextval('family.family_code_seq')::text, 6, '0'),
           $1,$2,$3
         )
         RETURNING id, family_code, status, neighborhood, current_group_id, created_at`,
        [input.groupId, input.neighborhood?.trim() || null, user.accountId],
      );
      const family = familyResult.rows[0];

      await client.query(
        `INSERT INTO family.family_memberships (family_id, person_id, relationship_code)
         VALUES ($1,$2,'HEAD')`,
        [family.id, personId],
      );
      await client.query(
        `INSERT INTO family.head_history (family_id, person_id)
         VALUES ($1,$2)`,
        [family.id, personId],
      );
      await client.query(
        `INSERT INTO admin.audit_events (event_type, actor_account_id, entity_type, entity_id, metadata)
         VALUES ('FAMILY_CREATED',$1,'FAMILY',$2,jsonb_build_object('family_code',$3))`,
        [user.accountId, family.id, family.family_code],
      );

      await client.query('COMMIT');
      return { ...family, head_person_id: personId };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private ensureAllowed(user: AuthUser) {
    if (!canManageFamilies(user)) {
      throw new AppError(403, 'FAMILY_ACCESS_DENIED', 'اجازه دسترسی به پرونده خانواده‌ها را ندارید.');
    }
  }

  private canAccessGroup(user: AuthUser, groupId: string): boolean {
    return hasOrgScope(user) || scopedGroupIds(user).includes(groupId);
  }

  private validateInput(input: CreateFamilyInput) {
    if (!input.headFirstName?.trim() || !input.headLastName?.trim() || !input.groupId) {
      throw new AppError(400, 'VALIDATION_ERROR', 'نام، نام خانوادگی سرپرست و گروه الزامی است.');
    }
    if (input.mobile && !/^0\d{10}$/.test(input.mobile.trim())) {
      throw new AppError(400, 'INVALID_MOBILE', 'شماره موبایل باید ۱۱ رقم و با صفر آغاز شود.');
    }
    if (input.nationalId && !/^\d{10}$/.test(input.nationalId.trim())) {
      throw new AppError(400, 'INVALID_NATIONAL_ID', 'کد ملی باید ۱۰ رقم باشد.');
    }
  }

  private async ensureGroupExists(client: PoolClient, groupId: string) {
    const group = await client.query(`SELECT id FROM organization.groups WHERE id = $1 AND status = 'ACTIVE'`, [groupId]);
    if (!group.rowCount) throw new AppError(400, 'GROUP_INVALID', 'گروه انتخاب‌شده معتبر نیست.');
  }
}
