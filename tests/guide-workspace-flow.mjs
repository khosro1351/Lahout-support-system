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
 const seedGroups=(await pool.query('SELECT id,group_number FROM organization.groups ORDER BY group_number')).rows;
 assert.deepEqual(seedGroups.map(g=>Number(g.group_number)),[1,2,3]);
 assert.equal((await pool.query('SELECT count(*)::int n FROM family.families')).rows[0].n,9);
 assert.equal((await pool.query("SELECT count(*)::int n FROM identity.role_assignments WHERE role_code='HELPER' AND scope_type='GROUP' AND valid_to IS NULL")).rows[0].n,6);
 run('.tools/scripts/seed-guide-dev.js',{APP_ENV:'production'},1);
 pass('Six migrations; repeatable development seed: 3 groups, 6 scoped helpers, 9 families; production seed refused');
 const backendLog=openSync(path.join(out,'backend.log'),'w');server=spawn(process.execPath,['dist/main.js'],{cwd:backend,env,windowsHide:true,stdio:['ignore',backendLog,backendLog]});await waitReady('http://127.0.0.1:3001/api/v1/auth/me',server);
 async function login(username){const r=await req('/auth/login',{body:{username,password}});assert.equal(r.status,200,JSON.stringify(r.body));return {cookie:r.cookie,csrf:r.body.csrfToken,user:r.body.user,redirect:r.body.redirectTo};}
 const guide=await login('Aseman'),helper=await login('ReviewHelper11'),manager=await login('ReviewLeader2');
 const get=async(url,auth=guide)=>{const r=await req(url,auth);assert.equal(r.status,200,JSON.stringify(r.body));return r.body;};
 const post=async(url,body,auth=guide,expected=200)=>{const r=await req(url,{...auth,body});assert.equal(r.status,expected,JSON.stringify(r.body));return r.body;};
 assert.equal(guide.redirect,'/guide');assert.equal(helper.redirect,'/workspace');assert.equal((await req('/review/people',helper)).status,403);assert.equal((await req('/review/people')).status,401);
 pass('Existing sessions and role-aware routing; unauthenticated and non-guide access denied');
 const people=(await get('/review/people')).people,hp=people.find(p=>p.account_id===helper.user.accountId);
 assert.ok(hp);assert.ok(!people.some(p=>p.account_id===guide.user.accountId));assert.equal((await get('/review/people?role=COUNCIL_MEMBER')).people.length,3);
 assert.ok(!(await get('/guide/metadata')).roles.some(r=>r.code==='SUPREME_GUIDE'));
 await post('/guide/people/'+hp.id+'/assign',{role:'SUPREME_GUIDE'},guide,400);
 await post('/guide/people/'+hp.id+'/assign',{role:'HELPER'},guide,400);
 const newRole=await post('/guide/people/'+hp.id+'/assign',{role:'COUNCIL_MEMBER'});
 assert.ok((await get('/auth/me',helper)).user.roles.some(r=>r.roleCode==='COUNCIL_MEMBER'));
 await post('/guide/people/'+hp.id+'/end-role',{assignmentId:newRole.id});
 pass('Multi-role filtering; guide excluded; helper scope required; role changes immediately affect sessions');
 const [g1,g2,g3]=seedGroups.map(g=>g.id),fam=(await get('/cases/groups/'+g1)).families[0];
 assert.equal((await get('/cases/groups',helper)).groups.length,1);assert.equal((await req('/cases/groups/'+g2,helper)).status,403);
 const detail=await get('/cases/families/'+fam.family_id,helper);assert.equal(detail.members.length,3);assert.equal(detail.research.length,2);assert.ok(detail.documents.length);assert.ok(Object.keys(detail.family.domains).length>=5);
 pass('Shared scoped group/family workspace exposes persisted members, research, domains and documents');
 const permission=await post('/verification/requests',{personId:hp.id,subject:'آزمون مجوز',explanation:'Development/Test بررسی موردی'},manager);
 await post('/verification/requests',{personId:hp.id,subject:'مورد',explanation:'توضیح'},guide,403);
 await post('/verification/requests/'+permission.id+'/decision',{decision:'APPROVED'},manager,403);
 await post('/verification/requests/'+permission.id+'/seen',{});
 assert.equal((await get('/verification/requests/'+permission.id)).request.status,'SEEN');assert.equal((await get('/review/dashboard')).permissions,1);
 const race=await Promise.all(['APPROVED','NOT_APPROVED'].map(decision=>req('/verification/requests/'+permission.id+'/decision',{...guide,body:{decision}})));assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);
 await assert.rejects(pool.query("UPDATE guidance.permission_checks SET decision='APPROVED' WHERE id=$1",[permission.id]));
 assert.equal((await get('/review/dashboard')).permissions,0);assert.ok((await get('/workspace/notifications',manager)).notifications.some(n=>n.link_id===permission.id));
 pass('Executive-only permission request; SEEN stays pending; one final decision; immutable history and immediate executive notification');
 const p2=await post('/verification/requests',{personId:hp.id,subject:'رد موردی',explanation:'آزمایش'},manager);await post('/verification/requests/'+p2.id+'/decision',{decision:'NOT_APPROVED'});assert.equal((await get('/verification/requests/'+p2.id,manager)).request.decision,'NOT_APPROVED');
 const council=(await get('/review/council')).items[0],c0=(await get('/review/council/'+council.id)).item;
 await post('/review/council/'+council.id+'/intervention',{action:'APPROVE',version:c0.version},guide,400);
 const stopped=await post('/review/council/'+council.id+'/intervention',{action:'STOP',version:c0.version});assert.equal(stopped.execution_status,'STOPPED');
 const reviewed=await post('/review/council/'+council.id+'/intervention',{action:'REVIEW',version:stopped.version});assert.equal(reviewed.body,c0.body);assert.equal(reviewed.review_state,'RECONSIDER');
 await post('/guide/items',{kind:'MISSION'},guide,410);await post('/guide/items/'+council.id+'/action',{action:'CANCEL'},guide,410);
 pass('Council only stop/review with preserved text and history; retired command APIs cannot bypass restrictions');
 const note=await post('/cases/notes',{familyId:fam.family_id,type:'ALERT',subject:'هشدار تست',body:'اقدام لازم'},helper);
 let alert=(await get('/cases/alerts?family='+fam.family_id)).alerts.find(a=>a.item_id===note.id);assert.ok(alert);
 await post('/workspace/items/'+note.id+'/seen',{});assert.ok(!(await get('/cases/alerts?family='+fam.family_id)).alerts.find(a=>a.id===alert.id).closed_at);
 await post('/cases/alerts/'+alert.id+'/resolve',{actionCompleted:false,result:'نتیجه'},helper,400);await post('/cases/alerts/'+alert.id+'/resolve',{actionCompleted:true,result:''},helper,400);
 await post('/cases/alerts/'+alert.id+'/resolve',{actionCompleted:true,result:'اقدام آزمایشی انجام شد'},helper);await post('/cases/alerts/'+alert.id+'/resolve',{actionCompleted:true,result:'دوباره'},helper,409);
 pass('Contextual alerts: seen is not resolved; completed action and result required; repeated resolution blocked');
 await post('/cases/families/'+fam.family_id+'/transfer',{sourceGroupId:g1,targetGroupId:g2},helper,403);
 await post('/cases/families/'+fam.family_id+'/transfer',{sourceGroupId:g1,targetGroupId:g2});assert.equal((await req('/cases/families/'+fam.family_id,helper)).status,403);
 await post('/cases/notes',{familyId:fam.family_id,type:'MESSAGE',subject:'غیرمجاز',body:'آزمایش'},helper,403);
 assert.ok((await get('/cases/families/'+fam.family_id)).history.some(h=>h.action==='FAMILY_TRANSFERRED'));
 await post('/cases/families/'+fam.family_id+'/transfer',{sourceGroupId:g1,targetGroupId:g3},guide,409);
 pass('Atomic family transfer changes scope immediately, preserves history and rejects stale source');
 await post('/review/groups/'+g1+'/deactivate',{moves:[]},guide,409);
 const remaining=(await get('/cases/groups/'+g1)).families;
 await post('/review/groups/'+g1+'/deactivate',{moves:remaining.map((f,i)=>({familyId:f.family_id,targetGroupId:i%2?g2:g3}))});
 assert.equal((await pool.query('SELECT status FROM organization.groups WHERE id=$1',[g1])).rows[0].status,'INACTIVE');
 await post('/review/groups/'+g1+'/reactivate',{accountId:helper.user.accountId});assert.equal((await get('/cases/groups/'+g1)).group.status,'ACTIVE');
 pass('Transfer-all requires exact family set, supports multiple destinations, deactivates and reactivates atomically');
 for(const dataset of ['families','supports','stipends','distribution','groups','performance'])assert.ok((await get('/monitoring/data/'+dataset)).rows.length);
 const report=await get('/monitoring/data/families?group='+g2);assert.ok(report.rows.every(r=>r.group_id===g2));
 const catalog=await get('/monitoring/catalog/families');assert.ok(catalog.fields.some(f=>f.key==='national_id'));assert.ok(catalog.fields.some(f=>f.key==='domains'));
 await post('/monitoring/export',{dataset:'families',title:'تست',format:'preview',fields:[],filters:{}},guide,400);
 await post('/monitoring/export',{dataset:'families',title:'تست',format:'preview',fields:['password_hash'],filters:{}},guide,400);
 assert.equal((await req('/monitoring/data/performance?sort=visits',guide)).status,400);assert.equal((await req('/monitoring/data/families',helper)).status,403);
 const exp={dataset:'families',title:'گزارش آزمایشی <script>alert(1)</script>',fields:catalog.fields.map(f=>f.key),filters:{},orientation:'landscape'};
 const preview=await post('/monitoring/export',{...exp,format:'preview'});assert.ok(preview.html.includes('&lt;script&gt;'));assert.equal(preview.rows.length,9);
 for(const format of ['pdf','xlsx']){const r=await fetch('http://127.0.0.1:3001/api/v1/monitoring/export',{method:'POST',headers:{origin,'content-type':'application/json',cookie:guide.cookie,'x-csrf-token':guide.csrf},body:JSON.stringify({...exp,format})});assert.equal(r.status,200,await (r.status!==200?r.text():Promise.resolve('')));const bytes=Buffer.from(await r.arrayBuffer());assert.ok(bytes.length>1000);assert.equal(bytes.subarray(0,format==='pdf'?4:2).toString(),format==='pdf'?'%PDF':'PK');writeFileSync(path.join(out,'report.'+format),bytes);}
 pass('Real report views, filters, conscious complete business-field selection, safe HTML, actual PDF and XLSX exports');
 await assert.rejects(pool.query('DELETE FROM guidance.history'));assert.ok((await pool.query("SELECT count(*)::int n FROM guidance.history WHERE action='PERMISSION_DECIDED'")).rows[0].n>=2);
 pass('PostgreSQL rejects history deletion; permission, council, transfer and report audit persist');
 const fl=openSync(path.join(out,'frontend.log'),'w');front=spawn(process.execPath,['tests/preview.mjs'],{cwd:root,env:{...env,PREVIEW_PORT:'5174',BACKEND_PROXY:'http://127.0.0.1:3001'},windowsHide:true,stdio:['ignore',fl,fl]});await waitReady(origin,front);
 const {chromium}=require('playwright');browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.goto(origin+'/login');await page.locator('#username').fill('Aseman');await page.locator('#password').fill(password);await page.locator('#password').press('Enter');await page.waitForURL('**/guide');await page.locator('.menu-card').first().waitFor();assert.equal(await page.locator('.menu-card').count(),6);assert.equal(await page.locator('.lotus-mark').count(),1);await page.waitForFunction(()=>[...document.querySelectorAll('.attention-card strong')].every(e=>e.textContent!=='…'));await page.screenshot({path:path.join(out,'guide-dashboard.png'),fullPage:true});
 await page.goto(origin+'/guide/people/'+hp.id);await page.getByRole('heading',{name:/مسئولیت/}).first().waitFor();assert.equal(await page.getByLabel('نقش جدید',{exact:true}).inputValue(),'');await page.screenshot({path:path.join(out,'person-responsibilities.png'),fullPage:true});
 await page.goto(origin+'/guide/groups/'+g2);await page.locator('tbody tr').first().waitFor();await page.locator('tbody tr').first().hover();assert.equal(await page.locator('tr[aria-selected=true]').count(),0);await page.locator('tbody tr').first().click();assert.equal(await page.locator('tr[aria-selected=true]').count(),1);await page.locator('tbody tr').nth(1).hover();assert.equal(await page.locator('tr[aria-selected=true]').count(),1);await page.screenshot({path:path.join(out,'group-families.png'),fullPage:true});
 pass('Browser RTL purple lotus dashboard, person no-default role and persistent click-only family selection');
 await page.getByRole('button',{name:'انتقال به گروه دیگر',exact:true}).click();await page.getByRole('dialog').waitFor();await page.getByLabel('گروه مقصد',{exact:true}).selectOption(g3);await page.getByRole('button',{name:'تأیید انتقال',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});assert.equal(await page.locator('tr[aria-selected=true]').count(),0);
 pass('Browser family transfer uses one modal, persists and clears completed selection');
 const executiveContext=await browser.newContext(),executivePage=await executiveContext.newPage();executivePage.on('dialog',d=>d.accept());executivePage.on('pageerror',e=>errors.push(e.message));await executivePage.goto(origin+'/login');await executivePage.locator('#username').fill('ReviewLeader2');await executivePage.locator('#password').fill(password);await executivePage.locator('#password').press('Enter');await executivePage.waitForURL('**/workspace');await executivePage.goto(origin+'/executive/permissions');await executivePage.getByText('ارسال مورد برای راهبر',{exact:true}).click();await executivePage.getByLabel('شخص',{exact:true}).selectOption(hp.id);await executivePage.getByLabel('موضوع',{exact:true}).fill('استعلام ثبت‌شده در مرورگر');await executivePage.getByLabel('توضیح مدیر اجرایی',{exact:true}).fill('آزمون ارسال واقعی مدیر اجرایی');await executivePage.getByRole('button',{name:'ارسال برای راهبر',exact:true}).click();await executivePage.waitForURL('**/executive/permissions/*');const executiveId=executivePage.url().split('/').pop();await page.goto(origin+'/guide/permissions/'+executiveId);await page.getByRole('button',{name:'عدم تأیید',exact:true}).click();await executivePage.getByTestId('permission-status').filter({hasText:'عدم تأیید'}).waitFor();
 pass('Two browser sessions: executive submits, guide rejects, executive result updates automatically');
 const bp=await post('/verification/requests',{personId:hp.id,subject:'مجوز مرورگر',explanation:'آزمایش واقعی رابط'},manager);
 await page.goto(origin+'/guide/permissions/'+bp.id);await page.getByRole('button',{name:'تأیید',exact:true}).click();await page.getByTestId('permission-status').filter({hasText:'تأیید'}).waitFor();await page.reload();await page.getByTestId('permission-status').filter({hasText:'تأیید'}).waitFor();assert.equal(await page.getByRole('button',{name:'تأیید',exact:true}).count(),0);await page.screenshot({path:path.join(out,'permission-decision.png'),fullPage:true});
 await page.goto(origin+'/guide/council-decisions/'+council.id);await page.getByRole('button',{name:'توقف اجرا',exact:true}).click();await page.getByTestId('council-state').filter({hasText:'توقف اجرا'}).waitFor();await page.screenshot({path:path.join(out,'council-history.png'),fullPage:true});
 pass('Browser permission decision persists after refresh; council stop action and history render');
 await page.goto(origin+'/guide/reports');await page.getByRole('button',{name:'انتخاب همه',exact:true}).click();await page.getByRole('button',{name:'پیش‌نمایش A4',exact:true}).click();await page.locator('iframe').waitFor();assert.ok(await page.frameLocator('iframe').locator('table').count());await page.screenshot({path:path.join(out,'reports.png'),fullPage:true});
 for(const route of ['/guide/access-requests','/guide/alerts','/guide/families/'+fam.family_id]){await page.goto(origin+route);await page.locator('h1').waitFor();await page.screenshot({path:path.join(out,route.includes('access')?'access-requests.png':route.includes('alerts')?'alerts.png':'family-case.png'),fullPage:true});}
 await page.setViewportSize({width:390,height:844});for(const route of ['/guide','/guide/groups','/guide/reports']){await page.goto(origin+route);await page.locator('h1').waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}assert.deepEqual(errors,[]);
 pass('Browser real report preview, family/alerts/access pages, responsive layouts and no JavaScript exceptions');
 writeFileSync(path.join(out,'results.json'),JSON.stringify({date:new Date().toISOString(),results},null,2));
} catch(error){if(browser){for(const c of browser.contexts())for(const p of c.pages()){console.log('Browser failure URL',p.url());console.log((await p.locator('body').innerText()).slice(0,4000));await p.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});}}results.push({name:'suite',status:'FAIL',message:error.message});writeFileSync(path.join(out,'results.json'),JSON.stringify({results},null,2));throw error;}
finally{if(browser)await browser.close();await stop(front);await stop(server);await pool.end();await admin.query(`DROP DATABASE ${dbName} WITH (FORCE)`);await admin.end();}
