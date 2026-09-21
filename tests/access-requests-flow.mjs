import {dropTestDatabase} from './database-cleanup.mjs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, openSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';

const root = fileURLToPath(new URL('..', import.meta.url));
const backend = path.join(root, 'apps/backend');
const require = createRequire(path.join(backend, 'package.json'));
const { Pool } = require('pg');
const password = process.env.DEV_SEED_PASSWORD;
if (!password || !process.env.TEST_DATABASE_ADMIN_URL) throw new Error('Test PostgreSQL URL and seed password required');
const out = path.join(root, 'test-results/access-requests');
mkdirSync(out, { recursive: true });
const results = [];
const pass = name => { results.push({ name, status: 'PASS' }); console.log('PASS ' + name); };
const dbName = 'lahout_test_access_' + Date.now();
const admin = new Pool({ connectionString: process.env.TEST_DATABASE_ADMIN_URL });
await admin.query(`CREATE DATABASE ${dbName}`);
const dbUrl = new URL(process.env.TEST_DATABASE_ADMIN_URL); dbUrl.pathname = '/' + dbName;
const pool = new Pool({ connectionString: dbUrl.href });
const origin = 'http://127.0.0.1:5174';
const env = { ...process.env, DATABASE_URL: dbUrl.href, APP_ENV: 'development', BACKEND_PORT: '3001', FRONTEND_ORIGIN: origin, COOKIE_SECURE: 'false', SESSION_TTL_HOURS: '12', DEV_ACCESS_BATCH: 'initial' };
let server, front, browser;
function run(script, extra = {}, expected = 0) {
  const r = spawnSync(process.execPath, [script], { cwd: backend, env: { ...env, ...extra }, windowsHide: true, encoding: 'utf8' });
  assert.equal(r.status, expected, r.stderr || r.stdout);
}
async function waitReady(url, child) {
  for (let i = 0; i < 300; i++) {
    if (child.exitCode !== null) throw new Error('Server exited early: ' + child.exitCode);
    try { await fetch(url, { signal: AbortSignal.timeout(500) }); return; }
    catch { await new Promise(r => setTimeout(r, 200)); }
  }
  throw new Error('Server startup timeout');
}
async function stop(child) {
  if (!child || child.exitCode !== null) return;
  await new Promise(resolve => { child.once('exit', resolve); child.kill(); });
}
async function req(route, { body, cookie, csrf, requestOrigin = origin, method = body === undefined ? 'GET' : 'POST' } = {}) {
  const headers = { origin: requestOrigin };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (cookie) headers.cookie = cookie;
  if (csrf) headers['x-csrf-token'] = csrf;
  const r = await fetch('http://127.0.0.1:3001/api/v1' + route, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: r.status, body: await r.json(), cookie: r.headers.get('set-cookie')?.split(';')[0] };
}
try {
  run('.tools/scripts/migrate.js'); run('.tools/scripts/migrate.js'); run('.tools/scripts/seed-dev.js');
  run('.tools/scripts/seed-access-dev.js'); run('.tools/scripts/seed-access-dev.js');
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM identity.access_requests')).rows[0].n, 3);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM identity.access_requests WHERE is_development')).rows[0].n, 3);
  pass('Migration and idempotent Development/Test seed create exactly three pending requests');
  run('.tools/scripts/seed-access-dev.js', { APP_ENV: 'production' }, 1);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM identity.access_requests')).rows[0].n, 3);
  pass('Development access seed refuses production');

  // A valid session for a non-guide account is a test fixture, not a new login workflow.
  const person = await pool.query("INSERT INTO identity.people(first_name,last_name) VALUES ('آزمایشی','فاقد مجوز') RETURNING id");
  const helper = await pool.query("INSERT INTO identity.accounts(person_id,username,password_hash) SELECT $1,'access_test_helper',password_hash FROM identity.accounts WHERE username='Aseman' RETURNING id", [person.rows[0].id]);
  await pool.query("INSERT INTO identity.role_assignments(account_id,role_code,scope_type) VALUES ($1,'COUNCIL_MEMBER','ORGANIZATION')", [helper.rows[0].id]);
  const raw = randomBytes(32).toString('base64url');
  const helperCsrf = randomBytes(24).toString('hex');
  await pool.query("INSERT INTO identity.auth_sessions(account_id,token_hash,csrf_token,expires_at) VALUES ($1,$2,$3,now()+interval '1 hour')", [helper.rows[0].id, createHash('sha256').update(raw).digest('hex'), helperCsrf]);
  const identityBefore = (await pool.query('SELECT (SELECT count(*) FROM identity.accounts) AS accounts, (SELECT count(*) FROM identity.role_assignments) AS roles')).rows[0];
  const backendLog = openSync(path.join(out, 'backend.log'), 'w');
  server = spawn(process.execPath, ['dist/main.js'], { cwd: backend, env, windowsHide: true, stdio: ['ignore', backendLog, backendLog] });
  await waitReady('http://127.0.0.1:3001/api/v1/auth/me', server);
  const login = await req('/auth/login', { body: { username: 'Aseman', password } });
  assert.equal(login.status, 200);
  const auth = { cookie: login.cookie, csrf: login.body.csrfToken };
  const list = await req('/access-requests', auth);
  assert.equal(list.status, 200); assert.equal(list.body.requests.length, 3);
  const approval = list.body.requests.find(r => r.proposed_role === 'EXECUTIVE_MANAGER');
  const rejection = list.body.requests.find(r => r.proposed_role === 'HELPER');
  const race = list.body.requests.find(r => r.proposed_role === 'GROUP_LEADER');
  for (const r of list.body.requests) for (const field of ['person_name', 'request_type', 'proposed_role', 'scope_label', 'reason', 'requester_name', 'requested_at', 'status']) assert.ok(r[field]);
  pass('Guide list returns all required request information');
  assert.equal((await req('/access-requests')).status, 401);
  assert.equal((await req('/access-requests/' + approval.id + '/decision', { body: { decision: 'APPROVED' } })).status, 401);
  for (const route of ['/access-requests', '/access-requests/' + approval.id]) assert.equal((await req(route, { cookie: 'lahout_session=' + raw })).status, 403);
  assert.equal((await req('/access-requests/' + approval.id + '/decision', { cookie: 'lahout_session=' + raw, csrf: helperCsrf, body: { decision: 'APPROVED' } })).status, 403);
  pass('Anonymous and authenticated non-SUPREME_GUIDE users cannot read or decide');
  assert.equal((await req('/access-requests/' + approval.id + '/decision', { cookie: login.cookie, body: { decision: 'APPROVED' } })).status, 403);
  assert.equal((await req('/access-requests/' + approval.id + '/decision', { ...auth, requestOrigin: 'https://evil.invalid', body: { decision: 'APPROVED' } })).status, 403);
  pass('Decision endpoint preserves CSRF and Origin protection');
  for (const body of [{ decision: 'REJECTED' }, { decision: 'REJECTED', reason: '   ' }, { decision: 'REJECTED', reason: 3 }, { decision: ['APPROVED'] }, { decision: 'OTHER' }]) assert.equal((await req('/access-requests/' + rejection.id + '/decision', { ...auth, body })).status, 400);
  assert.equal((await req('/access-requests/not-a-uuid', auth)).status, 400);
  assert.equal((await req('/access-requests/00000000-0000-0000-0000-000000000000', auth)).status, 404);
  pass('Server blocks empty rejection reason, invalid types, decisions and IDs');

  const frontendLog = openSync(path.join(out, 'frontend.log'), 'w');
  front = spawn(process.execPath, ['tests/preview.mjs'], { cwd: root, env: { ...env, PREVIEW_PORT: '5174', BACKEND_PROXY: 'http://127.0.0.1:3001' }, windowsHide: true, stdio: ['ignore', frontendLog, frontendLog] });
  await waitReady(origin, front);
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
  browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(origin + '/login'); await page.locator('#username').fill('Aseman'); await page.locator('#password').fill(password); await page.locator('#password').press('Enter');
  await page.waitForURL('**/guide'); await page.getByRole('heading', { name: 'صفحه اصلی راهبر عالی' }).waitFor();
  assert.equal(await page.locator('.slice-module').count(), 4); assert.equal(await page.locator('.slice-module[aria-disabled=true]').count(), 0);
  assert.equal(await page.locator('.slice-module a').count(), 4);
  assert.equal(await page.locator('html').getAttribute('dir'), 'rtl');
  await page.screenshot({ path: path.join(out, 'guide-home.png'), fullPage: true });
  pass('Browser Aseman login reaches RTL guide home with four supervisory domains; legacy access flow preserved outside navigation');
  await page.goto(origin+'/guide/access-requests'); await page.getByRole('heading', { name: 'درخواست‌های دسترسی', exact: true }).waitFor();
  await page.locator('.request-row').first().waitFor(); assert.equal(await page.locator('.request-row').count(), 3); assert.equal(await page.locator('.dev-badge').count(), 3);
  await page.screenshot({ path: path.join(out, 'access-requests.png'), fullPage: true });
  pass('Browser lists the three Development/Test requests with details');
  await page.getByRole('link', { name: approval.person_name, exact: true }).click(); await page.getByRole('heading', { name: approval.person_name }).waitFor();
  await page.getByRole('button', { name: 'تأیید درخواست', exact: true }).click();
  await page.getByRole('button', { name: 'ثبت تأیید نهایی' }).click();
  await page.getByText('تصمیم شما ثبت شد.', { exact: true }).waitFor();
  await page.reload(); await page.getByText('تأیید شده؛ در انتظار اجرای فنی', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'تأیید درخواست', exact: true }).count(), 0);
  assert.equal(await page.getByRole('button', { name: 'رد درخواست', exact: true }).count(), 0);
  await page.screenshot({ path: path.join(out, 'approved-request.png'), fullPage: true });
  pass('Browser approval persists after refresh and final request has no decision buttons');
  const approved = await req('/access-requests/' + approval.id, auth);
  assert.equal(approved.body.request.status, 'APPROVED_PENDING_TECHNICAL_IMPLEMENTATION');
  assert.equal(approved.body.history.length, 1); assert.equal(approved.body.history[0].actor_username, 'Aseman'); assert.ok(approved.body.history[0].decided_at);
  pass('Approved history stores the guide identity, timestamp and decision in PostgreSQL');
  for (const decision of ['APPROVED', 'REJECTED']) assert.equal((await req('/access-requests/' + approval.id + '/decision', { ...auth, body: { decision, reason: 'second attempt' } })).status, 409);
  pass('Server rejects both approve and reject on an already decided request');
  await page.getByRole('link', { name: 'بازگشت به درخواست‌های دسترسی' }).click(); await page.getByRole('link', { name: rejection.person_name, exact: true }).click();
  await page.getByRole('button', { name: 'رد درخواست', exact: true }).click();
  await page.getByRole('button', { name: 'ثبت رد درخواست' }).click(); await page.getByText('برای رد درخواست، دلیل را وارد کنید.', { exact: true }).waitFor();
  assert.equal((await req('/access-requests/' + rejection.id, auth)).body.request.status, 'PENDING_GUIDE_APPROVAL');
  pass('Browser blocks rejection without a reason and leaves the request pending');
  const reason = 'اطلاعات متقاضی کامل نیست — دلیل آزمایشی رد';
  await page.getByLabel('دلیل رد (الزامی)').fill(reason); await page.getByRole('button', { name: 'ثبت رد درخواست' }).click(); await page.getByText('تصمیم شما ثبت شد.', { exact: true }).waitFor();
  await page.reload(); await page.getByText('رد شده', { exact: true }).waitFor(); await page.getByText('دلیل رد: ' + reason, { exact: true }).waitFor();
  await page.screenshot({ path: path.join(out, 'rejected-request.png'), fullPage: true });
  const rejected = await req('/access-requests/' + rejection.id, auth);
  assert.equal(rejected.body.history[0].reason, reason); assert.equal(rejected.body.history[0].actor_username, 'Aseman');
  assert.equal((await req('/access-requests/' + rejection.id + '/decision', { ...auth, body: { decision: 'APPROVED' } })).status, 409);
  pass('Browser rejection reason and immutable rejected status persist after refresh');
  const audit = await pool.query("SELECT actor_account_id,entity_id,metadata FROM admin.audit_events WHERE event_type='ACCESS_REQUEST_DECIDED' ORDER BY occurred_at");
  assert.equal(audit.rowCount, 2); assert.ok(audit.rows.every(r => r.actor_account_id === login.body.user.accountId));
  assert.equal(audit.rows.find(r => r.entity_id === rejection.id).metadata.reason, reason);
  pass('Audit records both decisions and the rejection reason with the correct actor');
  const concurrent = await Promise.all(['APPROVED', 'REJECTED'].map(decision => req('/access-requests/' + race.id + '/decision', { ...auth, body: { decision, reason: 'آزمایش هم‌زمانی' } })));
  assert.deepEqual(concurrent.map(r => r.status).sort(), [200, 409]);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM identity.access_request_decisions WHERE request_id=$1', [race.id])).rows[0].n, 1);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM admin.audit_events WHERE event_type='ACCESS_REQUEST_DECIDED' AND entity_id=$1", [race.id])).rows[0].n, 1);
  pass('Concurrent decisions produce exactly one final state, history and audit');
  await assert.rejects(pool.query("UPDATE identity.access_requests SET status='PENDING_GUIDE_APPROVAL' WHERE id=$1", [approval.id]), { code: 'P0001' });
  await assert.rejects(pool.query("UPDATE identity.access_request_decisions SET reason='edited' WHERE request_id=$1", [rejection.id]), { code: 'P0001' });
  await assert.rejects(pool.query('DELETE FROM identity.access_request_decisions WHERE request_id=$1', [rejection.id]), { code: 'P0001' });
  pass('PostgreSQL blocks direct final-status edits and history update/delete');
  const snapshot = (await pool.query('SELECT id,status FROM identity.access_requests ORDER BY id')).rows;
  run('.tools/scripts/seed-access-dev.js'); assert.deepEqual((await pool.query('SELECT id,status FROM identity.access_requests ORDER BY id')).rows, snapshot);
  pass('Rerunning development seed does not reset final decisions');
  const identityAfter = (await pool.query('SELECT (SELECT count(*) FROM identity.accounts) AS accounts, (SELECT count(*) FROM identity.role_assignments) AS roles')).rows[0];
  assert.deepEqual(identityAfter, identityBefore);
  pass('Approvals and rejections do not create accounts or change role assignments');
  // Verify transaction rollback using a test-only audit failure in the isolated database.
  const rollbackRequest = await pool.query("INSERT INTO identity.access_requests(person_name,request_type,reason,requested_by,is_development) VALUES ('Development/Test rollback','REACTIVATE_ACCOUNT','آزمایش تراکنش',$1,true) RETURNING id", [login.body.user.accountId]);
  await pool.query("CREATE FUNCTION admin.test_fail_access_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.event_type='ACCESS_REQUEST_DECIDED' THEN RAISE EXCEPTION 'test-only failure'; END IF; RETURN NEW; END; $$; CREATE TRIGGER test_fail_access_audit BEFORE INSERT ON admin.audit_events FOR EACH ROW EXECUTE FUNCTION admin.test_fail_access_audit()");
  assert.equal((await req('/access-requests/' + rollbackRequest.rows[0].id + '/decision', { ...auth, body: { decision: 'APPROVED' } })).status, 500);
  const rolledBack = await req('/access-requests/' + rollbackRequest.rows[0].id, auth);
  assert.equal(rolledBack.body.request.status, 'PENDING_GUIDE_APPROVAL'); assert.equal(rolledBack.body.history.length, 0);
  await pool.query('DROP TRIGGER test_fail_access_audit ON admin.audit_events; DROP FUNCTION admin.test_fail_access_audit()');
  pass('Audit failure rolls back both status and decision history atomically');
  await page.goto(origin + '/guide/access-requests'); await page.locator('.request-row').first().waitFor();
  await page.locator('#status-filter').selectOption('APPROVED_PENDING_TECHNICAL_IMPLEMENTATION');
  assert.ok(await page.locator('.request-row').count() >= 1);
  assert.equal(await page.locator('.request-row .status-REJECTED').count(), 0);
  pass('Browser status filter shows the selected decision state');
  await page.setViewportSize({ width: 390, height: 844 }); await page.locator('#status-filter').selectOption('ALL');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); await page.screenshot({ path: path.join(out, 'access-requests-mobile.png'), fullPage: true });
  await page.goto(origin + '/guide'); await page.locator('.slice-module').first().waitFor(); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); await page.screenshot({ path: path.join(out, 'guide-home-mobile.png'), fullPage: true });
  pass('Guide home and request list have no horizontal overflow at mobile width');
  assert.deepEqual(errors, []); pass('Browser flow completes without JavaScript exceptions');
} catch (e) {
  results.push({ name: 'Failure', status: 'FAIL', error: e.message }); console.error(e); process.exitCode = 1;
} finally {
  if (browser) await browser.close(); await stop(front); await stop(server); await pool.end();
  await dropTestDatabase(admin, dbName); await admin.end();
  writeFileSync(path.join(out, 'results.json'), JSON.stringify({ date: new Date().toISOString(), database: 'Isolated real PostgreSQL database, removed after test', results }, null, 2));
}
