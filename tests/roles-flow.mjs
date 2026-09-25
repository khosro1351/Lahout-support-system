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
const out = path.join(root, 'test-results/roles');
mkdirSync(out, { recursive: true });
const results = [];
const pass = name => { results.push({ name, status: 'PASS' }); console.log('PASS ' + name); };
const dbName = 'lahout_test_roles_' + Date.now();
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
 run('.tools/scripts/migrate.js');run('.tools/scripts/migrate.js');run('.tools/scripts/seed-dev.js');run('.tools/scripts/seed-access-dev.js');run('.tools/scripts/seed-guide-dev.js');run('.tools/scripts/seed-family-read-dev.js');
 const before=(await pool.query('SELECT (SELECT count(*) FROM family.families) families,(SELECT count(*) FROM assessment.snapshots) snapshots,(SELECT count(*) FROM identity.access_requests) requests')).rows[0];
 run('.tools/scripts/seed-roles-dev.js');const count=(await pool.query('SELECT count(*) FROM identity.accounts')).rows[0].count;run('.tools/scripts/seed-roles-dev.js');assert.equal((await pool.query('SELECT count(*) FROM identity.accounts')).rows[0].count,count);run('.tools/scripts/seed-roles-dev.js',{APP_ENV:'production'},1);
 assert.deepEqual((await pool.query('SELECT (SELECT count(*) FROM family.families) families,(SELECT count(*) FROM assessment.snapshots) snapshots,(SELECT count(*) FROM identity.access_requests) requests')).rows[0],before);
 pass('Additive migration and idempotent development role seed preserve families, snapshots and access requests; production seed blocked');
 const backendLog=openSync(path.join(out,'backend.log'),'w');server=spawn(process.execPath,['dist/main.js'],{cwd:backend,env,windowsHide:true,stdio:['ignore',backendLog,backendLog]});await waitReady('http://127.0.0.1:3001/api/v1/auth/me',server);
 async function login(username){const r=await req('/auth/login',{body:{username,password}});assert.equal(r.status,200,JSON.stringify(r.body));return {cookie:r.cookie,csrf:r.body.csrfToken,user:r.body.user,redirect:r.body.redirectTo};}
 const get=async(url,auth)=>{const r=await req(url,auth);assert.equal(r.status,200,JSON.stringify(r.body));return r.body;};
 const post=async(url,body,auth,status=200)=>{const r=await req(url,{...auth,body});assert.equal(r.status,status,JSON.stringify(r.body));return r.body;};
 const tech=await login('TechSupportDev'),leader=await login('LeaderDev'),executive=await login('ExecutiveDev'),helper=await login('HelperDev'),council=await login('CouncilDev'),multi=await login('MultiRoleDev'),guide=await login('Aseman');
 for(const [u,home] of [[tech,'/technical'],[leader,'/leader'],[executive,'/executive'],[helper,'/helper'],[council,'/council'],[guide,'/guide']]){assert.equal(u.redirect,home);assert.equal(u.user.roles.length,1);}
 assert.equal(multi.redirect,'/select-role');assert.equal(multi.user.roles.length,0);assert.equal(multi.user.availableRoles.length,2);
 pass('All six single-role accounts route to their own dashboard; multi-role login starts with no effective permissions');
 assert.equal((await req('/roles/dashboard',multi)).status,403);await post('/auth/select-role',{roleCode:'TECH_ADMIN'},multi,403);await post('/auth/select-role',{roleCode:'GROUP_LEADER'},multi);
 assert.equal((await get('/auth/me',multi)).user.effectiveRole,'GROUP_LEADER');assert.equal((await get('/auth/me',multi)).user.roles.length,1);
 await post('/auth/select-role',{roleCode:'COUNCIL_MEMBER'},multi);assert.equal((await req('/cases/groups',multi)).status,403);assert.equal((await get('/auth/me',multi)).user.roles[0].roleCode,'COUNCIL_MEMBER');
 pass('Role selection persists server-side, rejects unassigned roles and never unions permissions');
 assert.equal((await req('/technical/status',leader)).status,403);assert.equal((await req('/technical/users',{})).status,401);assert.equal((await req('/oversight/dashboard',tech)).status,403);assert.equal((await req('/access-requests',tech)).status,403);
 await post('/shared/families/00000000-0000-4000-8000-000000000000/draft',{payload:{}},tech,403);
 await post('/auth/simulation',{roleCode:'SUPREME_GUIDE'},leader,403);
 assert.equal((await req('/auth/simulation',{cookie:tech.cookie,body:{roleCode:'SUPREME_GUIDE'}})).status,403);
 pass('Technical role has no organizational superuser permissions; role/API/CSRF escalation attempts are denied');
 run('.tools/scripts/seed-livelihood-dev.js');
 const info=await get('/technical/status',tech),group=info.groups.find(g=>g.name==='گروه آزمایشی 1')??info.groups[0];
 await post('/auth/simulation',{roleCode:'GROUP_LEADER'},tech,400);await post('/auth/simulation',{roleCode:'GROUP_LEADER',groupId:'invalid'},tech,400);
 const homes={SUPREME_GUIDE:'/guide',EXECUTIVE_MANAGER:'/executive',GROUP_LEADER:'/leader',HELPER:'/helper',COUNCIL_MEMBER:'/council'};
 for(const roleCode of Object.keys(homes)){
  const scoped=['GROUP_LEADER','HELPER'].includes(roleCode);const d=await post('/auth/simulation',{roleCode,...(scoped?{groupId:group.id}:{})},tech);
  assert.equal(d.user.accountId,tech.user.accountId);assert.equal(d.user.effectiveRole,roleCode);assert.equal(d.user.redirectTo,homes[roleCode]);assert.equal(d.user.simulation,true);assert.equal(d.user.roles.length,1);assert.equal(d.user.roles[0].scopeId,scoped?group.id:null);
  assert.equal((await req('/technical/users',tech)).status,403);assert.equal((await req('/access-requests',tech)).status,roleCode==='SUPREME_GUIDE'?200:403);
  await get(roleCode==='SUPREME_GUIDE'?'/oversight/dashboard':'/roles/dashboard',tech);
  const restored=await post('/auth/simulation/stop',{},tech);assert.equal(restored.user.effectiveRole,'TECH_ADMIN');assert.equal(restored.user.simulation,false);
 }
 pass('All five technical simulations use only the selected real role and explicit group scope; exit restores technical context');
 await post('/auth/simulation',{roleCode:'GROUP_LEADER',groupId:group.id},tech);
 const families=(await get('/shared/groups/'+group.id,tech)).families;assert.ok(families.length);const family=families[0];const foreign=(await pool.query('SELECT id FROM family.families WHERE current_group_id<>$1 LIMIT 1',[group.id])).rows[0];
 assert.equal((await req('/shared/families/'+foreign.id,tech)).status,403);
 const workspace=await get('/shared/families/'+family.family_id+'/assessments',tech);assert.equal(workspace.canEdit,true);
 const payload=workspace.draft?.payload??{answers:{},urgency:'IMPORTANT'};
 const draft=await post('/shared/families/'+family.family_id+'/draft',{payload,version:workspace.draft?.version},tech);
 const history=(await pool.query("SELECT * FROM guidance.history WHERE actor_id=$1 AND action IN ('ASSESSMENT_CREATED','ASSESSMENT_DRAFT_UPDATED') ORDER BY occurred_at DESC LIMIT 1",[tech.user.accountId])).rows[0];
 assert.ok(history);assert.equal(history.effective_role,'GROUP_LEADER');assert.equal(history.simulation,true);assert.equal(history.effective_scopes[0].scopeId,group.id);
 const event=(await pool.query("SELECT * FROM admin.audit_events WHERE actor_account_id=$1 AND event_type IN ('GUIDE_ASSESSMENT_CREATED','GUIDE_ASSESSMENT_DRAFT_UPDATED') ORDER BY occurred_at DESC LIMIT 1",[tech.user.accountId])).rows[0];assert.equal(event.effective_role,'GROUP_LEADER');assert.equal(event.simulation,true);
 await post('/auth/simulation/stop',{},tech);
 pass('Simulated allowed draft write preserves real actor and effective role in both history and audit; foreign family denied');
 await post('/auth/simulation',{roleCode:'HELPER',groupId:group.id},tech);await post('/shared/families/'+family.family_id+'/draft',{payload,version:draft.version},tech,403);await post('/auth/simulation/stop',{},tech);
 pass('Helper simulation cannot use leader draft/submit permissions');
 const users=await get('/technical/users',tech);assert.ok(users.users.length);assert.ok(!JSON.stringify(users).includes('password_hash'));assert.ok((await get('/technical/audit',tech)).events.some(e=>e.simulation));
 pass('Technical user and audit read models contain no password hashes or session tokens');
 const frontendRequire=createRequire(path.join(root,'package.json'));const {chromium}=frontendRequire('playwright');
 const frontLog=openSync(path.join(out,'frontend.log'),'w');front=spawn(process.execPath,['tests/preview.mjs'],{cwd:root,env:{...env,PREVIEW_PORT:'5174',BACKEND_PROXY:'http://127.0.0.1:3001'},windowsHide:true,stdio:['ignore',frontLog,frontLog]});await waitReady(origin,front);
 browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/login');await page.locator('#username').fill('MultiRoleDev');await page.locator('#password').fill(password);await page.locator('#password').press('Enter');await page.waitForURL('**/select-role');await page.getByRole('heading',{name:'انتخاب نقش',exact:true}).waitFor();await page.screenshot({path:path.join(out,'role-selection.png'),fullPage:true});
 await page.getByRole('button',{name:/سرگروه/}).click();await page.waitForURL('**/leader');await page.getByRole('heading',{name:'داشبورد سرگروه',exact:true}).waitFor();await page.reload();await page.getByRole('heading',{name:'داشبورد سرگروه',exact:true}).waitFor();
 await page.goto(origin+'/technical');await page.getByRole('heading',{name:'دسترسی مجاز نیست',exact:true}).waitFor();
 pass('Browser multi-role login, selection, refresh and unauthorized route denial');
 await context.close();const tc=await browser.newContext({viewport:{width:1440,height:1000}});await tc.addCookies([{name:'lahout_session',value:tech.cookie.split('=')[1],url:origin,httpOnly:true,sameSite:'Strict'}]);const tp=await tc.newPage();tp.on('pageerror',e=>errors.push(e.message));
 await tp.goto(origin+'/technical');await tp.getByRole('heading',{name:'پنل پشتیبان فنی سامانه',exact:true}).waitFor();await tp.getByRole('heading',{name:'ورود آزمایشی به داشبورد نقش‌ها',exact:true}).waitFor();await tp.screenshot({path:path.join(out,'technical.png'),fullPage:true});
 for(const roleCode of Object.keys(homes)){
  if(['GROUP_LEADER','HELPER'].includes(roleCode)){const label=info.roles.find(r=>r.code===roleCode).label;await tp.getByRole('button',{name:'انتخاب گروه برای '+label,exact:true}).click();await tp.getByLabel('گروه برای آزمایش '+label,{exact:true}).getByRole('button',{name:'گروه '+Number(group.code.slice(-1)).toLocaleString('fa-IR'),exact:true}).click();}
  const label=info.roles.find(r=>r.code===roleCode).label;await tp.getByRole('button',{name:'ورود آزمایشی '+label,exact:true}).click();await tp.waitForURL('**'+homes[roleCode]).catch(async e=>{console.log('Simulation navigation failure',roleCode,tp.url(),await tp.locator('body').innerText());await tp.screenshot({path:path.join(out,'simulation-failure.png'),fullPage:true});throw e;});await tp.getByText('حالت آزمایش: '+label,{exact:true}).waitFor();await tp.getByRole('heading',{name:roleCode==='SUPREME_GUIDE'?'صفحه اصلی همیار شاهد':'داشبورد '+label,exact:true}).waitFor();await tp.waitForTimeout(250);
  const side=await tp.locator('.role-sidebar').boundingBox();assert.ok(side.x>1000);assert.equal(await tp.locator('[dir="rtl"]').count()>0,true);
  await tp.screenshot({path:path.join(out,roleCode.toLowerCase()+'.png'),fullPage:true});
  await tp.getByRole('button',{name:'بازگشت به پنل پشتیبان فنی',exact:true}).click();await tp.waitForURL('**/technical');await tp.getByRole('heading',{name:'ورود آزمایشی به داشبورد نقش‌ها',exact:true}).waitFor();
 }
 pass('Browser enters/exits all five simulation dashboards; visible banner and right-hand RTL sidebar');
 for(const width of [768,390]){await tp.setViewportSize({width,height:900});await tp.goto(origin+'/technical');await tp.getByRole('heading',{name:'ورود آزمایشی به داشبورد نقش‌ها',exact:true}).waitFor();assert.ok(await tp.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await tp.getByRole('button',{name:'☰ منوی سامانه'}).click();assert.ok(await tp.locator('.role-sidebar').isVisible());await tp.screenshot({path:path.join(out,'technical-'+width+'.png'),fullPage:true});}
 assert.deepEqual(errors,[]);pass('Technical tablet/mobile menu and document width pass with no JavaScript exceptions');
 await tc.close();
 await post('/auth/simulation',{roleCode:'GROUP_LEADER',groupId:group.id},tech);
 await pool.query("UPDATE organization.groups SET status='INACTIVE' WHERE id=$1",[group.id]);
 assert.equal((await req('/roles/dashboard',tech)).status,403);
 assert.equal((await get('/auth/me',tech)).user.roles.length,0);
 await post('/auth/simulation/stop',{},tech);assert.equal((await get('/auth/me',tech)).user.effectiveRole,'TECH_ADMIN');
 await pool.query("UPDATE organization.groups SET status='ACTIVE' WHERE id=$1",[group.id]);
 pass('Inactive simulation scope fails closed while exit to technical dashboard remains available');
 await post('/auth/simulation',{roleCode:'SUPREME_GUIDE'},tech);
 // Revoke a real assignment and verify session cannot retain its previous permission.
 await pool.query("UPDATE identity.role_assignments SET valid_to=now() WHERE account_id=$1 AND role_code='TECH_ADMIN'",[tech.user.accountId]);assert.equal((await req('/technical/status',tech)).status,403);assert.equal((await req('/access-requests',tech)).status,403);assert.equal((await get('/auth/me',tech)).user.roles.length,0);
 pass('Current role revocation is enforced on an existing session');
} catch(e){results.push({name:'suite',status:'FAIL',message:e.message});throw e;}
finally{await browser?.close();await stop(front);await stop(server);await pool.end();await dropTestDatabase(admin,dbName);await admin.end();writeFileSync(path.join(out,'results.json'),JSON.stringify({date:new Date().toISOString(),results},null,2));}
