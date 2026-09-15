import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const suites = { login: 'tests/login-flow.mjs', access: 'tests/access-requests-flow.mjs' };
const selection = process.argv[2] ?? 'all';
if (selection !== 'all' && !(selection in suites)) throw new Error('Choose login, access, or all');
const databaseUrl = process.env.TEST_DATABASE_ADMIN_URL || process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('Set TEST_DATABASE_ADMIN_URL or DATABASE_URL in the local .env');
const env = {
  ...process.env,
  TEST_DATABASE_ADMIN_URL: databaseUrl,
  // Each suite seeds an isolated database; never require the real Aseman password.
  DEV_SEED_PASSWORD: randomBytes(32).toString('base64url'),
};
for (const suite of selection === 'all' ? Object.values(suites) : [suites[selection]]) {
  const code = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [suite], {
      cwd: fileURLToPath(new URL('..', import.meta.url)), env, windowsHide: true, stdio: 'inherit',
    });
    child.once('error', reject);
    child.once('exit', code => resolve(code ?? 1));
  });
  if (code !== 0) { process.exitCode = code; break; }
}
