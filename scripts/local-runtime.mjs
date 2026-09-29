// Read the existing local configuration without exposing credentials.
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

try {
  const root = new URL('../', import.meta.url);
  Object.assign(process.env, parseEnv(readFileSync(new URL('.env', root), 'utf8')));
  const database = new URL(process.env.DATABASE_URL);
  const origin = new URL(process.env.FRONTEND_ORIGIN);
  const localHosts = ['127.0.0.1', 'localhost'];
  const port = Number(process.env.BACKEND_PORT ?? 3000);
  const previewPort = Number(process.env.PREVIEW_PORT ?? 5173);
  const dbPort = Number(database.port || 5432);
  if (!localHosts.includes(database.hostname) || !localHosts.includes(origin.hostname)
    || origin.protocol !== 'http:' || Number(origin.port || 80) !== previewPort
    || ![port, previewPort, dbPort].every(p => Number.isInteger(p) && p > 0 && p < 65536)
    || new Set([port, previewPort, dbPort]).size !== 3
    || !['development', 'test'].includes(process.env.APP_ENV ?? 'development')
    || process.env.COOKIE_SECURE === 'true') {
    throw new Error('LOCAL_CONFIG_INVALID');
  }
  process.env.BACKEND_HOST = '127.0.0.1';
  process.env.BACKEND_PROXY = `http://127.0.0.1:${port}`;
  delete process.env.STATIC_UI_DIR;
  const mode = process.argv[2];
  if (mode === 'config') {
    console.log(JSON.stringify({ port, previewPort, dbPort, origin: origin.origin }));
  } else if (mode === 'database') {
    const require = createRequire(new URL('apps/backend/package.json', root));
    const { Client } = require('pg');
    const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 2000, query_timeout: 2000 });
    try { await client.connect(); await client.query('SELECT 1'); }
    finally { await client.end(); }
  } else if (mode === 'backend') {
    process.chdir(fileURLToPath(new URL('apps/backend/', root)));
    await import(new URL('apps/backend/dist/main.js', root));
  } else if (mode === 'frontend') {
    process.chdir(fileURLToPath(root));
    await import(new URL('tests/preview.mjs', root));
  } else {
    throw new Error('UNKNOWN_MODE');
  }
} catch (error) {
  // Exception messages may contain connection strings; print only a safe code.
  const code = /^[A-Z_0-9]+$/.test(error.code ?? '') ? error.code : 'LOCAL_RUNTIME_FAILED';
  if (process.argv[3] !== '--quiet') console.error(`Local runtime could not start (${code}). Check .env and the local database.`);
  process.exitCode = 1;
}
