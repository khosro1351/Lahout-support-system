import { Pool } from 'pg';
import argon2 from 'argon2';
async function main() {
  if (process.env.APP_ENV === 'production') throw new Error('Development seed forbidden in production');
  if (!process.env.DATABASE_URL || !process.env.DEV_SEED_PASSWORD) throw new Error('DATABASE_URL and DEV_SEED_PASSWORD required');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const exists = await c.query("SELECT id FROM identity.accounts WHERE lower(username) = 'aseman'");
    if (!exists.rowCount) {
      const person = await c.query("INSERT INTO identity.people(first_name,last_name) VALUES ('راهبر','عالی') RETURNING id");
      const hash = await argon2.hash(process.env.DEV_SEED_PASSWORD, { type: argon2.argon2id });
      const account = await c.query("INSERT INTO identity.accounts(person_id,username,password_hash) VALUES ($1,'Aseman',$2) RETURNING id", [person.rows[0].id, hash]);
      await c.query("INSERT INTO identity.role_assignments(account_id,role_code,scope_type) VALUES ($1,'SUPREME_GUIDE','ORGANIZATION')", [account.rows[0].id]);
    }
    await c.query('COMMIT');
    console.log('Aseman seed complete (existing accounts are never reset).');
  } catch(e) { await c.query('ROLLBACK'); throw e; }
  finally { c.release(); await pool.end(); }
}
main().catch(() => { console.error('Seed failed'); process.exitCode = 1; });
