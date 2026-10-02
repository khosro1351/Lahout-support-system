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
const out = path.join(root, 'test-results/health-import');
mkdirSync(out, { recursive: true });
const results = [];
const pass = name => { results.push({ name, status: 'PASS' }); console.log('PASS ' + name); };
const dbName = 'lahout_test_health_import_' + Date.now();
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
 for(const name of ['migrate','seed-dev','seed-guide-dev','seed-roles-dev','seed-livelihood-dev'])run('.tools/scripts/'+name+'.js');
 const log=openSync(path.join(out,'backend.log'),'w');
 server=spawn(process.execPath,['dist/main.js'],{cwd:backend,env,windowsHide:true,stdio:['ignore',log,log]});
 await waitReady('http://127.0.0.1:3001/api/v1/auth/me',server);
 const post=async(url,body,auth,status=200)=>{const r=await req(url,{...auth,body});assert.equal(r.status,status,url+': '+JSON.stringify(r.body));return r.body;};
 const get=async(url,auth)=>{const r=await req(url,auth);assert.equal(r.status,200,url+': '+JSON.stringify(r.body));return r.body;};
 async function login(username,role){const r=await req('/auth/login',{body:{username,password}});assert.equal(r.status,200);const a={cookie:r.cookie,csrf:r.body.csrfToken,user:r.body.user};if(role)await post('/auth/select-role',{roleCode:role},a);return a;}
 const leader=await login('TestV100_Leader1','GROUP_LEADER'),other=await login('TestV100_Leader2','GROUP_LEADER'),helper=await login('TestV100_Helper1_1'),executive=await login('TestV100_Executive','EXECUTIVE_MANAGER'),guide=await login('Aseman');
 const digest=async()=>JSON.stringify((await pool.query('SELECT * FROM assessment.domain_submissions ORDER BY id')).rows);
 const oldLivelihood=await digest();
 const family=(await get('/livelihood/families',leader)).families[0],url='/health-assessment/families/'+family.id,screen='/health-screening/families/'+family.id;
 let w=await get(url,leader);
 for(const auth of [other,helper])assert.equal((await req(url,auth)).status,403);
 assert.equal(w.canEdit,false);assert.equal(w.canDecide,false);
 await post(url+'/draft',{},leader,409);await post(url+'/submit',{version:1},leader,409);
 await post(screen+'/members/'+w.members[0].id,{answer:'NO',source:'INTERVIEW',notes:'',version:0},leader,409);
 assert.equal(await digest(),oldLivelihood);
 pass('Historical health read permissions retained; old screening, draft and submit are read-only without changing historical livelihood');

 const ExcelJS=require('exceljs');
 const binary=await fetch('http://127.0.0.1:3001/api/v1/family-import/template',{headers:{cookie:leader.cookie}});assert.equal(binary.status,200);
 const templateBytes=Buffer.from(await binary.arrayBuffer());const wb=new ExcelJS.Workbook();await wb.xlsx.load(templateBytes);assert.equal(wb.worksheets.length,1);assert.equal(wb.worksheets[0].columnCount,6);
 const headers=wb.worksheets[0].getRow(1).values.slice(1);
 async function file(rows){const book=new ExcelJS.Workbook(),sheet=book.addWorksheet('خانواده‌ها');sheet.addRow(headers);for(const row of rows)sheet.addRow(row);return Buffer.from(await book.xlsx.writeBuffer());}
 const dash=await get('/family-import',leader),group=dash.groups[0].id;
 async function upload(rows,auth=leader,g=group){return post('/family-import/groups/'+g+'/upload',{filename:'test.xlsx',content:(await file(rows)).toString('base64')},auth);}
 const batchUrl=id=>'/family-import/batches/'+id;
 const spoof=new ExcelJS.Workbook();const spoofSheet=spoof.addWorksheet('خانواده‌ها');spoofSheet.addRow([...headers,'گروه']);spoofSheet.addRow(['نام','خانوادگی','','','','','گروه دیگر']);
 const bad=await post('/family-import/groups/'+group+'/upload',{filename:'spoof.xlsx',content:Buffer.from(await spoof.xlsx.writeBuffer()).toString('base64')},leader);
 assert.equal((await get(batchUrl(bad.id),leader)).batch.state,'INVALID');
 await post('/family-import/groups/'+group+'/upload',{filename:'test.xlsx',content:templateBytes.toString('base64'),groupId:'foreign'},leader,400);
 assert.equal((await req('/family-import/groups/'+group+'/upload',{cookie:leader.cookie,body:{filename:'test.xlsx',content:templateBytes.toString('base64')}})).status,403);
 pass('Group cannot be supplied by workbook or body; upload requires CSRF');
 for(const auth of [helper])assert.equal((await req('/family-import',auth)).status,403);
 await post('/family-import/groups/'+group+'/upload',{filename:'test.xlsx',content:templateBytes.toString('base64')},other,403);
 await post('/family-import/groups/'+group+'/upload',{filename:'test.xlsx',content:templateBytes.toString('base64')},executive,403);
 const batch=await upload([
  ['واردشده','معتبر','1234567890','09120000001','مرد','1400/01/01'],
  ['تاریخ','نامعتبر','','','','1400/12/30'],['','بدون نام'],
  ['تکرار','اول','2345678901'],['تکرار','دوم','2345678901'],
  ['مشکوک','همنام','','09120000002'],['مشکوک','همنام','','09120000002'],[],[{formula:'1+1'},'فرمول']
 ]);
 let preview=await get(batchUrl(batch.id),leader);
 assert.equal(preview.summary.total,9);assert.equal(preview.summary.valid,1);assert.equal(preview.summary.failed,3);assert.equal(preview.summary.duplicate,2);assert.equal(preview.summary.suspect,2);
 const valid=preview.rows.find(r=>r.classification==='VALID'),suspect=preview.rows.find(r=>r.classification==='SUSPECT'),duplicate=preview.rows.find(r=>r.classification==='DUPLICATE');
 await post(batchUrl(batch.id)+'/confirm',{version:preview.batch.version,rowIds:[suspect.id]},leader,409);
 await post(batchUrl(batch.id)+'/rows/'+duplicate.id,{version:preview.batch.version,decision:'IMPORT',reason:'درخواست ورود'},leader,409);
 await post(batchUrl(batch.id)+'/rows/'+suspect.id,{version:preview.batch.version,decision:'IMPORT',reason:'تطبیق دستی؛ فرد مستقل است'},executive);
 preview=await get(batchUrl(batch.id),leader);
 await post(batchUrl(batch.id)+'/confirm',{version:preview.batch.version,rowIds:[valid.id,suspect.id]},leader);
 await post(batchUrl(batch.id)+'/confirm',{version:preview.batch.version,rowIds:[valid.id]},leader,409);
 preview=await get(batchUrl(batch.id),leader);assert.equal(preview.summary.success,2);assert.equal(preview.summary.skipped,7);
 const imported=preview.rows.filter(r=>r.family_id);assert.ok(imported.every(r=>r.family_status==='NEEDS_CLASSIFICATION'));
 assert.equal((await pool.query('SELECT count(*)::int n FROM family.family_memberships WHERE family_id=ANY($1::uuid[])',[imported.map(r=>r.family_id)])).rows[0].n,2);
 assert.ok((await pool.query('SELECT current_group_id FROM family.families WHERE id=ANY($1::uuid[])',[imported.map(r=>r.family_id)])).rows.every(r=>r.current_group_id===group));
 pass('Excel six-column template, scoped upload, Jalali/formula errors, duplicate decisions and atomic selected import');
 const again=await upload([['نام','جدید','1234567890'],['مشکوک','همنام','','09120000002']]);const repeat=await get(batchUrl(again.id),leader);assert.equal(repeat.rows[0].classification,'DUPLICATE');assert.equal(repeat.rows[1].classification,'SUSPECT');
 const familyRow=async id=>(await get('/family-import',leader)).families.find(f=>f.id===id);
 const classify=async(id,action)=>post('/family-import/families/'+id,{version:(await familyRow(id)).version,action},leader);
 const importedId=imported[0].family_id;
 await post('/health-assessment/families/'+importedId+'/draft',{},leader,409);
 await classify(importedId,'ACTIVE');await post('/health-assessment/families/'+importedId+'/draft',{},leader,409);

 const lifecycle=async(id,status,auth=executive,expected=200,reason='تغییر وضعیت برای بررسی پایلوت')=>post('/family-workspace/families/'+id+'/lifecycle',{version:(await get('/family-workspace/families/'+id,executive)).family.version,status,reason},auth,expected);
 const mainList=async()=> (await get('/family-workspace/families',leader)).families;
 const appeared=(await mainList()).find(f=>f.id===importedId);assert.equal(appeared.family_status,'ACTIVE');assert.equal(appeared.imported.members_confirmed_at,null);
 assert.equal((await get('/family-workspace/families',other)).families.some(f=>f.id===importedId),false);
 await post('/family-import/families/'+importedId,{version:(await familyRow(importedId)).version,action:'INACTIVE'},leader,403);
 for(const auth of [leader,other,guide,helper])await lifecycle(importedId,'TEMPORARILY_INACTIVE',auth,403);
 await lifecycle(importedId,'TEMPORARILY_INACTIVE',executive,400,' ');
 await lifecycle(importedId,'TEMPORARILY_INACTIVE');
 assert.equal((await mainList()).find(f=>f.id===importedId).family_status,'TEMPORARILY_INACTIVE');
 await lifecycle(importedId,'ACTIVE');assert.equal((await mainList()).find(f=>f.id===importedId).family_status,'ACTIVE');
 const created=(await pool.query('SELECT created_at FROM family.families WHERE id=$1',[importedId])).rows[0].created_at.toISOString();
 assert.equal((await get('/family-workspace/families/'+importedId,leader)).family.imported.transferred_at,created);
 const events=(await pool.query("SELECT * FROM guidance.history WHERE entity_id=$1 AND action='FAMILY_LIFECYCLE_CHANGED' ORDER BY occurred_at",[importedId])).rows;
 assert.equal(events.length,2);assert.ok(events.every(e=>e.actor_id===executive.user.accountId&&e.reason&&e.occurred_at));
 pass('Pilot immediate imported visibility before member completion; lifecycle permissions, inactive retrieval, reactivation and audited automatic timestamp');

 preview=await get(batchUrl(batch.id),executive);assert.equal(preview.canRollback,true);
 await post(batchUrl(batch.id)+'/rollback',{version:preview.batch.version,reason:'ابطال آزمایشی غیرحذفی'},executive);
 preview=await get(batchUrl(batch.id),executive);assert.equal(preview.batch.state,'VOID');assert.equal(preview.rows.length,9);assert.ok(preview.rows.filter(r=>r.family_id).every(r=>r.family_status==='CLOSED'));
 const original=await fetch('http://127.0.0.1:3001/api/v1'+batchUrl(batch.id)+'/file',{headers:{cookie:guide.cookie}});assert.equal(original.status,200);assert.ok((await original.arrayBuffer()).byteLength>0);
 await post('/family-import/families/'+importedId,{version:(await familyRow(importedId)).version,action:'ACTIVE'},leader,409);
 await assert.rejects(pool.query("UPDATE family.families SET status='ACTIVE' WHERE id=$1",[importedId]));
 pass('Status-only transitions allow nondeleting rollback; identifiers/file/history retained; void family cannot reactivate');
 async function importOne(label){const b=await upload([[label,'خانواده']]);const p=await get(batchUrl(b.id),leader);await post(batchUrl(b.id)+'/confirm',{version:p.batch.version,rowIds:[p.rows[0].id]},leader);const ready=await get(batchUrl(b.id),leader);return {id:ready.rows[0].family_id,batch:b.id};}
 const operational=await importOne('عملیاتی');await classify(operational.id,'ACTIVE');await classify(operational.id,'MEMBERS_COMPLETE');
 const comp='/shared/families/'+operational.id+'/comprehensive';
 const keptDraft=await post(comp+'/save',{version:null,payload:{answers:{},evidence:[],notes:''}},leader);
 preview=await get(batchUrl(operational.batch),executive);assert.equal(preview.canRollback,false);await post(batchUrl(operational.batch)+'/rollback',{version:preview.batch.version,reason:'Operational assessment exists'},executive,409);
 await lifecycle(operational.id,'TEMPORARILY_INACTIVE');assert.equal((await get(comp,leader)).draft.id,keptDraft.draft.id);
 await post(comp+'/save',{version:keptDraft.draft.version,payload:{answers:{}}},leader,403);
 await lifecycle(operational.id,'ACTIVE');assert.equal((await get(comp,leader)).draft.id,keptDraft.draft.id);
 pass('Imported family unified draft blocks rollback and survives inactivation/reactivation without auto-submit or deletion');

 const manual=await importOne('ویرایش');const base=await get('/family-workspace/families/'+manual.id,leader);const originalTransferred=base.family.imported.transferred_at;base.family.formedOn='2000-01-01';base.family.imported.transferred_at='2000-01-01T00:00:00Z';base.members[0].first_name='نام اصلاح‌شده';await post('/family-workspace/families/'+manual.id,{version:base.family.version,family:base.family,members:base.members},leader);
 assert.equal((await get('/family-workspace/families/'+manual.id,leader)).family.imported.transferred_at,originalTransferred);
 preview=await get(batchUrl(manual.batch),executive);assert.equal(preview.canRollback,false);
 assert.equal((await get('/family-import',other)).families.length,0);assert.ok((await get('/family-import',guide)).families.length>=4);
 await post(batchUrl(manual.batch)+'/rollback',{version:preview.batch.version,reason:'فاقد اختیار'},guide,403);
 assert.equal(await digest(),oldLivelihood);
 pass('Explicit one-member completion permits assessment; assessment/manual edits block rollback; global read-only scope; livelihood snapshots unchanged');
 const atomic=await upload([['اتمی','اول'],['اتمی','دوم']]);let ap=await get(batchUrl(atomic.id),leader);
 const beforeCount=(await pool.query('SELECT count(*)::int n FROM family.families')).rows[0].n;
 await pool.query("CREATE FUNCTION test_fail_import() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='IMPORT_CONFIRMED' THEN RAISE EXCEPTION 'test'; END IF; RETURN NEW; END $$; CREATE TRIGGER test_import BEFORE INSERT ON guidance.history FOR EACH ROW EXECUTE FUNCTION test_fail_import()");
 await post(batchUrl(atomic.id)+'/confirm',{version:ap.batch.version,rowIds:ap.rows.map(r=>r.id)},leader,500);
 assert.equal((await pool.query('SELECT count(*)::int n FROM family.families')).rows[0].n,beforeCount);
 assert.equal((await get(batchUrl(atomic.id),leader)).summary.success,0);
 await pool.query('DROP TRIGGER test_import ON guidance.history; DROP FUNCTION test_fail_import()');
 pass('Failed final import audit rolls back all selected families and retains failed batch history');
 for(const kind of ['member','document','mission','support']){
  const f=await importOne('فعالیت '+kind);
  if(kind==='member'){const p=(await pool.query("INSERT INTO identity.people(first_name,last_name) VALUES('عضو','جدید') RETURNING id")).rows[0];await pool.query("INSERT INTO family.family_memberships(family_id,person_id,relationship_code) VALUES($1,$2,'CHILD')",[f.id,p.id]);}
  if(kind==='document')await pool.query("INSERT INTO family.documents(family_id,name,media_type,content) VALUES($1,'سند','text/plain',$2)",[f.id,Buffer.from('test')]);
  if(kind==='mission')await pool.query("INSERT INTO guidance.items(kind,subject,created_by,audience_type,family_id) VALUES('MISSION','ماموریت',$1,'GUIDE',$2)",[executive.user.accountId,f.id]);
  if(kind==='support')await pool.query("INSERT INTO monitoring.support_records(family_id,amount,occurred_at,provenance,category,status) VALUES($1,0,now(),'TEST','آزمایش','COMPLETED')",[f.id]);
  const p=await get(batchUrl(f.batch),executive);assert.equal(p.canRollback,false,kind);await post(batchUrl(f.batch)+'/rollback',{version:p.batch.version,reason:'آزمایش مسدود بودن'},executive,409);
 }
 pass('Member additions, documents, missions and support independently prevent rollback');

 const {chromium}=createRequire(path.join(root,'package.json'))('playwright');
 const flog=openSync(path.join(out,'frontend.log'),'w');front=spawn(process.execPath,['tests/preview.mjs'],{cwd:root,env:{...env,PREVIEW_PORT:'5174',BACKEND_PROXY:'http://127.0.0.1:3001'},windowsHide:true,stdio:['ignore',flog,flog]});await waitReady(origin,front);
 browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});const errors=[];
 async function browserAs(auth){const ctx=await browser.newContext({viewport:{width:1440,height:1000}});await ctx.addCookies([{name:'lahout_session',value:auth.cookie.split('=')[1],url:origin,httpOnly:true,sameSite:'Strict'}]);const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));return p;}
 const page=await browserAs(leader),ep=await browserAs(executive);
 await page.goto(origin+'/leader');await page.locator('.leader-workspace').waitFor();assert.equal(await page.locator('table').count(),0);
 await page.getByRole('button',{name:/نیازمند اقدام من.*نمایش در فهرست/}).click();await page.waitForURL('**/leader/families?filter=*');await page.locator('table').waitFor();
 await page.goto(origin+'/workspace/families/'+family.id);const nav=page.getByRole('navigation',{name:'حوزه‌های ارزیابی'});await nav.waitFor();assert.equal(await nav.getByRole('link').count(),7);assert.equal(await nav.locator('[aria-disabled=true]').count(),0);
 assert.equal(await page.getByRole('region',{name:'اطلاعات جاری پرونده',exact:true}).locator('input,select,textarea').count(),0);
 pass('Browser dashboard summary and KPI drilldown; family base read-only with seven active navigation targets for base data, five domains and final review');
 await nav.getByRole('link',{name:'سلامت و درمان',exact:true}).click();await page.waitForURL('**/assessment/health');await page.locator('.comprehensive-nav').waitFor();
 pass('Health tab from current family opens the sole comprehensive assessment engine');
 await page.goto(origin+'/workspace/family-import');await page.getByRole('heading',{name:'بارگذاری فایل گروه',exact:true}).waitFor();
 const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('link',{name:'دریافت قالب رسمی Excel',exact:true}).click()]);assert.equal(download.suggestedFilename(),'family-import-v1.xlsx');
 await page.getByLabel('فایل خانواده‌های قبلی',{exact:true}).setInputFiles({name:'browser.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:await file([['مرورگر','سالم'],['مرورگر','تاریخ نامعتبر','','','','1400/12/30']])});
 await page.getByRole('button',{name:'بارگذاری و بررسی',exact:true}).click();await page.waitForURL('**/workspace/family-import/*');
 await page.getByRole('button',{name:'تأیید ورود خانواده‌های انتخاب‌شده',exact:true}).waitFor();assert.ok((await page.locator('tbody').innerText()).includes('تاریخ'));assert.equal(await page.locator('input[type=checkbox]:checked').count(),1);
 const browserBatch=new URL(page.url()).pathname.split('/').pop();await page.getByRole('button',{name:'تأیید ورود خانواده‌های انتخاب‌شده',exact:true}).click();await page.getByRole('heading',{name:'ابطال Batch',exact:true}).waitFor();
 await page.getByRole('link',{name:'بازگشت به ورود خانواده‌ها',exact:true}).click();const row=page.locator('tbody tr').filter({hasText:'مرورگر سالم'});await row.getByRole('button',{name:'فعال',exact:true}).click();await row.getByText('نیازمند تکمیل اعضای خانواده',{exact:true}).waitFor();await page.goto(origin+'/leader/families');await page.getByRole('row').filter({hasText:'مرورگر سالم'}).waitFor();await page.goto(origin+'/workspace/family-import');await row.getByRole('button',{name:'تکمیل اعضای خانواده تأیید شد',exact:true}).click();await row.getByText('نیازمند ارزیابی جدید',{exact:true}).waitFor();assert.equal(await row.getByRole('button',{name:'غیرفعال',exact:true}).count(),0);assert.equal(await row.getByRole('button',{name:'فعال',exact:true}).count(),0);
 await ep.goto(origin+'/workspace/family-import/'+browserBatch);await ep.getByLabel('دلیل ابطال',{exact:true}).fill('ابطال آزمایش رابط');await ep.getByRole('button',{name:'ابطال غیرحذفی Batch',exact:true}).click();await ep.getByText(/ابطال غیرحذفی؛ فایل/).waitFor();
 const gp=await browserAs(guide);await gp.goto(origin+'/workspace/family-import');await gp.getByRole('heading',{name:'سابقه Batchها',exact:true}).waitFor();assert.equal(await gp.locator('input[type=file]').count(),0);assert.equal(await gp.locator('tbody button').count(),0);
 pass('Browser template, upload/error preview, selected confirm, explicit member completion, classification, manager rollback and witness read-only');
 const alert=(await pool.query("INSERT INTO oversight.alerts(family_id,rule_code,subject,severity) VALUES($1,'TEST_IMPORT_NOTICE','هشدار آزمون اعلان','CRITICAL') RETURNING id",[family.id])).rows[0];
 await pool.query("INSERT INTO guidance.notifications(recipient_id,category,message,visibility,dedupe_key,link_type,link_id) VALUES($1,'CRITICAL','هشدار آزمون اعلان','PRIVATE','test-critical','ALERT',$2),($1,'INFO','اعلان عادی آزمون','PRIVATE','test-normal',NULL,NULL)",[leader.user.accountId,alert.id]);
 await page.goto(origin+'/workspace/notifications');assert.equal(await page.getByRole('button',{name:/^خوانده‌نشده/}).getAttribute('aria-pressed'),'true');
 const normal=page.locator('article').filter({hasText:'اعلان عادی آزمون'}),critical=page.locator('article').filter({hasText:'هشدار آزمون اعلان'});
 await normal.getByRole('button',{name:'خواندم',exact:true}).click();await normal.waitFor({state:'hidden'});await critical.getByRole('button',{name:'خواندم',exact:true}).click();await critical.getByText(/خوانده‌شده/).waitFor();await page.reload();await critical.waitFor();
 await pool.query("UPDATE oversight.alerts SET state='RESOLVED',resolved_at=now(),resolved_by=$2,action_taken='رسیدگی شد',result='رفع شد' WHERE id=$1",[alert.id,executive.user.accountId]);
 await page.reload();await page.getByRole('button',{name:/^همه اعلان‌ها/}).waitFor();assert.equal(await critical.count(),0);await page.getByRole('button',{name:/^همه اعلان‌ها/}).click();await normal.waitFor();await critical.waitFor();
 pass('Unread inbox removes ordinary read notices, retains read active critical alerts until resolution, and keeps all history');

 await lifecycle(operational.id,'TEMPORARILY_INACTIVE');
 await ep.goto(origin+'/workspace/families/'+operational.id);await ep.getByText('تغییر وضعیت خانواده — غیرفعال',{exact:true}).click();
 await ep.getByLabel('دلیل تغییر وضعیت خانواده',{exact:true}).fill('فعال‌سازی مجدد در مرورگر');
 await ep.getByRole('button',{name:'فعال کردن خانواده',exact:true}).click();await ep.getByText('وضعیت خانواده تغییر کرد.',{exact:true}).waitFor();
 await page.goto(origin+'/leader/families');await page.getByRole('row').filter({hasText:'عملیاتی خانواده'}).waitFor();
 await ep.reload();await ep.getByText('تغییر وضعیت خانواده — فعال',{exact:true}).click();await ep.getByLabel('دلیل تغییر وضعیت خانواده',{exact:true}).fill('خروج موقت از صف روزمره');
 await ep.getByRole('button',{name:'غیرفعال کردن خانواده',exact:true}).click();await ep.getByText('وضعیت خانواده تغییر کرد.',{exact:true}).waitFor();
 await page.reload();await page.getByLabel('وضعیت خانواده',{exact:true}).waitFor();assert.equal(await page.getByRole('row').filter({hasText:'عملیاتی خانواده'}).count(),0);
 await page.getByLabel('وضعیت خانواده',{exact:true}).selectOption('TEMPORARILY_INACTIVE');await page.getByRole('row').filter({hasText:'عملیاتی خانواده'}).getByRole('link',{name:'مشاهده پرونده'}).click();
 const baseRegion=page.getByRole('region',{name:'اطلاعات جاری پرونده'});assert.equal(await baseRegion.getByLabel('دلیل تغییر وضعیت خانواده').count(),0);
 await baseRegion.getByRole('button',{name:'ویرایش اطلاعات پرونده'}).click();assert.equal(await baseRegion.getByLabel('تاریخ تشکیل/انتقال پرونده').locator('select,input').count(),0);
 await gp.goto(origin+'/workspace/families/'+operational.id);await gp.getByRole('region',{name:'اطلاعات جاری پرونده'}).waitFor();assert.equal(await gp.getByRole('button',{name:'ویرایش اطلاعات پرونده'}).count(),0);assert.equal(await gp.getByLabel('دلیل تغییر وضعیت خانواده').count(),0);
 await gp.goto(origin+'/workspace/health/'+operational.id);await gp.waitForURL('**/assessment/health');await gp.getByText(/حالت مشاهده ارزیابی/).waitFor();assert.equal(await gp.getByRole('button',{name:'ذخیره پیش‌نویس',exact:true}).count(),0);
 pass('Pilot browser manager lifecycle, immediate leader active/inactive filters, immutable import date and witness read-only desktop');

 for(const route of ['/leader/families','/workspace/families/'+family.id,'/workspace/livelihood/'+family.id,'/workspace/notifications','/workspace','/workspace/health/'+family.id,'/workspace/family-import','/workspace/family-import/'+browserBatch]){await page.goto(origin+route);await page.locator('.health-workspace,.panel,.role-card,.leader-workspace,.notification-tabs').first().waitFor();for(const width of [1440,768,390]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'overflow '+route+' '+width);}}
 assert.deepEqual(errors,[]);assert.equal(await digest(),oldLivelihood);pass('New health/import pages fit desktop/tablet/mobile without JS errors or livelihood snapshot changes');
} catch(error){results.push({name:error.message,status:'FAIL'});console.error(error);process.exitCode=1;}
finally{if(browser)await browser.close();await stop(front);await stop(server);await pool.end();await dropTestDatabase(admin,dbName);await admin.end();writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));}
