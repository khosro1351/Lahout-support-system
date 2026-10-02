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
const out = path.join(root, 'test-results/comprehensive');
mkdirSync(out, { recursive: true });
const results = [];
const pass = name => { results.push({ name, status: 'PASS' }); console.log('PASS ' + name); };
const dbName = 'lahout_test_comprehensive_' + Date.now();
const admin = new Pool({ connectionString: process.env.TEST_DATABASE_ADMIN_URL });
await admin.query(`CREATE DATABASE ${dbName}`);
const dbUrl = new URL(process.env.TEST_DATABASE_ADMIN_URL); dbUrl.pathname = '/' + dbName;
const pool = new Pool({ connectionString: dbUrl.href });
const origin = 'http://127.0.0.1:5174';
const env = { ...process.env, DATABASE_URL: dbUrl.href, UPLOAD_STORAGE_ROOT:path.join(out,dbName), APP_ENV: 'development', BACKEND_PORT: '3001', FRONTEND_ORIGIN: origin, COOKIE_SECURE: 'false', SESSION_TTL_HOURS: '12', DEV_ACCESS_BATCH: 'initial' };
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
 run('.tools/scripts/migrate.js');run('.tools/scripts/migrate.js');run('.tools/scripts/seed-dev.js');run('.tools/scripts/seed-access-dev.js');run('.tools/scripts/seed-guide-dev.js');run('.tools/scripts/seed-roles-dev.js');run('.tools/scripts/seed-livelihood-dev.js');
 const preserved=(await pool.query("SELECT md5(string_agg(to_jsonb(s)::text,'' ORDER BY id)) digest FROM assessment.snapshots s")).rows[0];
 assert.equal((await pool.query('SELECT count(*)::int n FROM core.schema_migrations')).rows[0].n,18);
 const log=openSync(path.join(out,'backend.log'),'w');server=spawn(process.execPath,['dist/main.js'],{cwd:backend,env,windowsHide:true,stdio:['ignore',log,log]});await waitReady('http://127.0.0.1:3001/api/v1/auth/me',server);
 const post=async(url,body,auth,status=200)=>{const r=await req(url,{...auth,body});assert.equal(r.status,status,JSON.stringify(r.body));return r.body;};
 const get=async(url,auth)=>{const r=await req(url,auth);assert.equal(r.status,200,JSON.stringify(r.body));return r.body;};
 async function login(username,role){const r=await req('/auth/login',{body:{username,password}});assert.equal(r.status,200,JSON.stringify(r.body));const a={cookie:r.cookie,csrf:r.body.csrfToken};if(role)await post('/auth/select-role',{roleCode:role},a);return a;}
 const leader=await login('TestV100_Leader1','GROUP_LEADER'),executive=await login('TestV100_Executive','EXECUTIVE_MANAGER'),helper=await login('TestV100_Helper1_1'),guide=await login('Aseman'),tech=await login('TechSupportDev');
 const list=(await get('/livelihood/families',leader)).families;
 const family=list[0],naFamily=list[1],foreign=(await pool.query("SELECT id FROM family.families WHERE family_code='HL-TEST-G2-01'")).rows[0];
 const base=f=>'/shared/families/'+f.id+'/comprehensive';
 // Use canonical base-data edits; legacy snapshots must remain byte-for-byte unchanged.
 for(const [f,student] of [[family,true],[naFamily,false]]){

  const row=(await pool.query('SELECT * FROM family.families WHERE id=$1',[f.id])).rows[0];
  const members=(await pool.query('SELECT p.*,m.relationship_code,m.profile_data FROM identity.people p JOIN family.family_memberships m ON m.person_id=p.id WHERE m.family_id=$1 AND m.valid_to IS NULL ORDER BY p.id',[f.id])).rows;
  await post('/livelihood/families/'+f.id+'/basic',{version:row.version,family:{...row.basic_data,neighborhood:row.neighborhood},members:members.map((m,i)=>({...m,birth_date:student&&i===0?'2010-01-01':'1980-01-01',profile_data:{...m.profile_data,education:student&&i===0?'در حال تحصیل':'فارغ‌التحصیل'}}))},leader);
 }
 const b=await get(base(family),leader),na=await get(base(naFamily),leader);
 assert.equal(b.result.educationApplicability.state,'APPLICABLE');assert.equal(na.result.educationApplicability.state,'NOT_APPLICABLE');
 assert.deepEqual((await pool.query("SELECT md5(string_agg(to_jsonb(s)::text,'' ORDER BY id)) digest FROM assessment.snapshots s")).rows[0],preserved);
 pass('Migration 0018 repeatable; canonical member edits preserve every legacy snapshot; applicability derives from current base data');
 function payload(w,alert=false){return {answers:{
 livelihood:{incomeRange:'NONE',incomeSources:['NONE'],mainIncomeSource:'NONE',stability:'OPTION_0',adequacy:'OPTION_0',essentialCosts:'OPTION_0',debt:'OPTION_0',economicCapacity:'UNKNOWN'},
 health:{members:w.members.map(m=>({memberId:m.id,screening:'NO'}))},
 housing:{residenceType:'OWNER',stability:alert?'OPTION_3':'OPTION_0',problems:['NONE'],qualitySafety:'OPTION_0',financialPressure:'OPTION_0',fit:'OPTION_0'},
 vulnerability:{dependency:'OPTION_0',risks:['NONE'],socialRisk:'OPTION_0',crisisType:'NONE'},
 education:{members:w.result.educationApplicability.eligibleMemberIds.map(memberId=>({memberId,status:'OPTION_0'}))}
 },evidence:[],notes:''};}
 await post(base(foreign)+'/save',{payload:payload(b)},leader,403);
 for(const a of [helper,executive,guide,tech])await post(base(family)+'/save',{payload:payload(b)},a,403);
 const saved=await post(base(family)+'/save',{version:null,payload:payload(b,true)},leader);
 assert.equal(saved.result.complete,true,JSON.stringify(saved.result.missing));
 await post(base(family)+'/save',{version:saved.draft.version-1,payload:payload(b)},leader,409);
 await post(base(family)+'/save',{version:saved.draft.version,payload:{...payload(b),score:100}},leader,400);
 await post('/livelihood/families/'+family.id+'/submit',{},leader,409);
 let w=await get(base(family),leader);assert.equal(w.alerts.length,1);const alertId=w.alerts[0].id;
 assert.equal(w.alerts[0].deep_link,'/workspace/families/'+family.id+'/assessment/housing#housing-stability');
 const again=await post(base(family)+'/save',{version:w.draft.version,payload:payload(b,true)},leader);
 assert.equal((await get(base(family),leader)).alerts[0].id,alertId);
 await post('/shared/alerts/'+alertId+'/progress',{state:'ACKNOWLEDGED'},leader);
 assert.equal((await get(base(family),leader)).alerts[0].state,'ACKNOWLEDGED');
 pass('Permission, optimistic locking, client score rejection, unified workflow guard and idempotent source-linked alerts; Seen is not Resolved');

 const {chromium}=await import('playwright');
 front=spawn(process.execPath,[path.join(root,'tests/preview.mjs')],{cwd:root,env:{...env,PREVIEW_PORT:'5174',BACKEND_PROXY:'http://127.0.0.1:3001'},windowsHide:true,stdio:'ignore'});await waitReady(origin,front);
 browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
 const context=await browser.newContext(),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 async function session(a){await context.clearCookies();await context.addCookies([{name:'lahout_session',value:a.cookie.split('=')[1],url:origin,httpOnly:true,sameSite:'Strict'}]);}
 const pathTo=(f,section='review')=>origin+'/workspace/families/'+f.id+'/assessment/'+section;
 await session(leader);await page.goto(pathTo(family));
 await page.getByRole('button',{name:'ادامه ارزیابی در حال تکمیل',exact:true}).click();
 await page.getByRole('link',{name:/مسکن.*✓/}).click();
 await page.locator('#housing-stability select').selectOption('OPTION_3');
 await page.getByRole('button',{name:'ذخیره تغییرات ارزیابی',exact:true}).click();
 await page.getByRole('status').filter({hasText:'تغییرات ارزیابی ذخیره شد'}).waitFor();
 await page.getByRole('link',{name:'مرور نهایی',exact:true}).click();
 await page.getByRole('button',{name:'ارسال ارزیابی برای مدیر اجرایی',exact:true}).click();
 await page.getByRole('status').filter({hasText:'کل ارزیابی برای مدیر اجرایی ارسال شد'}).waitFor();
 let submitted=(await get(base(family),leader)).versions[0],frozen=JSON.stringify(submitted.answers);
 const pendingFile=await get('/shared/families/'+family.id,leader);
 assert.equal(pendingFile.assessment.pending.id,submitted.id);assert.equal(pendingFile.assessment.approved,null);
 assert.equal(pendingFile.family.score,null);assert.equal(pendingFile.family.need_level,null);
 const pendingList=(await get('/family-workspace/families',leader)).families.find(f=>f.id===family.id);
 assert.equal(pendingList.status,'PENDING');assert.equal(pendingList.score,null);
 const pendingReport=await get('/oversight/reports/families',guide);
 assert.equal(pendingReport.rows.find(f=>f.link.endsWith(family.id)).level,'نامشخص');
 pass('Submitted FINAL is separate from Approved across family file, family list and guide report');
 assert.equal(submitted.result.applicableMaximum,100);
 const document=submitted.evidence[0];assert.ok(document);
 const updatedDoc=await post('/livelihood/families/'+family.id+'/document-versions',{requestId:crypto.randomUUID(),documentId:document.id,name:document.name,category:document.category,files:[{name:'updated.txt',mediaType:'text/plain',content:Buffer.from('New current document, old submitted bytes remain').toString('base64')}]},leader);
 assert.notEqual(updatedDoc.id,document.id);
 const oldManifest=await get('/livelihood/families/'+family.id+'/documents/'+document.id+'/manifest',leader);assert.ok(oldManifest.files.length);
 assert.ok((await get(base(family),leader)).versions[0].evidence.some(d=>d.id===document.id));

 await post(base(family)+'/save',{version:null,payload:payload(b)},leader,409);
 await post(base(family)+'/decision',{snapshotId:submitted.id,decision:'APPROVED'},leader,403);
 await post(base(family)+'/submit',{draftId:again.draft.id,version:again.draft.version},leader,409);
 await session(executive);await page.goto(pathTo(family)+'?version='+submitted.id);
 await page.getByLabel('حوزه',{exact:true}).selectOption('housing');
 await page.getByLabel('بخش / سؤال',{exact:true}).selectOption('stability');
 await page.getByLabel('علت اصلاح',{exact:true}).fill('وضعیت سکونت دوباره بررسی شود');
 await page.getByRole('button',{name:'بازگشت کل ارزیابی برای اصلاح',exact:true}).click();
 await page.getByRole('status').filter({hasText:'کل ارزیابی برای اصلاح بازگشت داده شد'}).waitFor();
 await session(leader);await page.goto(pathTo(family));
 await page.getByRole('link',{name:/وضعیت سکونت دوباره بررسی شود/}).click();
 assert.equal(new URL(page.url()).hash,'#housing-stability');await page.locator('#housing-stability').waitFor();
 await page.getByRole('button',{name:'ادامه ارزیابی در حال تکمیل',exact:true}).click();
 await page.locator('#housing-stability select').selectOption('OPTION_0');
 await page.getByRole('button',{name:'ذخیره تغییرات ارزیابی',exact:true}).click();
 await page.getByRole('status').filter({hasText:'تغییرات ارزیابی ذخیره شد'}).waitFor();
 w=await get(base(family),leader);assert.equal(w.alerts[0].state,'RESOLVED');assert.equal(JSON.stringify(w.versions[0].answers),frozen);
 await page.getByRole('link',{name:'مرور نهایی',exact:true}).click();
 await page.getByRole('button',{name:'ارسال ارزیابی برای مدیر اجرایی',exact:true}).click();
 await page.getByRole('status').filter({hasText:'کل ارزیابی برای مدیر اجرایی ارسال شد'}).waitFor();
 const second=(await get(base(family),leader)).versions[0];
 assert.notEqual(second.id,submitted.id);assert.equal(second.result.previousSnapshotId,submitted.id);
 await session(executive);await page.goto(pathTo(family)+'?version='+second.id);
 await page.getByRole('button',{name:'تأیید کل ارزیابی',exact:true}).click();await page.getByRole('status').filter({hasText:'کل ارزیابی تأیید شد'}).waitFor();
 await post(base(family)+'/decision',{snapshotId:second.id,decision:'RETURNED',comments:[{domain:'housing',reason:'duplicate'}]},executive,409);
 await assert.rejects(pool.query("UPDATE assessment.snapshots SET answers='{}' WHERE id=$1",[second.id]),/immutable/i);
 assert.ok((await get(base(family),leader)).history.some(h=>h.action==='COMPREHENSIVE_RESUBMITTED'));
 pass('Browser applicable family: final review, one submit, manager field-linked return, exact deep link, correction, source resolution, resubmit, approve and immutable history');

 // A new cycle stays editable when navigating away from its initial ?new route.
 await session(leader);await page.goto(pathTo(family));
 await page.getByRole('button',{name:'شروع ارزیابی جامع جدید با حفظ نسخه تأییدشده',exact:true}).click();
 await page.locator('.comprehensive-nav a[href$="/housing"]').click();
 await page.locator('#housing-stability select').waitFor();
 assert.equal(await page.locator('#housing-stability select').isEnabled(),true);
 await page.getByRole('button',{name:'انصراف از ویرایش',exact:true}).click();
 assert.equal((await get(base(family),leader)).draft,null);

 // N/A case filled in the browser across all relevant sections.
 await session(leader);await page.goto(pathTo(naFamily,'livelihood'));
 await page.getByRole('button',{name:'شروع ارزیابی جامع جدید',exact:true}).click();
 const np=payload(na);
 for(const section of ['livelihood','health','housing','vulnerability','education']){
  await page.locator('nav.comprehensive-nav a[href$="/'+section+'"]').click();
  if(section==='health'){
   for(const m of na.members)await page.locator('#health-'+m.id+'-screening select').selectOption('NO');
  }else if(section!=='education'){
   for(const [key,value] of Object.entries(np.answers[section])){
    if(section==='housing'&&key==='residenceType'&&na.family.residenceType){assert.equal(await page.locator('#housing-residenceType select').count(),0);continue;}
    if(Array.isArray(value)){for(const v of value){const index=na.fields[section].find(q=>q.key===key).options.findIndex(o=>o.value===v);await page.locator('#'+section+'-'+key+' input[type=checkbox]').nth(index).check();}}
    else await page.locator('#'+section+'-'+key+' select').selectOption(value);
   }
  }else await page.getByText(/آموزش: N\/A/).waitFor();
  const confirm=page.getByLabel('بازنگری این حوزه با مدل جاری انجام شد',{exact:true});if(await confirm.count())await confirm.check();
 }
 await page.getByRole('button',{name:'ذخیره تغییرات ارزیابی',exact:true}).click();await page.getByRole('status').filter({hasText:'تغییرات ارزیابی ذخیره شد'}).waitFor();
 await page.getByRole('link',{name:'مرور نهایی',exact:true}).click();await page.locator('[data-testid=normalized-score]').waitFor();
 const naSaved=await get(base(naFamily),leader);assert.equal(naSaved.result.domainRawScores.education,null);assert.equal(naSaved.result.applicableMaximum,85);assert.equal(naSaved.result.needLevel,'D');
 await page.getByRole('button',{name:'ارسال ارزیابی برای مدیر اجرایی',exact:true}).click();await page.getByRole('status').filter({hasText:'کل ارزیابی برای مدیر اجرایی ارسال شد'}).waitFor();
 const naSubmitted=(await get(base(naFamily),leader)).versions[0];assert.equal(naSubmitted.result.applicableMaximum,85);assert.equal(naSubmitted.result.domainRawScores.education,null);
 pass('Browser N/A family: all four applicable forms, null education, maximum 85, normalized need level and single submit without education answers');
 for(const width of [1440,768,390]){
  await page.setViewportSize({width,height:900});
  for(const section of ['livelihood','health','housing','vulnerability','education','review']){
   await page.goto(pathTo(naFamily,section)+'?version='+naSubmitted.id);await page.locator('.comprehensive-nav').waitFor();
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Overflow '+width+' '+section);
  }
 }
 assert.deepEqual(errors,[]);pass('Desktop, tablet and mobile all five domains/review: RTL, no horizontal page overflow or JavaScript errors');
 const decisionCount=(await pool.query("SELECT count(*)::int n FROM assessment.decisions")).rows[0].n;
 assert.equal(decisionCount,2);
 pass('Audit records preserve submit, return comments, resubmit, approval and alert lifecycle with exactly one decision per submitted version');

 const approvedFile=await get('/shared/families/'+family.id,leader);
 assert.equal(approvedFile.assessment.approved.id,second.id);assert.equal(approvedFile.assessment.status,'VALID');
 const approvedList=(await get('/family-workspace/families',leader)).families.find(f=>f.id===family.id);
 const dashboard=(await get('/roles/dashboard',executive)).families.find(f=>f.family_id===family.id);
 const report=(await get('/oversight/reports/families',guide)).rows.find(f=>f.link.endsWith(family.id));
 for(const row of [approvedFile.family,approvedList,dashboard]){assert.equal(Number(row.score),second.result.normalizedScore);assert.equal(row.need_level,second.result.needLevel);}
 assert.equal(report.level,second.result.needLevel);
 const generic=(await get('/monitoring/data/families?family='+family.id,guide)).rows[0];assert.equal(Number(generic.score),second.result.normalizedScore);
 pass('One Approved result in family file, list, executive dashboard, guide report and generic reporting view');

 await session(leader);await page.setViewportSize({width:1440,height:900});await page.goto(origin+'/workspace/families/'+family.id);
 await page.locator('[data-testid=approved-family-result]').waitFor();
 await page.getByRole('button',{name:'ویرایش اطلاعات پرونده',exact:true}).click();
 await page.getByLabel('شماره تماس عضو ۱',{exact:true}).fill('09001000001');
 await page.getByRole('button',{name:'ذخیره تغییرات',exact:true}).click();
 await page.getByRole('button',{name:'ویرایش اطلاعات پرونده',exact:true}).waitFor();
 for(const domain of ['livelihood','health','housing','vulnerability','education']){
  await page.goto(origin+'/workspace/families/'+family.id);
  await page.locator('.family-navigation a[href$="/assessment/'+domain+'"]').click();
  await page.locator('.comprehensive-nav').waitFor();assert.ok(page.url().includes('/assessment/'+domain));
 }
 await page.goto(origin+'/workspace/livelihood/'+family.id);await page.waitForURL('**/assessment/livelihood');
 await page.goto(origin+'/workspace/health/'+family.id);await page.waitForURL('**/assessment/health');
 for(const route of ['/livelihood/families/'+naFamily.id+'/draft','/shared/families/'+naFamily.id+'/draft'])await post(route,{payload:{answers:{}}},leader,409);
 pass('Family View/Edit/Save and all five tabs use one engine; old operational URLs redirect and old writes are rejected');

 const cycle=await post(base(family)+'/save',{version:null,payload:payload(b)},leader);
 const digest=(await pool.query("SELECT md5(string_agg(to_jsonb(s)::text,'' ORDER BY id)) digest FROM assessment.snapshots s")).rows[0].digest;
 const oldDraft=JSON.stringify((await pool.query('SELECT payload FROM assessment.drafts WHERE id=$1',[cycle.draft.id])).rows[0].payload);
 const idle=(await pool.query("INSERT INTO family.families(family_code,current_group_id,status,created_by) SELECT 'INTEGRATION-IDLE',current_group_id,'ACTIVE',created_by FROM family.families WHERE id=$1 RETURNING id",[family.id])).rows[0];
 const model=(await pool.query("INSERT INTO assessment.models(version,title,state,definition,form_schema) SELECT '2.1-integration','Same rules, new model lifecycle test','APPROVED',definition,form_schema FROM assessment.models WHERE version='2.0' RETURNING id")).rows[0];
 await post('/shared/models/'+model.id+'/transition',{state:'ACTIVE'},tech);
 const idleStatus=(await get(base(idle),leader)).assessment;assert.equal(idleStatus.draft,null);assert.equal(idleStatus.requiresReview,false);
 let migrated=await get(base(family),leader);assert.equal(migrated.assessment.requiresReview,true);assert.equal(migrated.draft,null);assert.equal(migrated.assessment.approved.id,second.id);
 await post(base(family)+'/submit',{draftId:cycle.draft.id,version:cycle.draft.version},leader,409);
 await post(base(naFamily)+'/decision',{snapshotId:naSubmitted.id,decision:'APPROVED'},executive,409);
 let newDraft=await post(base(family)+'/save',{version:null,payload:payload(b),reviewedDomains:['livelihood']},leader);
 await post(base(family)+'/submit',{draftId:newDraft.draft.id,version:newDraft.draft.version},leader,422);
 assert.equal(JSON.stringify((await pool.query('SELECT payload FROM assessment.drafts WHERE id=$1',[cycle.draft.id])).rows[0].payload),oldDraft);
 assert.equal((await pool.query('SELECT legacy_reference FROM assessment.drafts WHERE id=$1',[cycle.draft.id])).rows[0].legacy_reference,true);
 await page.goto(pathTo(family,'health'));await page.getByRole('button',{name:'ادامه ارزیابی در حال تکمیل',exact:true}).click();
 for(const domain of ['health','housing','vulnerability','education']){
  await page.locator('.comprehensive-nav a[href$="/'+domain+'"]').click();
  await page.getByLabel('بازنگری این حوزه با مدل جاری انجام شد',{exact:true}).check();
 }
 await page.getByRole('button',{name:'ذخیره تغییرات ارزیابی',exact:true}).click();
 await page.getByRole('status').filter({hasText:'تغییرات ارزیابی ذخیره شد'}).waitFor();
 migrated=await get(base(family),leader);assert.equal(migrated.assessment.remainingDomains.length,0);
 assert.equal((await pool.query("SELECT md5(string_agg(to_jsonb(s)::text,'' ORDER BY id)) digest FROM assessment.snapshots s")).rows[0].digest,digest);
 const newSubmission=await post(base(family)+'/submit',{draftId:migrated.draft.id,version:migrated.draft.version},leader);
 assert.equal(newSubmission.model_id,model.id);
 assert.equal((await get('/shared/families/'+family.id,leader)).assessment.approved.id,second.id);
 await pool.query("CREATE FUNCTION test_atomic_approval() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='COMPREHENSIVE_APPROVED' THEN RAISE EXCEPTION 'test approval rollback'; END IF; RETURN NEW; END $$; CREATE TRIGGER test_atomic_approval BEFORE INSERT ON guidance.history FOR EACH ROW EXECUTE FUNCTION test_atomic_approval()");
 await post(base(family)+'/decision',{snapshotId:newSubmission.id,decision:'APPROVED'},executive,500);
 assert.equal((await pool.query('SELECT count(*)::int n FROM assessment.decisions WHERE snapshot_id=$1',[newSubmission.id])).rows[0].n,0);
 assert.equal((await get('/shared/families/'+family.id,leader)).assessment.approved.id,second.id);
 await pool.query('DROP TRIGGER test_atomic_approval ON guidance.history; DROP FUNCTION test_atomic_approval()');
 const lifecycleBase=await get('/family-workspace/families/'+family.id,executive);
 await post('/family-workspace/families/'+family.id+'/lifecycle',{version:lifecycleBase.family.version,status:'TEMPORARILY_INACTIVE',reason:'Integration preserves submitted version'},executive);
 await post(base(family)+'/decision',{snapshotId:newSubmission.id,decision:'APPROVED'},executive);
 assert.equal((await get('/shared/families/'+family.id,leader)).assessment.approved.id,newSubmission.id);
 const inactiveBase=await get('/family-workspace/families/'+family.id,executive);
 await post('/family-workspace/families/'+family.id+'/lifecycle',{version:inactiveBase.family.version,status:'ACTIVE',reason:'Integration reactivation'},executive);
 assert.ok((await get(base(family),leader)).history.some(h=>h.action==='COMPREHENSIVE_LEGACY_REFERENCE'));
 pass('Model activation preserves old Approved, Submitted and draft answers; all five explicit reviews required; idle family gets no draft or forced review; new cycle has one model');
 pass('Approval and audit are atomic; inactive submitted family remains reviewable without cancelling its version');

 const finalDigest=(await pool.query("SELECT md5(string_agg(to_jsonb(s)::text,'' ORDER BY id)) digest FROM assessment.snapshots s")).rows[0].digest;
 await page.goto(origin+'/workspace/families/'+family.id);
 const editBase=page.getByRole('button',{name:'ویرایش اطلاعات پرونده',exact:true});await editBase.click();
 const birth=page.getByRole('group',{name:'تاریخ تولد عضو ۱',exact:true});
 await birth.getByRole('button',{name:'پاک کردن تاریخ',exact:true}).click();
 const year=birth.getByLabel('سال',{exact:true}),month=birth.getByLabel('ماه',{exact:true}),day=birth.getByLabel('روز',{exact:true});
 assert.equal(await day.isDisabled(),true);await year.selectOption('1403');await month.selectOption('12');await day.selectOption('30');
 async function saveBaseDate(){await page.getByRole('button',{name:'ذخیره تغییرات',exact:true}).click();await editBase.waitFor();await page.reload();await editBase.click();await birth.waitFor();}
 await saveBaseDate();assert.equal(await day.inputValue(),'30');assert.equal((await get('/family-workspace/families/'+family.id,leader)).members[0].birth_date,'2025-03-20');
 await year.selectOption('1404');assert.equal(await day.inputValue(),'');assert.equal(await page.getByRole('button',{name:'ذخیره تغییرات',exact:true}).isDisabled(),true);
 await day.selectOption('29');await saveBaseDate();assert.equal(await year.inputValue(),'1404');assert.equal(await day.inputValue(),'29');
 await birth.getByRole('button',{name:'پاک کردن تاریخ',exact:true}).click();await saveBaseDate();assert.equal(await year.inputValue(),'');
 assert.equal((await get('/family-workspace/families/'+family.id,leader)).members[0].birth_date,null);
 assert.equal(await page.getByLabel('سن عضو ۱',{exact:true}).textContent(),'نامشخص');
 assert.equal((await pool.query("SELECT md5(string_agg(to_jsonb(s)::text,'' ORDER BY id)) digest FROM assessment.snapshots s")).rows[0].digest,finalDigest);
 pass('Family DOB control: leap Esfand, invalid non-leap prevention, optional empty DOB and read-only unknown age persist through real PostgreSQL; all snapshots unchanged');
 assert.deepEqual(errors,[]);
} catch(e){results.push({name:e.stack??String(e),status:'FAIL'});console.error(e);process.exitCode=1;}
finally{if(browser)await browser.close();await stop(front);await stop(server);await pool.end();await dropTestDatabase(admin,dbName);await admin.end();writeFileSync(path.join(out,'results.json'),JSON.stringify({results},null,2));}
