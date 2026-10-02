import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const suites = { comprehensive:'tests/comprehensive-flow.mjs', comprehensiveScoring:'tests/comprehensive-scoring.mjs', documents:'tests/documents-flow.mjs', healthImport: 'tests/health-import-flow.mjs', persianDate: 'tests/persian-date.mjs', healthScreening: 'tests/health-screening-flow.mjs', login: 'tests/login-flow.mjs', access: 'tests/access-requests-flow.mjs', guide: 'tests/guide-workspace-flow.mjs', roles: 'tests/roles-flow.mjs', livelihood: 'tests/livelihood-flow.mjs', livelihoodSeed: 'tests/livelihood-seed-flow.mjs', technicalUi: 'tests/technical-ui-flow.mjs', leaderUi: 'tests/leader-workspace-flow.mjs', livelihoodVertical: 'tests/livelihood-vertical-flow.mjs' };
const archived=new Set(['healthScreening','livelihood','livelihoodVertical']);
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
for (const suite of selection === 'all' ? Object.entries(suites).filter(([name])=>!archived.has(name)).map(([,file])=>file) : [suites[selection]]) {
  const code = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [suite], {
      cwd: fileURLToPath(new URL('..', import.meta.url)), env:{...env,UPLOAD_STORAGE_ROOT:fileURLToPath(new URL('../test-results/upload-storage/'+Date.now()+'-'+suite.split('/').pop(),import.meta.url))}, windowsHide: true, stdio: 'inherit',
    });
    child.once('error', reject);
    child.once('exit', code => resolve(code ?? 1));
  });
  if (code !== 0) { process.exitCode = code; break; }
}
