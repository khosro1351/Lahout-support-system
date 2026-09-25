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
const out = path.join(root, 'test-results/technical-ui');
mkdirSync(out, { recursive: true });
const results = [];
const pass = name => { results.push({ name, status: 'PASS' }); console.log('PASS ' + name); };
const dbName = 'lahout_test_technical_ui_' + Date.now();
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
 run('.tools/scripts/migrate.js');run('.tools/scripts/seed-dev.js');run('.tools/scripts/seed-guide-dev.js');run('.tools/scripts/seed-roles-dev.js');run('.tools/scripts/seed-livelihood-dev.js');run('.tools/scripts/seed-livelihood-scenarios-dev.js');
 const protectedDigest=async()=>{const out={};for(const table of ['family.families','family.family_memberships','assessment.domain_reviews','assessment.domain_submissions','assessment.domain_decisions','identity.role_assignments'])out[table]=(await pool.query(`SELECT md5(string_agg(to_jsonb(x)::text,'' ORDER BY id)) hash FROM ${table} x`)).rows[0].hash;return out;};const before=await protectedDigest();
 const log=openSync(path.join(out,'backend.log'),'w');server=spawn(process.execPath,['dist/main.js'],{cwd:backend,env,windowsHide:true,stdio:['ignore',log,log]});await waitReady('http://127.0.0.1:3001/api/v1/auth/me',server);
 const post=async(url,body,auth,status=200)=>{const r=await req(url,{...auth,body});assert.equal(r.status,status,JSON.stringify(r.body));return r.body;};
 const get=async(url,auth)=>{const r=await req(url,auth);assert.equal(r.status,200,JSON.stringify(r.body));return r.body;};
 async function login(username,role){const r=await req('/auth/login',{body:{username,password}});assert.equal(r.status,200,JSON.stringify(r.body));const a={cookie:r.cookie,csrf:r.body.csrfToken};if(role)await post('/auth/select-role',{roleCode:role},a);return a;}
 const tech=await login('TechSupportDev'),leader=await login('TestV100_Leader1','GROUP_LEADER'),exec=await login('TestV100_Executive','EXECUTIVE_MANAGER');
 const info=await get('/technical/status',tech);assert.equal(info.groups.length,5);assert.deepEqual(info.groups.map(g=>g.code),[1,2,3,4,5].map(n=>'V100-TEST-G'+n));assert.equal(info.version,'0.1.0');assert.equal(info.environment,'development');assert.equal(info.database,'CONNECTED');assert.ok(Date.now()-new Date(info.checkedAt)<10000);
 assert.equal((await req('/technical/status',leader)).status,403);
 const users=(await get('/technical/users',tech)).users;assert.equal(users.filter(u=>u.cohort==='CURRENT').length,21);assert.ok(users.filter(u=>u.cohort==='LEGACY').length>=5);assert.equal(users.find(u=>u.username==='Aseman').name,'حساب همیار شاهد');assert.deepEqual(users.find(u=>u.username==='TestV100_Executive').roles.map(r=>r.code).sort(),['COUNCIL_MEMBER','EXECUTIVE_MANAGER']);assert.ok(!JSON.stringify(users).includes('password_hash'));
 pass('Technical API returns real status/version/time and only five current groups; current/legacy classification and Shahdeh dual roles preserve access guards');
 const {chromium}=createRequire(path.join(root,'package.json'))('playwright');const flog=openSync(path.join(out,'frontend.log'),'w');front=spawn(process.execPath,['tests/preview.mjs'],{cwd:root,env:{...env,PREVIEW_PORT:'5174',BACKEND_PROXY:'http://127.0.0.1:3001'},windowsHide:true,stdio:['ignore',flog,flog]});await waitReady(origin,front);browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});const errors=[];
 async function browserAs(auth){const c=await browser.newContext({viewport:{width:1440,height:1050}});await c.addCookies([{name:'lahout_session',value:auth.cookie.split('=')[1],url:origin,httpOnly:true,sameSite:'Strict'}]);const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));return p;}
 const page=await browserAs(tech),nav=()=>page.getByRole('navigation',{name:'ناوبری صفحه',exact:true});
 await page.goto(origin+'/technical');await page.getByRole('heading',{name:'وضعیت فنی سامانه',exact:true}).waitFor();await page.evaluate(async()=>{await document.fonts.load('400 16px "Liana"','سامانه');await document.fonts.load('700 16px "Liana FD"','123۴۵۶');await document.fonts.ready;});
 assert.ok(await page.evaluate(()=>document.fonts.check('400 16px "Liana"','سامانه')&&document.fonts.check('700 16px "Liana FD"','123۴۵۶')));
 const fontResources=await page.evaluate(()=>performance.getEntriesByType('resource').filter(x=>x.name.includes('Liana')&&x.name.includes('.woff2')).map(x=>x.name));assert.equal(fontResources.length,2);assert.ok(fontResources.every(x=>x.startsWith(origin+'/')));
 pass('Both supplied variable Liana and Liana FD WOFF2 fonts load from local assets; Persian digits use the FD face without external font requests');
 assert.equal(await page.locator('.tech-health').count(),4);assert.equal(await page.locator('select').count(),0);assert.equal(await page.locator('.role-menu-deferred').count(),2);await page.screenshot({path:path.join(out,'technical-dashboard.png'),fullPage:true});
 await nav().getByRole('link',{name:'خانه',exact:true}).click();await page.waitForURL('**/technical');
 await page.goto(origin+'/technical/health');await page.getByRole('heading',{name:'سلامت سامانه',exact:true}).waitFor();await nav().getByRole('link',{name:'بازگشت',exact:true}).click();await page.waitForURL('**/technical');
 await page.goto(origin+'/technical/users');await nav().getByRole('link',{name:'خانه',exact:true}).click();await page.waitForURL('**/technical');
 pass('Technical dashboard, health and users Home/Back return to technical dashboard; read-only health cards and deferred sidebar are explicit');
 await page.goto(origin+'/technical/simulation');const enterLeader=page.getByRole('button',{name:'ورود آزمایشی سرگروه',exact:true});assert.ok(await enterLeader.isDisabled());assert.equal(await page.locator('select').count(),0);
 await page.getByRole('button',{name:'انتخاب گروه برای سرگروه',exact:true}).click();const groupSelect=page.getByLabel('گروه برای آزمایش سرگروه',{exact:true});assert.equal(await groupSelect.locator('option').count(),6);assert.ok(await enterLeader.isDisabled());await page.screenshot({path:path.join(out,'simulation-group-selection.png'),fullPage:true});await groupSelect.selectOption(info.groups[0].id);assert.equal(await enterLeader.isDisabled(),false);await enterLeader.click();await page.waitForURL('**/leader');
 await page.goto(origin+'/workspace/livelihood');await nav().getByRole('link',{name:'خانه',exact:true}).click();await page.waitForURL('**/leader');assert.ok(await page.getByText('حالت آزمایش: سرگروه',{exact:true}).isVisible());
 const family=(await pool.query("SELECT id FROM family.families WHERE family_code='HL-TEST-G1-01'")).rows[0];
 await page.goto(origin+'/workspace/livelihood/'+family.id);await page.getByRole('heading',{name:'اطلاعات خانواده و ارزیابی معیشت',exact:true}).waitFor();await nav().getByRole('link',{name:'بازگشت',exact:true}).click();await page.waitForURL('**/workspace/livelihood');
 await page.getByRole('button',{name:'بازگشت به پنل پشتیبان فنی',exact:true}).click();await page.waitForURL('**/technical');assert.equal((await get('/auth/me',tech)).user.simulation,false);
 pass('Scoped simulation requires group, shows exactly five options, uses leader Home/parent and exits only through explicit technical return');
 for(const [label,home] of [['مدیر اجرایی','/executive'],['همیار گروه','/helper'],['همیار شاهد','/guide'],['عضو شورای کانون','/council']]){
  if(label==='همیار گروه'){await page.getByRole('button',{name:'انتخاب گروه برای '+label,exact:true}).click();assert.ok(await page.getByRole('button',{name:'ورود آزمایشی '+label,exact:true}).isDisabled());await page.getByLabel('گروه برای آزمایش '+label,{exact:true}).selectOption(info.groups[1].id);}
  await page.getByRole('button',{name:'ورود آزمایشی '+label,exact:true}).click();await page.waitForURL('**'+home);await page.getByText('حالت آزمایش: '+label,{exact:true}).waitFor();
  if(label==='مدیر اجرایی'){await page.goto(origin+'/executive/assessments');await nav().getByRole('link',{name:'بازگشت',exact:true}).click();await page.waitForURL('**/executive');await page.goto(origin+'/executive/permissions');await page.waitForURL('**/executive');}
  else await page.goto(origin+'/workspace/notifications');
  await nav().getByRole('link',{name:'خانه',exact:true}).click();await page.waitForURL('**'+home);assert.notEqual(page.url(),origin+'/forbidden');assert.equal((await get('/auth/me',tech)).user.simulation,true);
  await page.getByRole('button',{name:'بازگشت به پنل پشتیبان فنی',exact:true}).click();await page.waitForURL('**/technical');
 }
 pass('All organizational simulations keep effective-role Home; executive parent and retired-route redirect avoid Forbidden without ending simulation');
 for(const [auth,home]of [[leader,'/leader'],[exec,'/executive']]){const p=await browserAs(auth);await p.goto(origin+'/workspace/livelihood/'+family.id);const n=p.getByRole('navigation',{name:'ناوبری صفحه',exact:true});await n.getByRole('link',{name:'بازگشت',exact:true}).click();await p.waitForURL('**/workspace/livelihood');await n.getByRole('link',{name:'خانه',exact:true}).click();await p.waitForURL('**'+home);await p.goto(origin+'/technical/users');await p.waitForURL('**/forbidden');await p.getByRole('link',{name:'بازگشت به داشبورد نقش فعال',exact:true}).click();await p.waitForURL('**'+home);await p.context().close();}
 pass('Real leader and executive Home/Back are authorized; direct forbidden technical access still fails and recovery returns to active dashboard');
 await page.goto(origin+'/technical/users');await page.getByRole('tab',{name:/کاربران نسخه جاری/}).waitFor();assert.equal(await page.locator('tbody tr').count(),21);assert.equal(await page.getByText('CouncilDev',{exact:true}).count(),0);assert.equal(await page.getByText('راهبر عالی',{exact:false}).count(),0);
 const filter=async(label,value)=>page.getByLabel(label,{exact:true}).selectOption(value);
 await page.getByLabel('جست‌وجوی نام یا نام کاربری',{exact:true}).fill('شاهده');assert.equal(await page.locator('tbody tr').count(),1);const row=page.locator('tbody tr').first();assert.ok(await row.getByText('مدیر اجرایی',{exact:true}).isVisible());assert.ok(await row.getByText('عضو شورای کانون',{exact:true}).isVisible());
 await page.getByLabel('جست‌وجوی نام یا نام کاربری',{exact:true}).fill('');await filter('نقش','GROUP_LEADER');assert.equal(await page.locator('tbody tr').count(),5);await filter('گروه',info.groups[0].id);assert.equal(await page.locator('tbody tr').count(),1);await filter('وضعیت','ACTIVE');await filter('نوع حساب','TEST');assert.equal(await page.locator('tbody tr').count(),1);await filter('نوع حساب','OPERATIONAL');await page.getByText('حسابی مطابق این فیلترها پیدا نشد.',{exact:true}).waitFor();await filter('نوع حساب','');await filter('نقش','');await filter('گروه','');await filter('وضعیت','');await page.screenshot({path:path.join(out,'current-users.png'),fullPage:true});
 await page.getByRole('tab',{name:/حساب‌های توسعه و قدیمی/}).click();await page.getByText('CouncilDev',{exact:true}).waitFor();assert.equal(await page.getByText('TestV100_Leader1',{exact:true}).count(),0);await page.screenshot({path:path.join(out,'legacy-users.png'),fullPage:true});
 pass('Current/legacy tabs, name search and role/group/status/account-type filters work; multi-role badges and empty states are clear');
 await post('/auth/simulation',{roleCode:'EXECUTIVE_MANAGER'},tech);await post('/auth/simulation/stop',{},tech);
 await page.goto(origin+'/technical/audit');await page.locator('tbody tr').first().waitFor();await page.getByText('شروع آزمایش نقش',{exact:true}).first().waitFor();assert.ok(await page.getByRole('columnheader',{name:'کاربر واقعی',exact:true}).isVisible());assert.ok(await page.getByRole('columnheader',{name:'نقش مؤثر',exact:true}).isVisible());await page.screenshot({path:path.join(out,'technical-audit.png'),fullPage:true});
 const audit=(await get('/technical/audit',tech)).events;assert.ok(audit.some(e=>e.simulation&&e.effective_role==='EXECUTIVE_MANAGER'&&e.username==='TechSupportDev'));
 pass('Audit displays real technical actor, effective simulated role, event/state/time without leaking credential fields');
 await page.route('**/api/v1/technical/status',r=>r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{message:'بررسی اتصال انجام نشد.'}})}));await page.goto(origin+'/technical/health');await page.getByRole('alert').waitFor();assert.equal(await page.locator('.tech-health.healthy').count(),0);await page.unroute('**/api/v1/technical/status');await page.getByRole('button',{name:'بررسی دوباره اتصال',exact:true}).click();await page.locator('.tech-health.healthy').first().waitFor();
 pass('Health fetch failure never renders invented green status and explicit retry restores live checked data');
 for(const route of ['/technical','/technical/users','/technical/simulation','/technical/health','/technical/audit']){await page.goto(origin+route);await page.locator('.technical-workspace').waitFor();for(const width of [1440,768,390]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'overflow '+route+' '+width);}await page.screenshot({path:path.join(out,route.split('/').pop()+'-mobile.png'),fullPage:true});}
 assert.deepEqual(errors,[]);assert.deepEqual(await protectedDigest(),before);
 const counts=(await pool.query("SELECT count(*)::int families,(SELECT count(*)::int FROM family.family_memberships m JOIN family.families f ON f.id=m.family_id WHERE f.family_code LIKE 'HL-TEST-G%' AND m.valid_to IS NULL) members,(SELECT count(*)::int FROM assessment.domain_reviews) assessments,(SELECT count(*)::int FROM assessment.domain_decisions WHERE decision='APPROVED' AND valid_until>now()) valid FROM family.families WHERE family_code LIKE 'HL-TEST-G%' ")).rows[0];assert.deepEqual(counts,{families:50,members:200,assessments:50,valid:20});
 pass('All technical pages fit desktop/tablet/mobile with RTL and no JS errors; 50 families/200 members/50 assessments/20 valid snapshots and permission rows unchanged');
}catch(e){results.push({name:'suite',status:'FAIL',message:e.message});throw e;}
finally{await browser?.close();await stop(front);await stop(server);await pool.end();await dropTestDatabase(admin,dbName);await admin.end();writeFileSync(path.join(out,'results.json'),JSON.stringify({date:new Date().toISOString(),results},null,2));}
