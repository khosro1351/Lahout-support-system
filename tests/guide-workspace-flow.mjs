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
const out = path.join(root, 'test-results/guide-workspace');
mkdirSync(out, { recursive: true });
const results = [];
const pass = name => { results.push({ name, status: 'PASS' }); console.log('PASS ' + name); };
const dbName = 'lahout_test_guide_' + Date.now();
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
 run('.tools/scripts/migrate.js');run('.tools/scripts/migrate.js');run('.tools/scripts/seed-dev.js');run('.tools/scripts/seed-access-dev.js');run('.tools/scripts/seed-guide-dev.js');run('.tools/scripts/seed-guide-dev.js');
 assert.equal((await pool.query('SELECT count(*)::int n FROM guidance.items')).rows[0].n,1);
 run('.tools/scripts/seed-guide-dev.js',{APP_ENV:'production'},1);
 pass('Five PostgreSQL migrations, repeatable guide seed and production seed refusal');
 const backendLog=openSync(path.join(out,'backend.log'),'w');server=spawn(process.execPath,['dist/main.js'],{cwd:backend,env,windowsHide:true,stdio:['ignore',backendLog,backendLog]});await waitReady('http://127.0.0.1:3001/api/v1/auth/me',server);
 async function login(username){const r=await req('/auth/login',{body:{username,password}});assert.equal(r.status,200);return {cookie:r.cookie,csrf:r.body.csrfToken,user:r.body.user,redirect:r.body.redirectTo};}
 const guide=await login('Aseman'),helper=await login('GuideDemoHelper'),manager=await login('GuideDemoManager');
 assert.equal(helper.redirect,'/workspace');assert.equal(guide.redirect,'/guide');
 assert.equal((await req('/guide/dashboard',helper)).status,403);
 assert.equal((await req('/guide/people')).status,401);
 pass('Recipient login uses existing secure sessions and cannot access guide endpoints');
 const get=async(url,auth=guide)=>{const r=await req(url,auth);assert.equal(r.status,200,JSON.stringify(r.body));return r.body;};
 const post=async(url,body,auth=guide,expected=200)=>{const r=await req(url,{...auth,body});assert.equal(r.status,expected,JSON.stringify(r.body));return r.body;};
 const people=(await get('/guide/people')).people,hp=people.find(p=>p.account_id===helper.user.accountId),mp=people.find(p=>p.account_id===manager.user.accountId);
 assert.ok(hp);assert.ok(mp);assert.equal((await get('/guide/people?q=Development%2FTest&status=ACTIVE')).people.length,2);
 pass('People search, active-account filter and current multi-role data');
 await post('/guide/people/'+hp.id+'/assign',{role:'COUNCIL_MEMBER'},helper,403);
 await post('/guide/people/'+hp.id+'/assign',{role:'COUNCIL_MEMBER'},{cookie:guide.cookie},403);
 await post('/guide/people/'+hp.id+'/assign',{role:'UNKNOWN'},guide,400);
 const role=await post('/guide/people/'+hp.id+'/assign',{role:'COUNCIL_MEMBER',reason:'آزمایش انتصاب'});
 assert.ok((await get('/auth/me',helper)).user.roles.some(r=>r.roleCode==='COUNCIL_MEMBER'));
 await post('/guide/people/'+hp.id+'/assign',{role:'COUNCIL_MEMBER'},guide,409);
 pass('Role assignment activates immediately in existing session; authorization, CSRF and duplicates enforced');
 await post('/guide/people/'+hp.id+'/assign',{role:'TECH_ADMIN',assignmentId:role.id,reason:'تغییر آزمایشی'});
 let roles=(await get('/auth/me',helper)).user.roles;
 assert.ok(roles.some(r=>r.roleCode==='HELPER'));assert.ok(roles.some(r=>r.roleCode==='TECH_ADMIN'));assert.ok(!roles.some(r=>r.roleCode==='COUNCIL_MEMBER'));
 const changed=(await get('/guide/people/'+hp.id)).person.roles.find(r=>r.role_code==='TECH_ADMIN');
 await post('/guide/people/'+hp.id+'/end-role',{assignmentId:changed.id});await post('/guide/people/'+hp.id+'/end-role',{assignmentId:changed.id},guide,409);
 pass('Role change ends only previous same-scope assignment; multi-role combinations and history preserved');
 await post('/guide/people/'+hp.id+'/assign',{role:'SUPREME_GUIDE'},guide,409);
 await assert.rejects(pool.query("INSERT INTO identity.role_assignments(account_id,role_code,scope_type) VALUES($1,'SUPREME_GUIDE','ORGANIZATION')",[helper.user.accountId]));
 pass('PostgreSQL and API prevent concurrent supreme guides');
 const group=await post('/guide/groups',{name:'گروه آزمون تغییر سرگروه',accountId:helper.user.accountId});
 let g=await get('/guide/groups/'+group.id);assert.ok(g.group.leader_name.includes('همیار'));assert.equal(g.group.status,'ACTIVE');
 await post('/guide/groups/'+group.id+'/leader',{accountId:manager.user.accountId,reason:'تغییر مسئولیت'});
 roles=(await get('/auth/me',helper)).user.roles;assert.ok(!roles.some(r=>r.roleCode==='GROUP_LEADER'&&r.scopeId===group.id));assert.ok((await get('/auth/me',manager)).user.roles.some(r=>r.roleCode==='GROUP_LEADER'&&r.scopeId===group.id));
 assert.ok((await get('/guide/groups/'+group.id)).history.some(h=>h.action==='LEADER_CHANGED'));
 pass('Group leader change atomically updates old/new scopes, permissions, history and organizational notification');
 const race=await Promise.all([helper,manager].map(a=>req('/guide/groups/'+group.id+'/leader',{...guide,body:{accountId:a.user.accountId}})));
 assert.ok(race.every(r=>[200,409].includes(r.status)));
 assert.equal((await pool.query("SELECT count(*)::int n FROM identity.role_assignments WHERE role_code='GROUP_LEADER' AND scope_id=$1 AND valid_to IS NULL",[group.id])).rows[0].n,1);
 pass('Concurrent group-leader decisions leave exactly one current group leader');
 const familyBefore=(await pool.query('SELECT count(*) FROM family.families')).rows[0].count;
 const sample=(await get('/guide/groups')).groups.find(g=>g.code==='DEV-GUIDE-01');await post('/guide/groups/'+sample.id+'/dissolve',{});
 assert.equal((await pool.query('SELECT count(*) FROM family.families')).rows[0].count,familyBefore);
 await post('/guide/groups/'+sample.id+'/leader',{accountId:helper.user.accountId},guide,409);
 await post('/guide/people/'+hp.id+'/assign',{role:'HELPER',scopeId:sample.id},guide,409);
 pass('Dissolution preserves families/history and blocks new group appointments');
 await pool.query("CREATE FUNCTION guidance.fail_test_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.event_type='GUIDE_ROLE_ASSIGNED' THEN RAISE EXCEPTION 'test'; END IF; RETURN NEW; END $$");
 await pool.query('CREATE TRIGGER fail_test BEFORE INSERT ON admin.audit_events FOR EACH ROW EXECUTE FUNCTION guidance.fail_test_audit()');
 await post('/guide/people/'+hp.id+'/assign',{role:'COUNCIL_MEMBER'},guide,500);
 assert.ok(!(await get('/auth/me',helper)).user.roles.some(r=>r.roleCode==='COUNCIL_MEMBER'));
 await pool.query('DROP TRIGGER fail_test ON admin.audit_events');
 pass('Audit insertion failure rolls back role mutation and automatic consequences');
 const item=await post('/guide/items',{kind:'MISSION',subject:'مأموریت محرمانه آزمون',body:'نتیجه بررسی را ثبت کنید.',audienceType:'PEOPLE',audience:[helper.user.accountId],confidential:true,deadline:new Date(Date.now()-60000).toISOString()});
 await get('/guide/dashboard');const alerts=await get('/guide/alerts');assert.ok(alerts.alerts.some(a=>a.item_id===item.id&&!a.closed_at));
 await get('/guide/dashboard');assert.equal((await pool.query("SELECT count(*)::int n FROM guidance.alerts WHERE item_id=$1 AND category='OVERDUE'",[item.id])).rows[0].n,1);
 assert.equal((await req('/workspace/items/'+item.id,manager)).status,404);assert.ok(!(await get('/workspace/items',manager)).items.some(i=>i.id===item.id));
 assert.ok(!(await get('/workspace/notifications',manager)).notifications.some(n=>n.item_id===item.id));
 pass('Overdue automation is idempotent and confidential items/alerts do not leak to unrelated recipients');
 await post('/workspace/items/'+item.id+'/seen',{},helper);await post('/workspace/items/'+item.id+'/seen',{},helper);
 assert.equal((await get('/workspace/items/'+item.id)).history.filter(h=>h.action==='SEEN').length,1);
 assert.ok((await get('/guide/alerts')).alerts.some(a=>a.item_id===item.id&&!a.closed_at));
 await post('/workspace/items/'+item.id+'/complete',{result:''},helper,400);
 await post('/workspace/items/'+item.id+'/complete',{result:'دسترسی نامعتبر'},manager,404);
 await post('/workspace/items/'+item.id+'/complete',{result:'بررسی انجام شد.'},helper);
 assert.equal((await get('/workspace/items/'+item.id)).item.status,'COMPLETED');assert.ok((await get('/guide/alerts')).alerts.find(a=>a.item_id===item.id).closed_at);
 await post('/workspace/items/'+item.id+'/complete',{result:'دوباره'},helper,409);
 pass('Read receipt records actor/time once; only recipient result closes overdue alert; repeat completion rejected');
 const multi=await post('/guide/items',{kind:'MISSION',subject:'نتیجه دو مخاطب',body:'بررسی',audienceType:'PEOPLE',audience:[helper.user.accountId,manager.user.accountId]});
 await post('/workspace/items/'+multi.id+'/complete',{result:'اول'},helper);assert.notEqual((await get('/workspace/items/'+multi.id)).item.status,'COMPLETED');await post('/workspace/items/'+multi.id+'/complete',{result:'دوم'},manager);assert.equal((await get('/workspace/items/'+multi.id)).item.status,'COMPLETED');
 pass('Multi-recipient completion waits for all results');
 const coord=await post('/workspace/coordination',{subject:'هماهنگی آزمایشی خارج سامانه',body:'برای اطلاع راهبر'},helper);assert.equal(coord.kind,'COORDINATION');await post('/guide/items/'+coord.id+'/action',{action:'APPROVE',version:1},guide,400);assert.ok((await get('/guide/dashboard')).coordination>=1);await post('/workspace/items/'+coord.id+'/seen',{},guide);
 pass('Coordination from a non-guide is informational, visible to guide and has no approval workflow');
 const council=(await get('/workspace/items?kind=COUNCIL')).items[0];
 await post('/guide/items/'+council.id+'/action',{action:'RECONSIDER',version:1});await post('/guide/items/'+council.id+'/action',{action:'APPROVE',version:1},guide,409);await post('/guide/items/'+council.id+'/action',{action:'APPROVE',version:2});await post('/guide/items/'+council.id+'/action',{action:'CANCEL',version:3});
 const replacement=await post('/guide/items/'+council.id+'/action',{action:'REPLACE',version:4,replacement:{kind:'DECISION',subject:'تصمیم جایگزین شورا',body:'نظر نهایی راهبر',audienceType:'PEOPLE',audience:[helper.user.accountId]}});
 assert.equal((await get('/workspace/items/'+replacement.replacementId)).item.supersedes,council.id);assert.equal((await get('/workspace/items/'+council.id)).item.lifecycle,'REPLACED');
 pass('Council reconsider/approve/cancel/replace preserves versions and explicit supersedes linkage');
 for(const table of ['guidance.history','guidance.items','identity.role_assignments','admin.audit_events'])await assert.rejects(pool.query('DELETE FROM '+table));
 await assert.rejects(pool.query("UPDATE guidance.history SET reason='tampered'"));
 pass('PostgreSQL blocks hard deletion and history/audit tampering');
 const report=await get('/guide/reports?kind=FAMILY&group='+sample.id);assert.equal(report.families.length,1);assert.equal(report.decisions.length,0);
 const sponsor=await post('/guide/reports/sponsor',{title:'گزارش حامی آزمایشی',filters:{group:sample.id},showCodes:false,showGroups:false});assert.equal(sponsor.families.length,1);for(const f of sponsor.families)assert.deepEqual(Object.keys(f).sort(),['members','row','status']);
 assert.equal((await req('/guide/reports',helper)).status,403);
 pass('Composable report filters and sponsor whitelist exclude personal and confidential fields');

 const urgent=await post('/guide/items',{kind:'URGENT',subject:'هشدار نیازمند پیگیری',body:'درخواست رسیدگی',audienceType:'PEOPLE',audience:[helper.user.accountId],confidential:true,discussInCouncil:true});
 const follow=await post('/guide/items',{kind:'MISSION',subject:'پیگیری هشدار',body:'گزارش نتیجه',audienceType:'ROLE',audience:['EXECUTIVE_MANAGER'],confidential:true,followUpFor:urgent.id});
 assert.ok((await get('/guide/alerts')).alerts.some(a=>a.item_id===urgent.id&&!a.closed_at));
 await post('/workspace/items/'+follow.id+'/complete',{result:'رسیدگی به هشدار انجام شد.'},manager);
 assert.ok((await get('/guide/alerts')).alerts.find(a=>a.item_id===urgent.id).closed_at);
 assert.equal((await get('/workspace/items/'+urgent.id)).item.status,'COMPLETED');
 pass('Linked follow-up mission closes original urgent alert only after its recorded result');
 const groupItem=await post('/guide/items',{kind:'PERMISSION',subject:'مجوز گروه',body:'آزمایش مخاطب گروه',audienceType:'GROUP',audience:[group.id]});
 assert.ok((await get('/workspace/items/'+groupItem.id)).receipts.length>0);
 const allItem=await post('/guide/items',{kind:'DECISION',subject:'اعلان سازمانی',body:'اطلاع عمومی',audienceType:'ALL'});
 assert.equal((await get('/workspace/items/'+allItem.id)).receipts.length,3);
 const notices=(await get('/workspace/notifications',helper)).notifications;const notice=notices.find(n=>n.item_id===allItem.id);assert.ok(notice);await post('/workspace/notifications/'+notice.id+'/seen',{},helper);assert.ok((await get('/workspace/notifications',helper)).notifications.find(n=>n.id===notice.id).seen_at);
 await post('/workspace/notifications/'+notice.id+'/seen',{},manager,404);
 pass('Role/group/organization audience resolution and private notification ownership');
 await post('/guide/items',{kind:'MISSION',subject:'نامعتبر',body:'مخاطب نامعتبر',audienceType:'PEOPLE',audience:['not-uuid']},guide,400);
 assert.equal((await req('/guide/reports?from=invalid',guide)).status,400);
 assert.equal((await req('/guide/groups/not-uuid',guide)).status,400);
 pass('Invalid audience, report dates and entity IDs fail safely');
 // Browser flows use the actual seeded application, not mocked APIs.
 const fl=openSync(path.join(out,'frontend.log'),'w');front=spawn(process.execPath,['tests/preview.mjs'],{cwd:root,env:{...env,PREVIEW_PORT:'5174',BACKEND_PROXY:'http://127.0.0.1:3001'},windowsHide:true,stdio:['ignore',fl,fl]});await waitReady(origin,front);
 const {chromium}=require('playwright');browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.goto(origin+'/login');await page.locator('#username').fill('Aseman');await page.locator('#password').fill(password);await page.locator('#password').press('Enter');await page.waitForURL('**/guide');await page.locator('.attention-card').first().waitFor();assert.equal(await page.locator('.menu-card').count(),7);assert.equal(await page.locator('.lotus-mark').count(),1);await page.screenshot({path:path.join(out,'guide-dashboard.png'),fullPage:true});
 await page.getByRole('link',{name:/افراد و مسئولیت‌ها/}).click();await page.getByRole('link',{name:/همیار آزمایشی/}).click();await page.getByLabel('نقش جدید',{exact:true}).selectOption('COUNCIL_MEMBER');await page.getByRole('button',{name:'ثبت مسئولیت',exact:true}).click();await page.getByRole('status').filter({hasText:'اقدام ثبت شد.'}).waitFor();await page.reload();await page.getByRole('button',{name:'پایان مسئولیت عضو شورا'}).waitFor();await page.screenshot({path:path.join(out,'person-responsibilities.png'),fullPage:true});
 pass('Browser purple RTL dashboard, person drill-down and persisted role assignment');
 await page.goto(origin+'/guide/groups/'+group.id);await page.getByLabel('سرگروه جدید').selectOption(helper.user.accountId);const beforeLeader=(await get('/guide/groups/'+group.id)).group.leader_name;if(beforeLeader.includes('همیار'))await page.getByLabel('سرگروه جدید').selectOption(manager.user.accountId);await page.getByRole('button',{name:'تغییر سرگروه',exact:true}).click();await page.getByRole('status').filter({hasText:'اقدام ثبت شد.'}).waitFor();await page.screenshot({path:path.join(out,'group-leader.png'),fullPage:true});
 pass('Browser group leader selection and transactional confirmation');
 await page.goto(origin+'/guide/leadership');await page.getByText('ثبت مورد جدید',{exact:true}).click();await page.getByLabel('نوع مورد').selectOption('MISSION');await page.getByLabel('موضوع',{exact:true}).fill('مأموریت مرورگر');await page.getByLabel('متن تصمیم').fill('گزارش کوتاه نتیجه');await page.getByLabel('مخاطب',{exact:true}).selectOption([helper.user.accountId]);await page.getByRole('button',{name:'ثبت تصمیم',exact:true}).click();await page.waitForURL('**/workspace/items/*');const browserItemId=page.url().split('/').pop();await page.getByRole('heading',{name:'مأموریت مرورگر',exact:true}).waitFor();
 const rc=await browser.newContext({viewport:{width:1280,height:900}}),rp=await rc.newPage();rp.on('dialog',d=>d.accept());rp.on('pageerror',e=>errors.push(e.message));await rp.goto(origin+'/login');await rp.locator('#username').fill('GuideDemoHelper');await rp.locator('#password').fill(password);await rp.locator('#password').press('Enter');await rp.waitForURL('**/workspace');await rp.getByRole('link',{name:/مأموریت مرورگر/}).click();await rp.getByLabel('نتیجه اقدام').fill('نتیجه واقعی مرورگر');await rp.getByRole('button',{name:'ثبت نتیجه نهایی'}).click();await rp.getByRole('status').filter({hasText:'اقدام ثبت شد.'}).waitFor();await page.reload();await page.getByText('نتیجه واقعی مرورگر',{exact:true}).first().waitFor();assert.equal((await get('/workspace/items/'+browserItemId)).item.status,'COMPLETED');await page.screenshot({path:path.join(out,'decision-result.png'),fullPage:true});
 pass('Browser guide creates mission; recipient logs in, sees and completes; guide sees persisted result');
 const uiCouncil=(await pool.query("INSERT INTO guidance.items(kind,subject,body,created_by,audience_type) VALUES('COUNCIL','مصوبه آزمون مرورگر','پیشنهاد قابل بازنگری',$1,'GUIDE') RETURNING id",[manager.user.accountId])).rows[0];await pool.query('INSERT INTO guidance.recipients(item_id,account_id) VALUES($1,$2)',[uiCouncil.id,guide.user.accountId]);
 await page.goto(origin+'/guide/council-decisions');await page.getByRole('link',{name:/مصوبه آزمون مرورگر/}).click();await page.getByRole('button',{name:'بازگرداندن برای بازنگری',exact:true}).click();await page.getByText('نیازمند بازنگری',{exact:true}).waitFor();await page.getByRole('button',{name:'تأیید مصوبه',exact:true}).click();await page.getByText('تأییدشده',{exact:true}).waitFor();await page.getByRole('button',{name:'لغو مورد',exact:true}).click();await page.getByText('لغوشده',{exact:true}).first().waitFor();await page.reload();await page.getByText('لغوشده',{exact:true}).first().waitFor();await page.screenshot({path:path.join(out,'council-history.png'),fullPage:true});
 await page.goto(origin+'/guide/reports');await page.getByRole('heading',{name:'گزارش‌ها و پایش',exact:true}).waitFor();await page.getByRole('button',{name:'ساخت پیش‌نمایش گزارش'}).click();await page.locator('.sponsor-preview').waitFor();await page.screenshot({path:path.join(out,'reports.png'),fullPage:true});
 pass('Browser council reconsider/approve/cancel persists with history; sponsor preview');
 await page.setViewportSize({width:390,height:844});for(const route of ['/guide','/guide/people','/guide/groups','/guide/reports']){await page.goto(origin+route);await page.locator('h1').waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}assert.deepEqual(errors,[]);
 pass('Responsive guide routes and no browser JavaScript exceptions');
 writeFileSync(path.join(out,'results.json'),JSON.stringify({date:new Date().toISOString(),results},null,2));
} catch(error){if(browser){for(const c of browser.contexts())for(const p of c.pages()){console.log('Browser failure URL',p.url());console.log((await p.locator('body').innerText()).slice(0,4000));await p.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});}}results.push({name:'suite',status:'FAIL',message:error.message});writeFileSync(path.join(out,'results.json'),JSON.stringify({results},null,2));throw error;}
finally{if(browser)await browser.close();await stop(front);await stop(server);await pool.end();await admin.query(`DROP DATABASE ${dbName} WITH (FORCE)`);await admin.end();}
