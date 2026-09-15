import { Pool } from 'pg';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  const pool = new Pool({ connectionString: databaseUrl });
  const migrationsDir = path.resolve(process.cwd(), '../../migrations');
  const files = (await readdir(migrationsDir)).filter((x) => x.endsWith('.sql')).sort();

  await pool.query(`CREATE SCHEMA IF NOT EXISTS core`);
  await pool.query(`CREATE TABLE IF NOT EXISTS core.schema_migrations (version varchar(100) PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);

  for (const file of files) {
    const applied = await pool.query(`SELECT 1 FROM core.schema_migrations WHERE version = $1`, [file]);
    if (applied.rowCount) continue;
    const sql = await readFile(path.join(migrationsDir, file), 'utf8');
    await pool.query(sql);
    await pool.query(`INSERT INTO core.schema_migrations(version) VALUES ($1) ON CONFLICT DO NOTHING`, [file]);
    console.log(`applied ${file}`);
  }
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
