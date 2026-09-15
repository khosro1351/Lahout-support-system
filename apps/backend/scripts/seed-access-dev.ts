import { Pool } from 'pg';

async function main() {
  if (process.env.APP_ENV !== 'development') throw new Error('Access test seed requires APP_ENV=development');
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL required');
  const batch = process.env.DEV_ACCESS_BATCH ?? 'initial';
  if (!/^[a-zA-Z0-9_-]{1,40}$/.test(batch)) throw new Error('Invalid development batch');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const actor = await c.query("SELECT id FROM identity.accounts WHERE lower(username) = 'aseman'");
    if (!actor.rowCount) throw new Error('Seed Aseman first');
    const examples = [
      ['مدیر اجرایی آزمایشی', 'CREATE_ACCOUNT', 'EXECUTIVE_MANAGER', 'ORGANIZATION', 'کل سازمان', 'ایجاد حساب آزمایشی برای بررسی تأیید راهبر.'],
      ['سرگروه آزمایشی', 'CREATE_ACCOUNT', 'GROUP_LEADER', 'GROUP', 'گروه نمونه آزمایشی (پیشنهادی)', 'ایجاد حساب سرگروه برای بررسی فرایند درخواست دسترسی.'],
      ['همیار آزمایشی', 'ADD_ROLE', 'HELPER', 'GROUP', 'گروه نمونه آزمایشی (پیشنهادی)', 'افزودن نقش همیار؛ داده آزمایشی برای بررسی رد درخواست.'],
    ];
    for (let i = 0; i < examples.length; i++) {
      await c.query(`INSERT INTO identity.access_requests(person_name,request_type,proposed_role,scope_type,scope_label,reason,requested_by,is_development,development_key)
        VALUES ($1,$2,$3,$4,$5,$6,$7,true,$8) ON CONFLICT (development_key) DO NOTHING`,
        [...examples[i], actor.rows[0].id, `access-${batch}-${i + 1}`]);
    }
    await c.query('COMMIT');
    console.log('Development access requests ready; existing decisions were not changed.');
  } catch (error) { await c.query('ROLLBACK'); throw error; }
  finally { c.release(); await pool.end(); }
}
main().catch(() => { console.error('Development access seed failed'); process.exitCode = 1; });
