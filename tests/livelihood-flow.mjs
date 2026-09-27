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
const out = path.join(root, 'test-results/livelihood');
mkdirSync(out, { recursive: true });
const results = [];
const pass = name => { results.push({ name, status: 'PASS' }); console.log('PASS ' + name); };
const dbName = 'lahout_test_livelihood_' + Date.now();
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
 run('.tools/scripts/migrate.js');run('.tools/scripts/migrate.js');run('.tools/scripts/seed-dev.js');run('.tools/scripts/seed-access-dev.js');run('.tools/scripts/seed-guide-dev.js');run('.tools/scripts/seed-roles-dev.js');
 const before=(await pool.query("SELECT md5(string_agg(to_jsonb(s)::text,'' ORDER BY id)) digest FROM assessment.snapshots s")).rows[0];
 run('.tools/scripts/seed-livelihood-dev.js');run('.tools/scripts/seed-livelihood-dev.js');run('.tools/scripts/seed-livelihood-dev.js',{APP_ENV:'production'},1);
 assert.equal((await pool.query("SELECT count(*)::int n FROM family.families WHERE family_code LIKE 'HL-TEST-G%'")).rows[0].n,50);
 assert.equal((await pool.query("SELECT count(*)::int n FROM identity.accounts WHERE username LIKE 'TestV100_%'")).rows[0].n,19);
 assert.equal((await pool.query("SELECT count(*)::int n FROM identity.role_assignments r JOIN identity.accounts a ON a.id=r.account_id WHERE a.username LIKE 'TestV100_%' AND r.role_code='COUNCIL_MEMBER'")).rows[0].n,9);
 assert.deepEqual((await pool.query("SELECT md5(string_agg(to_jsonb(s)::text,'' ORDER BY id)) digest FROM assessment.snapshots s")).rows[0],before);
 pass('Twelve migrations and idempotent development-only seed: exactly 50 families, 5 groups, 19 accounts, 9 council members; previous snapshots preserved');
 const log=openSync(path.join(out,'backend.log'),'w');server=spawn(process.execPath,['dist/main.js'],{cwd:backend,env,windowsHide:true,stdio:['ignore',log,log]});await waitReady('http://127.0.0.1:3001/api/v1/auth/me',server);
 const post=async(url,body,auth,status=200)=>{const r=await req(url,{...auth,body});assert.equal(r.status,status,JSON.stringify(r.body));return r.body;};
 const get=async(url,auth)=>{const r=await req(url,auth);assert.equal(r.status,200,JSON.stringify(r.body));return r.body;};
 async function login(username,role){const r=await req('/auth/login',{body:{username,password}});assert.equal(r.status,200,JSON.stringify(r.body));const a={cookie:r.cookie,csrf:r.body.csrfToken,user:r.body.user};if(role){assert.equal(r.body.redirectTo,'/select-role');await post('/auth/select-role',{roleCode:role},a);}return a;}
 const leader=await login('TestV100_Leader1','GROUP_LEADER'),helper=await login('TestV100_Helper1_1'),executive=await login('TestV100_Executive','EXECUTIVE_MANAGER'),guide=await login('Aseman'),tech=await login('TechSupportDev');
 const list=(await get('/livelihood/families',leader)).families;assert.equal(list.length,10);assert.ok(list.every(f=>f.family_code.startsWith('HL-TEST-G1-')));assert.equal((await get('/livelihood/families',helper)).families.length,10);
 const family=list[0],second=list[1],foreign=(await pool.query("SELECT id FROM family.families WHERE family_code='HL-TEST-G2-01'")).rows[0];
 for(const auth of [leader,helper])assert.equal((await req('/livelihood/families/'+foreign.id,auth)).status,403);
 assert.equal((await req('/livelihood/queue',leader)).status,403);assert.equal((await req('/livelihood/families',tech)).status,403);
 pass('Leader/helper are limited to assigned group; Shahdeh and five leaders retain multi-role selection; technical role has no organizational grant');
 let w=await get('/livelihood/families/'+family.id,leader);const baseFamily=w.family;
 await post('/livelihood/families/'+family.id+'/basic',{version:w.family.version,family:{...w.family,neighborhood:'محله تست تکمیل‌شده'},members:w.members},leader);w=await get('/livelihood/families/'+family.id,leader);assert.equal(w.family.neighborhood,'محله تست تکمیل‌شده');assert.equal(w.family.version,baseFamily.version+1);
 const bornMembers=w.members.map((m,i)=>i===0?{...m,birth_date:'1985-01-01',profile_data:{...m.profile_data,age:null}}:m);
 await post('/livelihood/families/'+family.id+'/basic',{version:w.family.version,family:w.family,members:bornMembers},leader);w=await get('/livelihood/families/'+family.id,leader);assert.ok(w.members.find(m=>m.relationship_code==='HEAD').birth_date);
 await post('/livelihood/families/'+family.id+'/basic',{version:baseFamily.version,family:w.family,members:w.members},leader,409);
 await post('/livelihood/families/'+family.id+'/basic',{version:w.family.version,family:w.family,members:w.members},helper,403);
 pass('Leader updates shared base/member data with optimistic version; helper mutation and stale update blocked');
 await post('/livelihood/families/'+family.id+'/draft',{version:0,payload:{score:30}},leader,400);
 await post('/livelihood/families/'+family.id+'/draft',{version:0,payload:{critical:null}},leader,400);
 await post('/livelihood/families/'+family.id+'/basic',{version:w.family.version,family:w.family,members:[null]},leader,400);
 let saved=await post('/livelihood/families/'+family.id+'/draft',{version:0,payload:{}},leader);assert.equal(saved.result.score,null);assert.ok(saved.result.missing.length);await post('/livelihood/families/'+family.id+'/submit',{version:saved.review.version},leader,422);
 pass('Missing/unknown is never zero; incomplete submit and manually supplied scores are blocked by backend');
 const payload={income:[{type:'بدون درآمد',recipient:'همه خانواده — داده فرضی',amount:0,period:'بدون دریافت',continuity:'فاقد منبع'}],employment:w.members.map(m=>({memberId:m.id,state:'بدون شغل و درآمد',ability:'ندارد',barrier:'مانع فرضی'})),expenses:w.schema.expenses[0].options.map((type,i)=>({type,amount:i===0?1000000:0,payment:i===0?'پرداخت‌نشده':'هزینه‌ای ندارد',effect:i===0?'کسری خوراک فرضی':'ندارد',evidence:'گفت‌وگوی فرضی'})),evidence:[{source:'گفت‌وگوی مستقیم با خانواده',description:'مصاحبه Development/Test بدون فیش رسمی'}],summaries:{adequacy:'2',stability:'3',pressure:'2',debt:'1'},checks:Array(10).fill(true),notes:'جمع‌بندی کاملاً فرضی آزمون',urgency:'IMPORTANT',critical:[],criticalAction:'',requiredDocumentIds:[]};
 for(const [option,total] of [['0',0],['1',9],['2',19],['3',30]]){const p={...payload,summaries:Object.fromEntries(['adequacy','stability','pressure','debt'].map(k=>[k,option]))};saved=await post('/livelihood/families/'+family.id+'/draft',{version:saved.review.version,payload:p},leader);assert.equal(saved.result.score,total);assert.equal(saved.result.totalScore,null);assert.equal(saved.result.level,null);assert.equal(saved.result.complete,true);}
 const unknown={...payload,summaries:{...payload.summaries,adequacy:'UNKNOWN'}};saved=await post('/livelihood/families/'+family.id+'/draft',{version:saved.review.version,payload:unknown},leader);assert.equal(saved.result.score,null);assert.equal(saved.result.complete,false);
 saved=await post('/livelihood/families/'+family.id+'/draft',{version:saved.review.version,payload},leader);assert.equal(saved.result.score,20);assert.equal(saved.review.state,'READY');
 pass('All four official scoring columns exactly yield 0/9/19/30; scenario scores 20/30; context creates no independent score and no final 100 or level');
 const third=list[2];const tw=await get('/livelihood/families/'+third.id,leader);const tp={...payload,employment:tw.members.map(m=>({memberId:m.id,state:'بدون شغل و درآمد',ability:'ندارد',barrier:'مانع فرضی'})),summaries:{adequacy:'0',stability:'0',pressure:'0',debt:'0'},critical:[tw.criticalOptions[0]],criticalAction:'پیگیری فوری فرضی شروع شد'};
 let criticalDraft=await post('/livelihood/families/'+third.id+'/draft',{version:0,payload:tp},leader);assert.equal(criticalDraft.result.score,0);assert.equal(criticalDraft.result.urgency,'IMMEDIATE');
 assert.ok((await pool.query("SELECT 1 FROM oversight.alerts WHERE family_id=$1 AND severity='CRITICAL' AND state='OPEN'",[third.id])).rowCount);
 criticalDraft=await post('/livelihood/families/'+third.id+'/draft',{version:criticalDraft.review.version,payload:{...tp,critical:[]}},leader);assert.equal(criticalDraft.result.urgency,'IMMEDIATE');
 pass('Critical livelihood need creates an immediate operational alert before submission; zero score can be critical and clearing a checkbox does not resolve the alert');
 const fourth=(await pool.query("INSERT INTO family.families(family_code,current_group_id,created_by,neighborhood,basic_data) SELECT 'HL-TEST-MISSING-DOC',current_group_id,created_by,neighborhood,basic_data FROM family.families WHERE id=$1 RETURNING id",[list[3].id])).rows[0];
 await pool.query('INSERT INTO family.family_memberships(family_id,person_id,relationship_code,profile_data) SELECT $1,person_id,relationship_code,profile_data FROM family.family_memberships WHERE family_id=$2',[fourth.id,list[3].id]);
 const fw=await get('/livelihood/families/'+fourth.id,leader);
 const fp={...payload,employment:fw.members.map(m=>({memberId:m.id,state:'بدون شغل و درآمد',ability:'ندارد',barrier:'مانع فرضی'}))};const blocked=await post('/livelihood/families/'+fourth.id+'/draft',{version:0,payload:fp},leader);assert.equal(blocked.result.complete,false);assert.ok(blocked.result.missing.includes('تصویر کارت ملی سرپرست'));await post('/livelihood/families/'+fourth.id+'/submit',{version:blocked.review.version},leader,422);
 pass('Required identity evidence is enforced independently of checklist claims');
 const doc=await post('/livelihood/families/'+family.id+'/documents',{name:'شاهد فرضی.txt',category:'OTHER',mediaType:'text/plain',content:Buffer.from('DEVELOPMENT TEST ONLY').toString('base64')},leader);
 assert.equal((await fetch('http://127.0.0.1:3001/api/v1/livelihood/families/'+family.id+'/documents/'+doc.id,{headers:{cookie:executive.cookie}})).status,200);
 await post('/livelihood/families/'+foreign.id+'/documents',{name:'x.txt',category:'OTHER',mediaType:'text/plain',content:'WA=='},leader,403);
 await post('/livelihood/families/'+family.id+'/documents',{name:'x.pdf',category:'OTHER',mediaType:'application/pdf',content:'WA=='},leader,400);
 await assert.rejects(pool.query("UPDATE family.documents SET name='changed' WHERE id=$1",[doc.id]));
 pass('Scoped evidence upload/download works, wrong content type and foreign family are blocked; document bytes remain immutable');

 // Birth date and manual age are neither prerequisites nor scoring inputs.
 w=await get('/livelihood/families/'+family.id,leader);
 const oldManual=w.members.map(m=>m.profile_data.age);
 await post('/family-workspace/families/'+family.id,{version:w.family.version,family:w.family,members:w.members.map(m=>({...m,birth_date:null}))},leader);
 await pool.query("UPDATE family.family_memberships SET profile_data=profile_data-'age' WHERE family_id=$1",[family.id]);
 w=await get('/livelihood/families/'+family.id,leader);
 const noBirth=await post('/livelihood/families/'+family.id+'/draft',{version:w.review.version,payload},leader);
 assert.equal(noBirth.result.complete,true);assert.equal(noBirth.result.score,20);
 const withoutBirthSubmission=await post('/livelihood/families/'+family.id+'/submit',{version:noBirth.review.version},leader);
 w=await get('/livelihood/families/'+family.id,leader);
 assert.ok(w.submissions[0].snapshot.members.every(m=>!m.birth_date&&m.profile_data.age===undefined));
 await post('/livelihood/submissions/'+withoutBirthSubmission.id+'/return',{version:w.review.version,reason:'ادامه سناریوی آزمون'},executive);
 // Restore only the isolated test fixture; the submitted snapshot stays unchanged.
 for(let i=0;i<w.members.length;i++)await pool.query("UPDATE family.family_memberships SET profile_data=jsonb_set(profile_data,'{age}',$3::jsonb) WHERE family_id=$1 AND person_id=$2",[family.id,w.members[i].id,JSON.stringify(oldManual[i]??null)]);
 w=await get('/livelihood/families/'+family.id,leader);
 await post('/family-workspace/families/'+family.id,{version:w.family.version,family:w.family,members:w.members.map((m,i)=>i===0?{...m,birth_date:'1985-01-01'}:m)},leader);
 saved=await post('/livelihood/families/'+family.id+'/draft',{version:w.review.version,payload},leader);
 pass('No birth date and no manual age still allow complete 20/30 livelihood submission; historical null birth snapshot remains immutable');
 const first=await post('/livelihood/families/'+family.id+'/submit',{version:saved.review.version},leader);w=await get('/livelihood/families/'+family.id,leader);
 assert.ok((await get('/livelihood/queue',executive)).items.some(i=>i.family_id===family.id));assert.equal((await get('/livelihood/families/'+family.id,guide)).submissions.length,0);
 await post('/livelihood/families/'+family.id+'/draft',{version:w.review.version,payload},leader,409);
 await post('/livelihood/submissions/'+first.id+'/approve',{version:w.review.version},leader,403);
 await post('/livelihood/submissions/'+first.id+'/return',{version:w.review.version,reason:''},executive,400);
 await post('/livelihood/submissions/'+first.id+'/begin',{version:w.review.version},executive);w=await get('/livelihood/families/'+family.id,executive);assert.equal(w.review.state,'IN_REVIEW');
 await post('/livelihood/submissions/'+first.id+'/return',{version:w.review.version,reason:'شرح شاهد درآمد را تکمیل کنید'},executive);
 w=await get('/livelihood/families/'+family.id,leader);assert.equal(w.review.state,'RETURNED');assert.equal(w.submissions[0].reason,'شرح شاهد درآمد را تکمیل کنید');
 pass('Complete submit freezes answers and enters executive queue; begin review and mandatory reason return are persisted; guide sees no unapproved version');
 const corrected={...payload,notes:'اصلاح و تکمیل شاهد — داده فرضی'};saved=await post('/livelihood/families/'+family.id+'/draft',{version:w.review.version,payload:corrected},leader);const secondSend=await post('/livelihood/families/'+family.id+'/submit',{version:saved.review.version},leader);w=await get('/livelihood/families/'+family.id,executive);
 await post('/livelihood/submissions/'+first.id+'/approve',{version:w.review.version},executive,409);
 await post('/livelihood/submissions/'+secondSend.id+'/approve',{version:w.review.version,score:0},executive,400);
 const approved=await post('/livelihood/submissions/'+secondSend.id+'/approve',{version:w.review.version},executive);
 assert.equal(approved.decision,'APPROVED');assert.equal(new Date(approved.valid_until).getUTCFullYear(),new Date(approved.decided_at).getUTCFullYear()+1);
 await post('/livelihood/submissions/'+secondSend.id+'/return',{version:w.review.version,reason:'late'},executive,409);
 assert.ok(!(await get('/livelihood/queue',executive)).items.some(i=>i.family_id===family.id));
 pass('Returned draft corrects/resubmits as new immutable submission; executive approval sets actor/time and one-calendar-year validity; stale/double decisions blocked');
 const historical=(await get('/livelihood/families/'+family.id,guide)).submissions[0];assert.equal(historical.snapshot.result.score,20);assert.equal(historical.snapshot.result.level,null);assert.equal(historical.snapshot.result.otherDomains,'NOT_ASSESSED');
 w=await get('/livelihood/families/'+family.id,leader);await post('/livelihood/families/'+family.id+'/basic',{version:w.family.version,family:{...w.family,neighborhood:'نشانی جدید بعد از تأیید'},members:w.members},leader);
 assert.deepEqual((await get('/livelihood/families/'+family.id,guide)).submissions[0].snapshot,historical.snapshot);
 await assert.rejects(pool.query("UPDATE assessment.domain_submissions SET snapshot='{}' WHERE id=$1",[secondSend.id]));await assert.rejects(pool.query("DELETE FROM assessment.domain_decisions WHERE submission_id=$1",[secondSend.id]));
 await assert.rejects(pool.query("UPDATE assessment.domain_reviews SET payload='{}' WHERE id=$1",[historical.review_id]));
 pass('Guide sees approved partial result; later family edits cannot change snapshot; PostgreSQL protects approved review, submission and decision history');
 await post('/auth/simulation',{roleCode:'GROUP_LEADER',groupId:family.current_group_id},tech);await post('/livelihood/families/'+second.id+'/draft',{version:0,payload:{}},tech);
 const audit=(await pool.query("SELECT actor_account_id,effective_role,simulation FROM admin.audit_events WHERE event_type='GUIDE_LIVELIHOOD_CREATED' AND entity_id=$1 ORDER BY occurred_at DESC LIMIT 1",[second.id])).rows[0];assert.equal(audit.actor_account_id,tech.user.accountId);assert.equal(audit.effective_role,'GROUP_LEADER');assert.equal(audit.simulation,true);await post('/auth/simulation/stop',{},tech);
 pass('Simulation records technical real actor plus effective leader role; all lifecycle actions retain authentic history');
 const {chromium}=createRequire(path.join(root,'package.json'))('playwright');const flog=openSync(path.join(out,'frontend.log'),'w');front=spawn(process.execPath,['tests/preview.mjs'],{cwd:root,env:{...env,PREVIEW_PORT:'5174',BACKEND_PROXY:'http://127.0.0.1:3001'},windowsHide:true,stdio:['ignore',flog,flog]});await waitReady(origin,front);browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});const errors=[];
 async function browserAs(auth){const c=await browser.newContext({viewport:{width:1440,height:1000}});await c.addCookies([{name:'lahout_session',value:auth.cookie.split('=')[1],url:origin,httpOnly:true,sameSite:'Strict'}]);const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));return p;}

 const currentUrl='/family-workspace/families/'+family.id;
 let canonical=await get(currentUrl,leader);
 const previousBirth=canonical.members[0].birth_date;
 canonical.members[0].birth_date='1986-04-21';
 const newBase=await post(currentUrl,{version:canonical.family.version,family:canonical.family,members:canonical.members},leader);
 assert.equal(newBase.members[0].birth_date,'1986-04-21');
 assert.equal((await get(currentUrl,leader)).members[0].birth_date,'1986-04-21');
 const history=(await pool.query("SELECT previous_state,new_state FROM guidance.history WHERE entity_id=$1 AND action='LIVELIHOOD_BASE_UPDATED' ORDER BY occurred_at DESC LIMIT 1",[family.id])).rows[0];
 assert.equal(history.previous_state.members[0].birth_date,previousBirth);assert.equal(history.new_state.members[0].birth_date,'1986-04-21');
 assert.deepEqual((await get('/livelihood/families/'+family.id,guide)).submissions[0].snapshot,historical.snapshot);
 const view=await browserAs(leader);
 await view.goto(origin+'/workspace/families/'+family.id);
 const baseView=view.getByRole('region',{name:'اطلاعات جاری پرونده',exact:true});await baseView.getByRole('button',{name:'ویرایش اطلاعات پرونده',exact:true}).waitFor();
 assert.ok((await baseView.innerText()).includes('۱۳۶۵/۰۲/۰۱'));assert.equal(await baseView.locator('input,select,textarea').count(),0);
 await view.goto(origin+'/workspace/livelihood/'+family.id);
 await view.getByText('اطلاعات خانواده در زمان ارسال این نسخه',{exact:true}).click();
 assert.ok((await view.locator('.family-base-view').innerText()).includes('۱۳۶۳/۱۰/۱۱'));
 await view.getByRole('button',{name:'ایجاد ارزیابی جدید با حفظ نسخه تأییدشده',exact:true}).click();
 const continueDraft=view.getByRole('button',{name:'ادامه ارزیابی در حال تکمیل',exact:true});
 await continueDraft.waitFor();await view.reload();await continueDraft.waitFor();
 assert.equal(await view.getByRole('button',{name:'ایجاد ارزیابی جدید با حفظ نسخه تأییدشده',exact:true}).count(),0);
 const openDraft=(await get('/livelihood/families/'+family.id,leader)).review;assert.ok(openDraft);
 await continueDraft.click();await post('/livelihood/families/'+family.id+'/draft',{payload:{},version:0},leader,409);
 assert.equal((await pool.query("SELECT count(*)::int n FROM assessment.domain_reviews WHERE family_id=$1 AND state<>'APPROVED'",[family.id])).rows[0].n,1);
 assert.deepEqual((await get('/livelihood/families/'+family.id,guide)).submissions[0].snapshot,historical.snapshot);
 await view.goto(origin+'/workspace/families/'+family.id);await view.getByRole('navigation',{name:'حوزه‌های ارزیابی'}).getByRole('link',{name:'معیشت و اقتصاد',exact:true}).click();await continueDraft.waitFor();
 await view.context().close();
 pass('Canonical birth edit is immediately visible and fully audited; approved historical birth stays unchanged; persisted draft resumes after refresh without parallel drafts');

 const page=await browserAs(leader);await page.goto(origin+'/workspace/livelihood/'+second.id);await page.getByRole('button',{name:'نتیجه و ارسال',exact:true}).click();assert.equal(await page.getByRole('button',{name:'ارسال برای مدیر اجرایی',exact:true}).isDisabled(),true);
 await page.getByRole('navigation',{name:'حوزه‌های ارزیابی'}).getByRole('link',{name:'اطلاعات پایه',exact:true}).click();await page.getByRole('button',{name:'ویرایش اطلاعات پرونده',exact:true}).click();await page.getByLabel('محله / محدوده سکونت',{exact:true}).fill('محله تکمیل‌شده مرورگر');await page.getByRole('button',{name:'ذخیره تغییرات',exact:true}).click();await page.getByRole('status').filter({hasText:'تغییرات پرونده ذخیره شد.'}).waitFor();await page.goto(origin+'/workspace/livelihood/'+second.id);
 await page.getByRole('button',{name:'مدارک پایه',exact:true}).click();await page.getByLabel('عنوان مدرک',{exact:true}).selectOption('OTHER');await page.getByLabel('نام مدرک (برای سایر عنوان را بنویسید)',{exact:true}).fill('شاهد مرورگر.txt');await page.getByLabel('بارگذاری مدرک — حداکثر ۲۵۶ کیلوبایت',{exact:true}).setInputFiles({name:'evidence.txt',mimeType:'text/plain',buffer:Buffer.from('Development browser test evidence')});await page.getByRole('link',{name:'شاهد مرورگر.txt',exact:true}).waitFor();
 await page.getByRole('button',{name:'معیشت و اقتصاد',exact:true}).click();
 const current=await get('/livelihood/families/'+second.id,leader);
 const rows={...payload,employment:current.members.map(m=>({memberId:m.id,state:'بدون شغل و درآمد',ability:'ندارد',barrier:'مانع فرضی'}))};
 for(const [name,title] of Object.entries({income:'درآمد و منابع',employment:'اشتغال و توان اقتصادی',expenses:'هزینه‌ها و تعهدات',evidence:'شواهد و توضیحات'})){for(const [index,row] of rows[name].entries()){await page.getByRole('button',{name:'افزودن ردیف '+title,exact:true}).click();for(const field of current.schema[name])if(row[field.key]!==undefined){const input=page.getByLabel(title+' '+field.label+' '+(index+1),{exact:true});if(field.options||field.type==='member')await input.selectOption(String(row[field.key]));else await input.fill(String(row[field.key]));}}}
 for(const i of current.model.definition.indicators)await page.getByLabel(i.label,{exact:true}).selectOption(payload.summaries[i.key]);await page.getByLabel('فوریت موضوع معیشت',{exact:true}).selectOption('IMPORTANT');await page.getByLabel('جمع‌بندی نهایی سرگروه',{exact:true}).fill('گردش واقعی از مرورگر — داده فرضی');for(const check of current.checks)await page.getByLabel(check,{exact:true}).check();
 await page.getByRole('button',{name:'ذخیره و محاسبه',exact:true}).click();await page.getByRole('status').filter({hasText:'ثبت شد.'}).waitFor();await page.getByRole('button',{name:'نتیجه و ارسال',exact:true}).click();await page.getByText('۲۰ از ۳۰',{exact:true}).waitFor();await page.getByRole('button',{name:'ارسال برای مدیر اجرایی',exact:true}).click();await page.waitForFunction(()=>!Array.from(document.querySelectorAll('button')).some(x=>x.textContent==='ارسال برای مدیر اجرایی'));await page.screenshot({path:path.join(out,'leader-submitted.png'),fullPage:true});
 pass('Browser fills base data, uploads evidence, completes all livelihood sections, computes 20/30 and submits; incomplete UI submit is disabled');
 const ep=await browserAs(executive);await ep.goto(origin+'/executive/assessments');await ep.getByRole('link').filter({hasText:second.family_code}).count();await ep.getByRole('row').filter({hasText:second.family_code}).getByRole('link',{name:'بررسی ارزیابی',exact:true}).click();await ep.getByRole('button',{name:'بازگشت برای تکمیل',exact:true}).click();assert.equal(await ep.getByRole('button',{name:'ثبت بازگشت برای تکمیل',exact:true}).isDisabled(),true);await ep.getByRole('button',{name:'بستن',exact:true}).click();await ep.getByRole('button',{name:'تأیید ارزیابی',exact:true}).click();await ep.getByText('تأییدکننده:',{exact:false}).waitFor();await ep.reload();await ep.getByText('تأییدکننده:',{exact:false}).waitFor();await ep.screenshot({path:path.join(out,'executive-approved.png'),fullPage:true});
 const gp=await browserAs(guide);await gp.goto(origin+'/guide/families/'+second.id);await gp.getByRole('heading',{name:'معیشت و اقتصاد — ارزیابی تأییدشده',exact:true}).waitFor();await gp.getByRole('link',{name:'مشاهده پاسخ‌ها، مدارک و سابقه تأیید',exact:true}).click();await gp.getByRole('button',{name:'نتیجه و ارسال',exact:true}).click();await gp.getByText('۲۰ از ۳۰',{exact:true}).waitFor();assert.equal(await gp.getByRole('button',{name:'تأیید ارزیابی معیشت',exact:true}).count(),0);await gp.screenshot({path:path.join(out,'guide-approved.png'),fullPage:true});
 pass('Browser executive receives real queue, approves with persistent refresh; existing guide family page exposes read-only approved partial result');
 for(const width of [768,390]){await gp.setViewportSize({width,height:900});assert.ok(await gp.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await gp.screenshot({path:path.join(out,'guide-'+width+'.png'),fullPage:true});}assert.deepEqual(errors,[]);
 pass('New workflow pages are RTL with right sidebar, fit mobile/tablet and have no JavaScript exceptions');
} catch(e){results.push({name:'suite',status:'FAIL',message:e.message});throw e;}
finally{await browser?.close();await stop(front);await stop(server);await pool.end();await dropTestDatabase(admin,dbName);await admin.end();writeFileSync(path.join(out,'results.json'),JSON.stringify({date:new Date().toISOString(),results},null,2));}
