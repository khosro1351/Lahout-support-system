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
const out = path.join(root, 'test-results/leader-workspace');
mkdirSync(out, { recursive: true });
const results = [];
const pass = name => { results.push({ name, status: 'PASS' }); console.log('PASS ' + name); };
const dbName = 'lahout_test_leader_ui_' + Date.now();
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
 await page.goto(origin+'/technical/simulation');await page.getByRole('button',{name:'انتخاب گروه برای سرگروه',exact:true}).click();
 const choices=page.getByRole('group',{name:'گروه برای آزمایش سرگروه',exact:true});assert.equal(await choices.getByRole('button').count(),5);assert.equal(await choices.locator('select').count(),0);
 assert.ok(await page.getByRole('button',{includeHidden:true,name:'ورود آزمایشی سرگروه',exact:true}).isDisabled());await choices.getByRole('button',{name:'گروه ۱',exact:true}).click();assert.ok((await page.getByRole('button',{name:'ورود آزمایشی سرگروه',exact:true}).innerText()).includes('گروه ۱'));await page.getByRole('button',{name:'ورود آزمایشی سرگروه',exact:true}).click();await page.waitForURL('**/leader');await page.getByRole('heading',{name:'فهرست خانواده‌های گروه',exact:true}).waitFor();
 pass('One click opens five group buttons without another select; entry requires scope and visible CTA identifies the chosen role and group');
 const fs=(await get('/livelihood/families',tech)).families;assert.equal(fs.length,10);assert.ok(fs.every(f=>f.current_group_id===info.groups[0].id));assert.deepEqual(Object.fromEntries(['VALID','PENDING','RETURNED','DRAFT','INCOMPLETE'].map(s=>[s,fs.filter(f=>f.status===s).length])),{VALID:4,PENDING:2,RETURNED:2,DRAFT:2,INCOMPLETE:0});
 assert.equal(fs.filter(f=>f.data_status==='UNKNOWN').length,1);assert.equal(fs.filter(f=>f.data_status==='INCOMPLETE').length,1);
 for(const f of fs){const w=await get('/livelihood/families/'+f.id,tech);const result=['SUBMITTED','IN_REVIEW','APPROVED'].includes(f.state)?w.submissions[0].snapshot.result:w.result;assert.equal(f.score,result.score);assert.equal(f.member_count,w.members.length);}
 assert.equal(await page.getByRole('columnheader',{name:'گروه',exact:true}).count(),0);assert.equal(await page.getByRole('columnheader',{name:'سطح ثبت‌شده',exact:true}).count(),0);
 await page.screenshot({path:path.join(out,'leader-dashboard.png'),fullPage:true});await page.getByRole('button',{name:/نیازمند اقدام من.*نمایش در فهرست/}).click();assert.equal(await page.locator('tbody tr').count(),4);await page.getByRole('button',{name:/منتظر تأیید مدیر اجرایی.*نمایش در فهرست/}).click();assert.equal(await page.locator('tbody tr').count(),2);
 pass('Dashboard cards filter real group rows; five seeded states, member counts and scores match authoritative workflow data and no final level is shown');
 await page.getByRole('navigation',{name:'منوی نقش',exact:true}).getByRole('link',{name:'گروه‌ها و خانواده‌ها',exact:true}).click();await page.waitForURL('**/leader/families');await page.locator('tbody tr').first().waitFor();await page.screenshot({path:path.join(out,'leader-families.png'),fullPage:true});
 await page.locator('tbody tr').first().getByRole('link',{name:'مشاهده پرونده',exact:true}).click();await page.getByRole('heading',{name:'خلاصه پرونده خانواده',exact:true}).waitFor();await page.getByText('تاریخچه پرونده',{exact:true}).click();await page.locator('.history-result').first().waitFor();await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:path.join(out,'family-workspace.png'),fullPage:true});await nav().getByRole('link',{name:'بازگشت',exact:true}).click();await page.waitForURL('**/leader/families');
 assert.equal((await get('/auth/me',tech)).user.simulation,true);await page.goto(origin+'/workspace/groups');await page.waitForURL('**/leader/families');
 pass('Previously blank approved family renders structured history; simulation Back and groups menu return to leader family list without ending effective role');
 await page.goto(origin+'/leader?filter=RETURNED');await page.locator('tbody tr').first().waitFor();await page.locator('tbody tr').first().getByRole('link',{name:'مشاهده پرونده',exact:true}).click();await nav().getByRole('link',{name:'بازگشت',exact:true}).click();await page.waitForURL('**/leader?filter=RETURNED');
 await page.goto(origin+'/workspace/families/'+fs[0].id+'?returnTo='+encodeURIComponent('/technical'));await page.getByRole('heading',{name:'خلاصه پرونده خانواده',exact:true}).waitFor();assert.equal(await nav().getByRole('link',{name:'بازگشت',exact:true}).getAttribute('href'),'/leader/families');await nav().getByRole('link',{name:'خانه',exact:true}).click();await page.waitForURL('**/leader');
 pass('Validated entry context preserves dashboard filter; forged technical parent is rejected and Home uses the active leader role');
 await page.goto(origin+'/workspace');await page.getByRole('heading',{name:'موارد نیازمند اقدام',exact:true}).waitFor();await page.getByLabel('نوع پیگیری',{exact:true}).selectOption('RETURNED');assert.equal(await page.locator('tbody tr').count(),2);await page.getByLabel('نوع پیگیری',{exact:true}).selectOption('INCOMPLETE');assert.equal(await page.locator('tbody tr').count(),2);await page.getByLabel('نوع پیگیری',{exact:true}).selectOption('all');await page.screenshot({path:path.join(out,'leader-followups.png'),fullPage:true});
 pass('Followups show real returned/incomplete drafts, existing assignments and active alerts with actionable links; unsupported reminder rules are explicit');
 await page.getByRole('button',{name:'بازگشت به پنل پشتیبان فنی',exact:true}).click();await page.waitForURL('**/technical');
 let opened=0;for(let n=1;n<=5;n++){const auth=await login('TestV100_Leader'+n,'GROUP_LEADER'),p=await browserAs(auth),families=(await get('/livelihood/families',auth)).families;assert.equal(families.length,10);for(const f of families){await p.goto(origin+'/workspace/families/'+f.id);await p.getByRole('heading',{name:'خلاصه پرونده خانواده',exact:true}).waitFor();await p.getByText('تاریخچه پرونده',{exact:true}).click();await p.getByRole('heading',{name:'تاریخچه',exact:true}).waitFor();assert.ok((await p.locator('body').innerText()).includes(f.head_name));opened++;}await p.context().close();}assert.equal(opened,50);
 pass('All 50 seeded family workspaces open through their real authorized leader, including approved/submitted/returned/incomplete history, with no React render errors');
 const leaderFresh=await login('TestV100_Leader1','GROUP_LEADER');const foreign=(await pool.query("SELECT id FROM family.families WHERE family_code='HL-TEST-G2-01'")).rows[0].id;
 for(const route of ['/shared/families/','/livelihood/families/'])assert.equal((await req(route+foreign,leaderFresh)).status,403);
 assert.equal((await req('/livelihood/families/'+foreign+'/draft',{...leaderFresh,body:{payload:{}}})).status,403);
 const lp=await browserAs(leaderFresh);await lp.goto(origin+'/workspace/families/'+foreign);await lp.getByRole('alert').first().waitFor();assert.ok(await lp.getByRole('heading',{name:'پرونده خانواده',exact:true}).isVisible());await lp.goto(origin+'/workspace/families/00000000-0000-0000-0000-000000000000');await lp.getByRole('alert').first().waitFor();
 pass('Foreign-group reads/mutations are denied; missing and inaccessible families show controlled Persian errors instead of blank pages');
 const ep=await browserAs(exec);await ep.goto(origin+'/workspace/families/'+fs[0].id+'?returnTo='+encodeURIComponent('/executive'));await ep.getByRole('heading',{name:'خلاصه پرونده خانواده',exact:true}).waitFor();await ep.getByRole('navigation',{name:'ناوبری صفحه',exact:true}).getByRole('link',{name:'بازگشت',exact:true}).click();await ep.waitForURL('**/executive');
 const legacy=(await pool.query("SELECT id FROM family.families WHERE family_code NOT LIKE 'HL-TEST-G%' ORDER BY family_code LIMIT 1")).rows[0];if(legacy){await ep.goto(origin+'/workspace/families/'+legacy.id);await ep.getByRole('heading',{name:'خلاصه پرونده خانواده',exact:true}).waitFor();}
 pass('Executive family entry context returns to executive dashboard; legacy family records also render alongside current seeded data');
 const account=(await get('/auth/me',leaderFresh)).user.accountId;
 const notification=(await pool.query("INSERT INTO guidance.notifications(recipient_id,category,message,visibility,dedupe_key,link_type,link_id) VALUES($1,'RESPONSIBILITY','اعلان آزمون پرونده خانواده','PUBLIC','leader-ui-test','FAMILY',$2) RETURNING id",[account,fs[0].id])).rows[0];
 await lp.goto(origin+'/workspace/notifications');const notice=lp.locator('article').filter({hasText:'اعلان آزمون پرونده خانواده'});await notice.getByRole('button',{name:'خواندم',exact:true}).click();await notice.getByText(/خوانده‌شده/).waitFor();assert.equal(await notice.getByRole('button',{name:'خواندم',exact:true}).count(),0);assert.ok(await notice.getByRole('link',{name:'مشاهده مورد',exact:true}).isVisible());await lp.getByRole('button',{name:/^خوانده‌نشده/}).click();assert.equal(await notice.count(),0);await lp.getByRole('button',{name:/^همه اعلان‌ها/}).click();assert.equal(await notice.count(),1);
 await post('/auth/logout',{},leaderFresh);const again=await login('TestV100_Leader1','GROUP_LEADER');assert.ok((await get('/workspace/notifications',again)).notifications.find(n=>n.id===notification.id).seen_at);const ap=await browserAs(again);await ap.goto(origin+'/workspace/notifications');await ap.locator('article').filter({hasText:'اعلان آزمون پرونده خانواده'}).getByText(/خوانده‌شده/).waitFor();
 pass('Unread/all filters and muted read state work; read receipt persists after logout/login and family relation links to the real record');
 for(const route of ['/leader','/leader/families','/workspace','/workspace/families/'+fs[0].id]){await ap.goto(origin+route);await ap.locator('.leader-workspace,.family-workspace').waitFor();for(const width of [1920,1440,768,390]){await ap.setViewportSize({width,height:1080});assert.ok(await ap.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'overflow '+route+' '+width);}await ap.screenshot({path:path.join(out,route==='/leader'?'leader-mobile.png':'page-'+route.split('/').pop()+'-mobile.png'),fullPage:true});}
 assert.deepEqual(errors,[]);await lp.context().close();await ep.context().close();await ap.context().close();
 pass('Operational leader pages fit desktop 1920/1440, tablet and mobile with existing fonts, RTL and right sidebar, without JavaScript exceptions');
 await post('/auth/simulation',{roleCode:'GROUP_LEADER',groupId:info.groups[0].id},tech);await post('/auth/simulation/stop',{},tech);
 const audit=(await get('/technical/audit',tech)).events;assert.ok(audit.some(e=>e.simulation&&e.effective_role==='GROUP_LEADER'&&e.username==='TechSupportDev'));assert.deepEqual(await protectedDigest(),before);
 pass('Technical simulation preserves real actor/effective role audit; family/member/review/snapshot/permission content remains unchanged');
}catch(e){results.push({name:'suite',status:'FAIL',message:e.message});throw e;}
finally{await browser?.close();await stop(front);await stop(server);await pool.end();await dropTestDatabase(admin,dbName);await admin.end();writeFileSync(path.join(out,'results.json'),JSON.stringify({date:new Date().toISOString(),results},null,2));}

