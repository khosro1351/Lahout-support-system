import {testFamilyReadSlice} from './family-read-slice.mjs';
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
 assert.equal((await pool.query('SELECT count(*)::int n FROM core.schema_migrations')).rows[0].n,17);assert.equal((await pool.query('SELECT count(*)::int n FROM family.families')).rows[0].n,9);assert.equal((await pool.query('SELECT count(*)::int n FROM assessment.snapshots')).rows[0].n,9);
 run('.tools/scripts/seed-family-read-dev.js');run('.tools/scripts/seed-family-read-dev.js');run('.tools/scripts/seed-family-read-dev.js',{APP_ENV:'production'},1);run('.tools/scripts/seed-guide-dev.js',{APP_ENV:'production'},1);pass('Fifteen additive migrations, repeatable Persian development fixtures and nine versioned assessments');
 const backendLog=openSync(path.join(out,'backend.log'),'w');server=spawn(process.execPath,['dist/main.js'],{cwd:backend,env,windowsHide:true,stdio:['ignore',backendLog,backendLog]});await waitReady('http://127.0.0.1:3001/api/v1/auth/me',server);
 async function login(username){const r=await req('/auth/login',{body:{username,password}});assert.equal(r.status,200,JSON.stringify(r.body));return {cookie:r.cookie,csrf:r.body.csrfToken,user:r.body.user};}
 const guide=await login('Aseman'),leader=await login('ReviewLeader1'),helper=await login('ReviewHelper11');
 const selected=await req('/auth/select-role',{...leader,body:{roleCode:'GROUP_LEADER'}});assert.equal(selected.status,200);leader.user=selected.body.user;
 const get=async(url,auth=guide)=>{const r=await req(url,auth);assert.equal(r.status,200,JSON.stringify(r.body));return r.body;};
 const post=async(url,body,auth=guide,expected=200)=>{const r=await req(url,{...auth,body});assert.equal(r.status,expected,JSON.stringify(r.body));return r.body;};
 const people=(await get('/review/people?page=1')).people;assert.equal(people.length,10);const familyPeople=(await pool.query('SELECT person_id FROM family.family_memberships')).rows.map(r=>r.person_id);assert.ok(!people.some(p=>familyPeople.includes(p.id)));assert.ok(people.every(p=>/^[\u0600-\u06ff\s]+$/.test(p.first_name+' '+p.last_name)));assert.ok(!(await get('/guide/metadata')).roles.some(r=>r.code==='SUPREME_GUIDE'));pass('People contains only organizational persons; Persian names and guide exclusion');
 const hp=people.find(p=>p.account_id===helper.user.accountId),role=await post('/guide/people/'+hp.id+'/assign',{role:'COUNCIL_MEMBER'});await post('/guide/people/'+hp.id+'/end-role',{assignmentId:role.id});const ph=(await get('/review/people/'+hp.id)).history;assert.ok(ph.some(h=>h.action==='ROLE_ASSIGNED'));assert.ok(ph.some(h=>h.action==='ROLE_ENDED'));pass('Assignment and end responsibility retain authentic actor/time history');
 const groups=(await get('/oversight/groups')).groups,g1=groups.find(g=>Number(g.group_number)===1).group_id,g2=groups.find(g=>Number(g.group_number)===2).group_id;
 const family=(await get('/shared/groups/'+g1)).families[0],fid=family.family_id;
 assert.equal((await req('/shared/groups/'+g2,helper)).status,403);
 const workspace=await get('/shared/families/'+fid+'/assessments',leader),members=workspace.members,model=workspace.model.definition;
 function answers(severity=0,educationApplicable=true){return Object.fromEntries(Object.entries(model.domains).map(([key,d])=>{const summaries=Object.fromEntries(Object.entries(d.indicators).map(([k,v])=>[k,Object.keys(v.responses).sort((a,b)=>v.responses[a].points-v.responses[b].points)[Math.min(severity,Object.keys(v.responses).length-1)]]));const ms=members.map((m,i)=>({id:m.id,status:severity?'AFFECTED':'NO_PROBLEM',eligible:educationApplicable&&i===0,details:{description:'اطلاعات آزمون',studyStatus:'در حال تحصیل',futureRisk:'خطر وجود ندارد'}}));const screen=workspace.model.form_schema[key].find(s=>s.screen);return [key,{summaries,critical:Object.fromEntries(model.criticalRules.filter(r=>r.domain===key).map(r=>[r.code,false])),members:ms,sections:screen?{[screen.key]:ms.map(m=>({...m,...m.details}))}:{},notes:'شواهد آزمون'}];}));}
 const {evaluate}=require('./.tools/src/oversight/scoring.js');
 let a=answers();let r=evaluate(model,a,members.map(m=>m.id));assert.equal(r.score,0);assert.equal(r.level,'D');assert.equal(r.domains.health.score,0);assert.equal(r.domains.health.state,'COMPLETE');assert.equal(r.domains.education.score,0);
 a=answers(1,false);r=evaluate(model,a,members.map(m=>m.id));assert.equal(r.applicableWeight,85);assert.equal(r.domains.education.state,'NOT_APPLICABLE');assert.ok(Math.abs(r.score-(9+5+5+4)/85*100)<0.000001);
 pass('Zero is valid; healthy members yield zero health; education N/A normalizes to 85');
 a=answers(3,true);r=evaluate(model,a,members.map(m=>m.id));assert.equal(r.domains.livelihood.score,30);assert.equal(r.domains.housing.score,17);assert.equal(r.domains.vulnerability.score,15);assert.equal(r.domains.education.score,15);assert.equal(r.criticalFlags.length,0);
 a=answers();a.livelihood.critical.LIVELIHOOD_BASIC=true;r=evaluate(model,a,members.map(m=>m.id));assert.equal(r.score,0);assert.ok(r.criticalFlags.some(f=>f.code==='LIVELIHOOD_BASIC'));pass('Approved domain tables calculate exactly; high score alone creates no critical flag; low score can be critical');
 a=answers();delete a.housing.summaries.quality;r=evaluate(model,a,members.map(m=>m.id));assert.equal(r.state,'PROVISIONAL');assert.equal(r.score,null);assert.equal(r.applicableWeight,100);
 a=answers();a.vulnerability.facts={sameImpactAsHealth:true};assert.equal(evaluate(model,a,members.map(m=>m.id)).state,'PROVISIONAL');
 a=answers(3);a.education.members.forEach(m=>{if(m.eligible)m.details.studyStatus='ترک تحصیل';});r=evaluate(model,a,members.map(m=>m.id));assert.equal(r.domains.education.breakdown.find(x=>x.label.includes('خطر آینده')).points,0);pass('Unknown prevents finalization, duplicate medical impact is flagged, current dropout does not score as future risk');
 const payload={answers:answers(),urgency:'NON_URGENT'};await post('/shared/families/'+fid+'/draft',{payload},guide,403);await post('/shared/families/'+fid+'/draft',{payload},helper,403);await post('/shared/families/'+fid+'/draft',{payload:{...payload,score:100}},leader,400);
 let draft=await post('/shared/families/'+fid+'/draft',{payload},leader);draft=await post('/shared/families/'+fid+'/draft',{payload,version:draft.version},leader);await post('/shared/families/'+fid+'/draft',{payload,version:1},leader,409);
 const snapshot=await post('/shared/families/'+fid+'/assessments',{payload,draftId:draft.id,version:draft.version},leader);assert.equal(snapshot.state,'FINAL');const serialized=JSON.stringify(snapshot.members);await pool.query("UPDATE identity.people SET first_name='نام تغییرکرده' WHERE id=$1",[members[0].id]);assert.equal(JSON.stringify((await pool.query('SELECT members FROM assessment.snapshots WHERE id=$1',[snapshot.id])).rows[0].members),serialized);
 await assert.rejects(pool.query('UPDATE assessment.snapshots SET score=99 WHERE id=$1',[snapshot.id]));await assert.rejects(pool.query("UPDATE assessment.models SET definition='{}' WHERE id=$1",[workspace.model.id]));
 pass('Leader draft/save/submit with optimistic version; guide/helper edits blocked; manual scores rejected; immutable historical members/model');
 const evidence=await post('/shared/families/'+fid+'/evidence',{name:'شاهد آزمون.txt',mediaType:'text/plain',content:Buffer.from('شاهد ثبت‌شده').toString('base64')},leader);await post('/shared/families/'+fid+'/evidence',{name:'نامعتبر.txt',mediaType:'text/plain',content:'YWJj'},guide,403);
 const evidenced=await post('/shared/families/'+fid+'/assessments',{answers:answers(),urgency:'NON_URGENT',evidence:[evidence.id]},leader);assert.equal(evidenced.evidence[0].name,'شاهد آزمون.txt');await assert.rejects(pool.query("UPDATE family.documents SET name='تغییر' WHERE id=$1",[evidence.id]));
 pass('Evidence upload restricted to responsible leader, immutable document and versioned snapshot evidence');
 const technical=await post('/guide/people/'+hp.id+'/assign',{role:'TECH_ADMIN'});const newer=(await pool.query("INSERT INTO assessment.models(version,title,definition,form_schema) VALUES('1.1','نسخه آزمون چرخه انتشار',$1,$2) RETURNING id",[JSON.stringify(model),JSON.stringify(workspace.model.form_schema)])).rows[0];await post('/auth/select-role',{roleCode:'TECH_ADMIN'},helper);await post('/shared/models/'+newer.id+'/transition',{state:'ACTIVE'},helper,409);await post('/shared/models/'+newer.id+'/transition',{state:'APPROVED'},helper);await post('/shared/models/'+newer.id+'/transition',{state:'ACTIVE'},helper);assert.equal((await pool.query('SELECT model_id FROM assessment.snapshots WHERE id=$1',[snapshot.id])).rows[0].model_id,workspace.model.id);assert.equal((await pool.query('SELECT state FROM assessment.models WHERE id=$1',[workspace.model.id])).rows[0].state,'RETIRED');await post('/guide/people/'+hp.id+'/end-role',{assignmentId:technical.id});await post('/auth/select-role',{roleCode:'HELPER'},helper);
 pass('Model draft-approved-active-retired transitions preserve historical model links');

 a=answers();a.livelihood.critical.LIVELIHOOD_BASIC=true;await post('/shared/families/'+fid+'/assessments',{answers:a,urgency:'NON_URGENT'},leader);await post('/shared/families/'+fid+'/assessments',{answers:a,urgency:'NON_URGENT'},leader);
 assert.equal((await pool.query("SELECT count(*)::int n FROM oversight.alerts WHERE family_id=$1 AND rule_code='LIVELIHOOD_BASIC'",[fid])).rows[0].n,1);let alert=(await get('/shared/alerts?family='+fid)).alerts.find(a=>a.rule_code==='LIVELIHOOD_BASIC');
 await get('/shared/alerts?family='+fid);assert.equal((await get('/shared/alerts?family='+fid)).alerts.find(a=>a.id===alert.id).state,'OPEN');
 await post('/shared/alerts/'+alert.id+'/progress',{state:'ACKNOWLEDGED'},guide,403);await post('/cases/alerts/'+alert.id+'/resolve',{result:'نامعتبر',actionCompleted:true},guide,410);
 await post('/shared/alerts/'+alert.id+'/progress',{state:'ACKNOWLEDGED'},leader);await post('/shared/alerts/'+alert.id+'/progress',{state:'IN_PROGRESS'},leader);await post('/shared/alerts/'+alert.id+'/progress',{state:'RESOLVED',actionCompleted:true,result:'نتیجه'},leader,400);
 await post('/shared/families/'+fid+'/assessments',{answers:answers(),urgency:'NON_URGENT'},leader);alert=(await get('/shared/alerts?family='+fid)).alerts.find(a=>a.id===alert.id);assert.equal(alert.trigger_detected,false);assert.equal(alert.state,'IN_PROGRESS');
 await post('/shared/alerts/'+alert.id+'/progress',{state:'RESOLVED',actionCompleted:true,action:'خوراک ضروری تأمین شد',result:'نیاز فوری رفع شد'},leader);pass('Alert dedup, observation, owner-only lifecycle, explicit result and no automatic resolution after trigger disappearance');
 await post('/cases/families/'+fid+'/transfer',{sourceGroupId:g1,targetGroupId:g2});const transferred=await get('/shared/families/'+fid);const history=transferred.history.find(h=>h.action==='FAMILY_TRANSFERRED');assert.ok(history.description.includes('گروه ۱'));assert.ok(history.description.includes('گروه ۲'));assert.equal(history.new_state.from_group_id,g1);assert.equal(history.new_state.to_group_id,g2);assert.equal((await req('/shared/families/'+fid,leader)).status,403);pass('Family transfer preserves source/target actor/time and updates authorization');
 const dash=await get('/oversight/dashboard');assert.equal(dash.families.active,9);assert.equal(dash.groups.active,3);assert.ok(dash.families.incomplete>=1);
 const council=(await get('/oversight/council?q='+encodeURIComponent('مصوبه'))).items;assert.ok(council.length);const c=council[0];assert.equal((await get('/oversight/council?q='+encodeURIComponent(c.creator))).items.length,1);await post('/review/council/'+c.id+'/intervention',{action:'STOP',version:1},guide,410);await post('/verification/requests',{personId:hp.id,subject:'قدیمی',explanation:'قدیمی'},guide,410);pass('Real managerial summary; searchable final council archive; former intervention and permission writes retired');
 for(const section of ['families','supports','continuous','groups','plans']){const report=await get('/oversight/reports/'+section);assert.ok(report.columns.length<=9);assert.ok(!report.columns.some(c=>/(^id$|_id$|json|debug|performance)/.test(c.key)));assert.ok(report.rows.length);}
 const report=await get('/oversight/reports/families?group='+g2);assert.ok(report.rows.length>=4);
 await post('/oversight/reports/export',{section:'families',format:'pdf'},guide,400);await post('/oversight/reports/export',{section:'families',format:'xlsx',fields:['family_id']},guide,400);
 const preview=await post('/oversight/reports/export',{section:'families',format:'preview'});assert.ok(!/"group"|family_id|health|housing|[a-f0-9]{8}-[a-f0-9]{4}-/.test(preview.html));
 const xlsx=await fetch('http://127.0.0.1:3001/api/v1/oversight/reports/export',{method:'POST',headers:{origin,cookie:guide.cookie,'x-csrf-token':guide.csrf,'content-type':'application/json'},body:JSON.stringify({section:'families',format:'xlsx'})});assert.equal(xlsx.status,200);const bytes=Buffer.from(await xlsx.arrayBuffer());assert.equal(bytes.subarray(0,2).toString(),'PK');writeFileSync(path.join(out,'management-report.xlsx'),bytes);pass('Managerial report templates, drill-down, technical-field exclusion, real XLSX and disabled PDF');
 const fl=openSync(path.join(out,'frontend.log'),'w');front=spawn(process.execPath,['tests/preview.mjs'],{cwd:root,env:{...env,PREVIEW_PORT:'5174',BACKEND_PROXY:'http://127.0.0.1:3001'},windowsHide:true,stdio:['ignore',fl,fl]});await waitReady(origin,front);
 const {chromium}=require('playwright');browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 async function browserLogin(p,username){await p.goto(origin+'/login');await p.locator('#username').fill(username);await p.locator('#password').fill(password);await p.locator('#password').press('Enter');await p.waitForURL(username==='Aseman'?'**/guide':'**/select-role');if(username!=='Aseman'){await p.getByRole('button',{name:/^♙?\s*سرگروه/}).click();await p.waitForURL('**/leader');}}
 await browserLogin(page,'Aseman');await testFamilyReadSlice({page,origin,get,req,guide,leader,pool,out,pass});await page.goto(origin+'/guide');await page.locator('.slice-tile').first().waitFor();assert.equal(await page.locator('.slice-module').count(),4);assert.equal(await page.getByRole('link',{name:/درخواست دسترسی|مجوز منتظر/}).count(),0);await page.screenshot({path:path.join(out,'guide-dashboard.png'),fullPage:true});
 await page.goto(origin+'/guide/people');await page.locator('tbody tr').first().waitFor();assert.equal(await page.locator('tbody tr').count(),10);await page.goto(origin+'/guide/people/'+hp.id);await page.getByLabel('نوع تغییر',{exact:true}).selectOption('END');await page.getByLabel('مسئولیت فعلی',{exact:true}).waitFor();assert.equal(await page.getByLabel('مسئولیت جدید',{exact:true}).count(),0);pass('Browser dashboard four modules, Persian organizational people and separate end-responsibility selection');
 await page.goto(origin+'/guide/groups/'+g2);await page.locator('tbody tr').first().waitFor();await page.locator('tbody tr').first().hover();assert.equal(await page.locator('tr[aria-selected=true]').count(),0);await page.locator('tbody tr').first().click();await page.locator('h1').click();assert.equal(await page.locator('tr[aria-selected=true]').count(),1);await page.getByRole('button',{name:'لغو انتخاب',exact:true}).click();assert.equal(await page.locator('tr[aria-selected=true]').count(),0);await page.screenshot({path:path.join(out,'group-families.png'),fullPage:true});
 await page.goto(origin+'/guide/families/'+fid+'/assessments');await page.getByText('مشاهده پاسخ‌ها و نتیجه نسخه',{exact:true}).click();await page.locator('.assessment-domain').first().waitFor();assert.equal(await page.locator('.assessment-domain').count(),5);assert.equal(await page.getByRole('button',{name:'ذخیره پیش‌نویس'}).count(),0);assert.ok(await page.locator('.assessment-result').count());await page.screenshot({path:path.join(out,'assessment-guide.png'),fullPage:true});pass('Browser persistent family selection with explicit deselect; guide uses shared five-domain read-only form');
 const leaderFamily=(await get('/shared/groups/'+g1)).families[0];const leaderContext=await browser.newContext({viewport:{width:1280,height:900}}),lp=await leaderContext.newPage();lp.on('pageerror',e=>errors.push(e.message));await browserLogin(lp,'ReviewLeader1');await lp.goto(origin+'/workspace/families/'+leaderFamily.family_id+'/assessments');await lp.getByRole('button',{name:'ذخیره پیش‌نویس'}).waitFor();await lp.getByLabel('فوریت مستقل خانواده',{exact:true}).selectOption('IMPORTANT');await lp.getByRole('button',{name:'ذخیره پیش‌نویس',exact:true}).click();await lp.waitForTimeout(500);await lp.reload();await lp.getByRole('button',{name:'ذخیره پیش‌نویس'}).waitFor();assert.equal(await lp.getByLabel('فوریت مستقل خانواده',{exact:true}).inputValue(),'IMPORTANT');assert.equal(await lp.locator('.assessment-domain').count(),5);pass('Browser leader shared form creates and reloads a persistent draft without manual score fields');
 await lp.locator('.assessment-domain').count();
 for(const select of await lp.locator('.assessment-domain select').all()){const options=await select.locator('option').evaluateAll(os=>os.map(o=>({value:o.value,text:o.textContent})));if(options.some(o=>o.value==='NO_PROBLEM'))await select.selectOption('NO_PROBLEM');else if(options.some(o=>o.text==='فاقد مشکل مؤثر'))await select.selectOption({label:'فاقد مشکل مؤثر'});else if(options.some(o=>o.value==='false'))await select.selectOption('false');}
 await lp.getByRole('button',{name:'ثبت نسخه ارزیابی و محاسبه',exact:true}).click();await lp.waitForTimeout(700);await lp.reload();await lp.getByLabel('نسخه ارزیابی',{exact:true}).waitFor();const latest=(await get('/shared/families/'+leaderFamily.family_id+'/assessments',leader)).snapshots[0];assert.equal(latest.state,'FINAL');assert.equal(Number(latest.score),0);await lp.getByLabel('نسخه ارزیابی',{exact:true}).selectOption(latest.id);await lp.getByRole('heading',{name:/نتیجه نسخه/}).waitFor();
 pass('Browser completes all five shared domains and submits a calculated final zero assessment with education N/A');

 const raw=/\b(ACTIVE|OPEN|CRITICAL|FAMILY_TRANSFERRED|health|housing|education|livelihood|vulnerability|PROVISIONAL)\b|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-/;
 for(const route of ['/guide','/guide/people','/guide/groups','/guide/alerts','/guide/council-decisions','/guide/reports']){await page.goto(origin+route);await page.locator('h1').waitFor();await page.waitForTimeout(300);assert.ok(!raw.test(await page.locator('body').innerText()),route);}
 await page.goto(origin+'/guide/reports');await page.getByRole('button',{name:'دریافت اکسل',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:/PDF/}).count(),0);await page.getByRole('button',{name:'پیش‌نمایش چاپ',exact:true}).click();await page.locator('iframe').waitFor();assert.ok(!raw.test(await page.frameLocator('iframe').locator('body').innerText()));await page.screenshot({path:path.join(out,'management-reports.png'),fullPage:true});
 await page.goto(origin+'/guide/council-decisions/'+c.id);await page.getByRole('heading',{name:c.subject,exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'توقف اجرا',exact:true}).count(),0);await page.screenshot({path:path.join(out,'council-archive.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});for(const route of ['/guide','/guide/groups','/guide/reports']){await page.goto(origin+route);await page.locator('h1').waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}assert.deepEqual(errors,[]);pass('Browser report and print preview contain no raw enums/UUID; council read-only; mobile tables scroll without page overflow');
 const responsiveRoutes=['/guide','/guide/people','/guide/groups','/guide/groups/'+g2,'/guide/families/'+fid,'/guide/families/'+fid+'/assessments','/guide/reports','/guide/access-requests'];
 for(const width of [1440,768,390]){
  await page.setViewportSize({width,height:900});
  for(const route of responsiveRoutes){await page.goto(origin+route);await page.locator('h1').waitFor();await page.waitForTimeout(150);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),width+' '+route);}
  await lp.setViewportSize({width,height:900});await lp.goto(origin+'/workspace/families/'+leaderFamily.family_id+'/assessments');await lp.locator('.assessment-domain').first().waitFor();assert.ok(await lp.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  const anonymous=await browser.newContext({viewport:{width,height:900}});const loginPage=await anonymous.newPage();await loginPage.goto(origin+'/login');await loginPage.locator('#username').waitFor();assert.ok(await loginPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await anonymous.close();
 }
 pass('Desktop, tablet and mobile: login, people, groups, family workspace, read-only/editable assessments, reports and access requests');
 writeFileSync(path.join(out,'results.json'),JSON.stringify({date:new Date().toISOString(),results},null,2));
} catch(error){if(browser){for(const c of browser.contexts())for(const p of c.pages()){console.log('Browser failure URL',p.url());console.log((await p.locator('body').innerText()).slice(0,4000));await p.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});}}results.push({name:'suite',status:'FAIL',message:error.message});writeFileSync(path.join(out,'results.json'),JSON.stringify({results},null,2));throw error;}
finally{if(browser)await browser.close();await stop(front);await stop(server);await pool.end();await dropTestDatabase(admin, dbName);await admin.end();}
