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
process.env.TEST_DATABASE_ADMIN_URL ||= process.env.DATABASE_URL;
const password = randomBytes(32).toString('base64url');
process.env.DEV_SEED_PASSWORD=password;
if (!password || !process.env.TEST_DATABASE_ADMIN_URL) throw new Error('Test PostgreSQL URL and seed password required');
const out = path.join(root, 'test-results/health-screening');
mkdirSync(out, { recursive: true });
const results = [];
const pass = name => { results.push({ name, status: 'PASS' }); console.log('PASS ' + name); };
const dbName = 'lahout_test_health_screening_' + Date.now();
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
 run('.tools/scripts/migrate.js');run('.tools/scripts/seed-dev.js');run('.tools/scripts/seed-guide-dev.js');run('.tools/scripts/seed-roles-dev.js');run('.tools/scripts/seed-livelihood-dev.js');
 const log=openSync(path.join(out,'backend.log'),'w');
 server=spawn(process.execPath,['dist/main.js'],{cwd:backend,env,windowsHide:true,stdio:['ignore',log,log]});
 await waitReady('http://127.0.0.1:3001/api/v1/auth/me',server);
 const post=async(url,body,auth,status=200)=>{const r=await req(url,{...auth,body});assert.equal(r.status,status,JSON.stringify(r.body));return r.body;};
 const get=async(url,auth)=>{const r=await req(url,auth);assert.equal(r.status,200,JSON.stringify(r.body));return r.body;};
 async function login(username,role){const r=await req('/auth/login',{body:{username,password}});assert.equal(r.status,200);const a={cookie:r.cookie,csrf:r.body.csrfToken,user:r.body.user};if(role)await post('/auth/select-role',{roleCode:role},a);return a;}
 const leader=await login('TestV100_Leader1','GROUP_LEADER'),other=await login('TestV100_Leader2','GROUP_LEADER'),helper=await login('TestV100_Helper1_1'),executive=await login('TestV100_Executive','EXECUTIVE_MANAGER'),guide=await login('Aseman');
 const families=(await get('/livelihood/families',leader)).families;
 const family=families.find(f=>['NOT_RECORDED','DRAFT','READY','RETURNED'].includes(f.status));assert.ok(family);
 const url='/health-screening/families/'+family.id;
 let workspace=await get(url,leader),base=await get('/livelihood/families/'+family.id,leader);
 assert.deepEqual(workspace.members.map(m=>m.id),base.members.map(m=>m.id));
 assert.ok(workspace.members.length>=2);assert.equal(workspace.status,'NOT_RECORDED');assert.ok(workspace.members.every(m=>m.screening===null));
 for(const auth of [other,helper,executive,guide])assert.equal((await req(url,auth)).status,403);
 pass('Active members reused; only responsible leader can read screening');

 const member=workspace.members[0],memberUrl=url+'/members/'+member.id;
 const payload={answer:'NO',source:'INTERVIEW',sourceDetail:'',notes:'بررسی آزمایشی',version:0};
 for(const auth of [other,helper,executive,guide])await post(memberUrl,payload,auth,403);
 assert.equal((await req(memberUrl,{body:payload,cookie:leader.cookie})).status,403);
 for(const answer of ['',null,'NOT_RECORDED','INVALID'])await post(memberUrl,{...payload,answer},leader,400);
 await post(memberUrl,{...payload,source:''},leader,400);
 await post(memberUrl,{...payload,source:'OTHER',sourceDetail:' '},leader,400);
 await post(memberUrl,{...payload,created_by:guide.user.accountId},leader,400);
 await post(memberUrl,{...payload,notes:'x'.repeat(2001)},leader,400);
 await post(url+'/members/00000000-0000-4000-8000-000000000099',payload,leader,403);
 assert.equal((await req(memberUrl,{...leader,method:'DELETE'})).status,404);
 pass('Scope, CSRF, three states, required source/Other text, metadata spoofing and deletion rejected');

 let saved=await post(memberUrl,payload,leader);
 assert.equal(saved.created_by,leader.user.accountId);assert.equal(saved.updated_by,leader.user.accountId);
 const first=saved;
 workspace=await get(url,leader);assert.equal(workspace.members[0].screening.answer,'NO');assert.equal(workspace.status,'IN_PROGRESS');
 for(const answer of ['YES','UNKNOWN']){
  saved=await post(memberUrl,{...payload,answer,version:saved.version},leader);
  assert.equal((await get(url,leader)).members[0].screening.answer,answer);
  assert.equal(saved.created_at,first.created_at);assert.equal(saved.created_by,first.created_by);assert.equal(saved.updated_by,leader.user.accountId);
 }
 await post(memberUrl,payload,leader,409);
 const concurrent=await Promise.all([req(memberUrl,{...leader,body:{...payload,version:saved.version}}),req(memberUrl,{...leader,body:{...payload,version:saved.version}})]);
 assert.deepEqual(concurrent.map(r=>r.status).sort(),[200,409]);
 const recorded=(await get(url,leader)).members[0].screening;
 await pool.query('UPDATE family.family_memberships SET valid_to=current_date WHERE family_id=$1 AND person_id=$2',[family.id,member.id]);
 assert.ok(!(await get(url,leader)).members.some(m=>m.id===member.id));
 await post(memberUrl,{...payload,version:recorded.version},leader,403);
 await pool.query('UPDATE family.family_memberships SET valid_to=NULL WHERE family_id=$1 AND person_id=$2',[family.id,member.id]);
 assert.equal((await get(url,leader)).members[0].screening.version,recorded.version);
 pass('Persistence, immutable creator metadata, edit metadata, optimistic concurrency and inactive member protection');

 const count=(await pool.query('SELECT count(*)::int n FROM assessment.health_screenings')).rows[0].n;
 await pool.query("CREATE FUNCTION test_fail_health_history() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='HEALTH_SCREENING_SAVED' THEN RAISE EXCEPTION 'test'; END IF; RETURN NEW; END $$; CREATE TRIGGER test_health_history BEFORE INSERT ON guidance.history FOR EACH ROW EXECUTE FUNCTION test_fail_health_history()");
 await post(url+'/members/'+workspace.members[1].id,payload,leader,500);
 assert.equal((await pool.query('SELECT count(*)::int n FROM assessment.health_screenings')).rows[0].n,count);
 await pool.query('DROP TRIGGER test_health_history ON guidance.history; DROP FUNCTION test_fail_health_history()');
 pass('Screening and audit commit atomically; failed history write rolls back screening');

 // Date fixture changes are confined to this newly created test database.
 base=await get('/livelihood/families/'+family.id,leader);
 base.family.formedOn='2026-09-20';base.members[0].birth_date='1965-05-08';
 await post('/livelihood/families/'+family.id+'/basic',{version:base.family.version,family:base.family,members:base.members},leader);
 const digest=async()=>{const state={};for(const table of ['assessment.domain_reviews','assessment.domain_submissions','assessment.domain_decisions','family.family_memberships'])state[table]=(await pool.query('SELECT md5(string_agg(to_jsonb(t)::text,\'\' ORDER BY id)) hash FROM '+table+' t')).rows[0].hash;return state;};

 const {chromium}=createRequire(path.join(root,'package.json'))('playwright');
 const flog=openSync(path.join(out,'frontend.log'),'w');
 front=spawn(process.execPath,['tests/preview.mjs'],{cwd:root,env:{...env,PREVIEW_PORT:'5174',BACKEND_PROXY:'http://127.0.0.1:3001'},windowsHide:true,stdio:['ignore',flog,flog]});
 await waitReady(origin,front);
 browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 async function expectValue(field,value){await field.waitFor();await page.waitForFunction(({id,value})=>document.getElementById(id)?.value===value,{id:await field.getAttribute('id'),value});assert.equal(await field.inputValue(),value);}
 await page.goto(origin+'/login');await page.locator('#username').fill('TestV100_Leader1');await page.locator('#password').fill(password);await page.locator('#password').press('Enter');await page.waitForURL(u=>u.pathname!=='/login');
 if(new URL(page.url()).pathname==='/select-role'){await page.getByRole('button',{name:/سرگروه/}).click();await page.waitForURL('**/leader');}
 await page.goto(origin+'/workspace/families/'+family.id);
 const basePanel=page.getByRole('region',{name:'اطلاعات جاری پرونده',exact:true});
 const edit=basePanel.getByRole('button',{name:'ویرایش اطلاعات پرونده',exact:true});
 await edit.waitFor();assert.equal(await basePanel.locator('input,select,textarea').count(),0);
 await edit.click();await basePanel.getByText('حالت ویرایش پرونده',{exact:true}).waitFor();
 const formed=page.getByRole('group',{name:'تاریخ تشکیل/انتقال پرونده',exact:true}),birth=page.getByRole('group',{name:'تاریخ تولد عضو ۱',exact:true});
 const dateValues=async field=>Promise.all(['سال','ماه','روز'].map(name=>field.getByRole('combobox',{name,exact:true}).inputValue()));
 const dateSelect=async(field,y,m,d)=>{for(const [name,v]of [['سال',y],['ماه',m],['روز',d]])await field.getByRole('combobox',{name,exact:true}).selectOption(v);};
 assert.deepEqual(await dateValues(formed),['1405','06','29']);assert.deepEqual(await dateValues(birth),['1344','02','18']);
 assert.equal(await page.locator('input[type=date]').count(),0);
 const basicSave=basePanel.getByRole('button',{name:'ذخیره تغییرات',exact:true});
 await dateSelect(formed,'1399','12','30');
 await formed.getByRole('combobox',{name:'سال',exact:true}).selectOption('1400');
 assert.equal(await formed.getByRole('combobox',{name:'روز',exact:true}).locator('option[value="30"]').count(),0);
 assert.equal(await basicSave.isDisabled(),true);
 await formed.getByRole('button',{name:'پاک کردن تاریخ',exact:true}).click();assert.equal(await basicSave.isDisabled(),false);
 await dateSelect(formed,'1405','07','04');await dateSelect(birth,'1344','02','19');
 await basePanel.getByRole('button',{name:'انصراف از ویرایش',exact:true}).click();
 assert.equal(await basePanel.locator('select').count(),0);assert.ok((await basePanel.innerText()).includes('۱۳۴۴/۰۲/۱۸'));
 await edit.click();await dateSelect(formed,'1405','07','04');await dateSelect(birth,'1344','02','19');
 await Promise.all([page.waitForResponse(r=>r.url().endsWith('/family-workspace/families/'+family.id)&&r.request().method()==='POST'&&r.status()===200),basicSave.click()]);
 await edit.waitFor();assert.equal(await basePanel.locator('input,select,textarea').count(),0);
 assert.ok((await basePanel.innerText()).includes('۱۳۴۴/۰۲/۱۹'),await basePanel.innerText());
 await page.reload();await edit.waitFor();assert.ok((await basePanel.innerText()).includes('۱۴۰۵/۰۷/۰۴'));assert.ok((await basePanel.innerText()).includes('۱۳۴۴/۰۲/۱۹'));
 base=await get('/family-workspace/families/'+family.id,leader);assert.equal(base.family.formedOn,'2026-09-26');assert.equal(base.members[0].birth_date,'1965-05-09');
 for(const auth of [helper,executive,guide])await post('/family-workspace/families/'+family.id,{version:base.family.version,family:base.family,members:base.members},auth,403);
 assert.equal((await req('/family-workspace/families/'+family.id,other)).status,403);
 await post('/family-workspace/families/'+family.id,{version:base.family.version,family:base.family,members:base.members.map((m,i)=>i===0?{...m,birth_date:'2025-02-30'}:m)},leader,400);
 pass('Family defaults to read-only; explicit edit/cancel/save; segmented Jalali leap validation, optional clear, current dates after refresh and existing permissions');
 const beforeHealth=await digest();
 const nav=page.getByRole('navigation',{name:'حوزه‌های ارزیابی'});assert.equal(await nav.getByRole('link').count(),2);
 await nav.getByRole('link',{name:'سلامت و درمان',exact:true}).click();
 await page.getByRole('heading',{name:'غربالگری سلامت اعضای خانواده',exact:true}).waitFor();
 assert.equal(await page.locator('tbody tr').count(),base.members.length);
 assert.equal(await page.getByRole('button',{name:/حذف عضو|افزودن عضو/}).count(),0);
 for(let i=0;i<base.members.length;i++){
  const m=base.members[i],panel=page.locator('details[data-member="'+m.id+'"]');
  await panel.locator('summary').click();
  assert.equal(await panel.locator('input[type=radio]').count(),3);
  assert.equal(await panel.getByRole('radio',{name:'ثبت نشده',exact:true}).count(),0);
  await panel.getByRole('radio',{name:i===0?'ندارد':i===1?'دارد':'نامشخص',exact:true}).check();
  if(i===0)assert.equal(await panel.getByText('فرم تخصصی نیازمند تکمیل',{exact:true}).count(),0);
  if(i===1)await panel.getByText('فرم تخصصی نیازمند تکمیل',{exact:true}).waitFor();
  await panel.getByLabel('منبع / مبنای بررسی',{exact:true}).selectOption(i===0?'OTHER':'INTERVIEW');
  if(i===0){assert.equal(await panel.getByRole('button',{name:'ذخیره غربالگری',exact:true}).isDisabled(),true);await panel.getByLabel('توضیح مبنای سایر').fill('بررسی آزمایشی مستند');}
  await panel.getByLabel('توضیح غربالگری (اختیاری)').fill('غربالگری مرورگر');
  await Promise.all([page.waitForResponse(r=>r.url().endsWith('/members/'+m.id)&&r.status()===200),panel.getByRole('button',{name:'ذخیره غربالگری',exact:true}).click()]);
  await panel.getByText('ثبت‌کننده:',{exact:false}).waitFor();
  const metadata=await panel.locator('.workflow-facts').innerText();assert.match(metadata,/[۰-۹]{4}\/[۰-۹]{2}\/[۰-۹]{2}/);assert.doesNotMatch(metadata,/[0-9]{4}-[0-9]{2}/);
 }
 await page.reload();await page.getByRole('heading',{name:'غربالگری سلامت اعضای خانواده',exact:true}).waitFor();
 assert.ok((await page.locator('tbody tr').first().innerText()).includes('ندارد'));
 assert.ok((await page.locator('tbody tr').nth(1).innerText()).includes('فرم تخصصی نیازمند تکمیل'));
 workspace=await get(url,leader);assert.ok(workspace.members.every(m=>m.screening.notes==='غربالگری مرورگر'));
 assert.deepEqual(await digest(),beforeHealth);
 await nav.getByRole('link',{name:'معیشت و اقتصاد',exact:true}).click();
 await page.getByRole('button',{name:'معیشت و اقتصاد',exact:true}).click();await page.getByRole('heading',{name:'جمع‌بندی چهار شاخص معیشت',exact:true}).waitFor();
 assert.equal(await page.locator('input[type=date]').count(),0);assert.equal(await page.locator('.role-shell').getAttribute('dir'),'rtl');assert.deepEqual(errors,[]);
 pass('Real browser leader login: Jalali display/edit/validation/persistence; all members screening, source, metadata, refresh, RTL and livelihood return; no livelihood data changes');
} catch(e){results.push({name:'suite',status:'FAIL',message:e.message});throw e;}
finally{await browser?.close();await stop(front);await stop(server);await pool.end();await dropTestDatabase(admin,dbName);await admin.end();writeFileSync(path.join(out,'results.json'),JSON.stringify({results},null,2));}
