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
const out = path.join(root, 'test-results/livelihood-seed');
mkdirSync(out, { recursive: true });
const results = [];
const pass = name => { results.push({ name, status: 'PASS' }); console.log('PASS ' + name); };
const dbName = 'lahout_test_livelihood_seed_' + Date.now();
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
 run('.tools/scripts/migrate.js');run('.tools/scripts/seed-dev.js');run('.tools/scripts/seed-guide-dev.js');run('.tools/scripts/seed-livelihood-dev.js');
 const {LivelihoodService}=require('./.tools/src/livelihood/livelihood.service.js');
 const {GuidanceService}=require('./.tools/src/guidance/guidance.service.js');
 const {DocumentsService}=require('./.tools/src/documents/documents.service.js');
 const engine=new LivelihoodService(pool,new GuidanceService(pool),new DocumentsService(pool,new GuidanceService(pool)));
 const seed='.tools/scripts/seed-livelihood-scenarios-dev.js';
 const digest=async()=>{const tables=['identity.people','identity.accounts','identity.role_assignments','family.families','family.family_memberships','family.documents','family.document_context','assessment.models','assessment.snapshots','assessment.domain_reviews','assessment.domain_submissions','assessment.domain_decisions','guidance.history','admin.audit_events'];const values={};for(const t of tables)values[t]=(await pool.query(`SELECT md5(COALESCE(string_agg(to_jsonb(x)::text,'' ORDER BY to_jsonb(x)::text),'')) hash FROM ${t} x`)).rows[0].hash;return values;};
 const legacy=await pool.query("SELECT to_jsonb(f) value FROM family.families f WHERE family_code NOT LIKE 'HL-TEST-G%' ORDER BY id");
 run(seed,{APP_ENV:'production'},1);run(seed,{APP_ENV:'staging'},1);
 await pool.query("UPDATE family.case_profiles SET provenance='not a test fixture' WHERE family_id=(SELECT id FROM family.families WHERE family_code='HL-TEST-G5-10')");
 const protectedBefore=await digest();run(seed,{},1);assert.deepEqual(await digest(),protectedBefore);
 await pool.query("UPDATE family.case_profiles SET provenance='V100 DEVELOPMENT/TEST ONLY — no full assessment' WHERE family_id=(SELECT id FROM family.families WHERE family_code='HL-TEST-G5-10')");
 pass('Seed refuses production/staging and non-fixture collisions; whole transaction rolls back without partial data');
 run(seed);const seeded=await digest();run(seed);run('.tools/scripts/seed-livelihood-dev.js');assert.deepEqual(await digest(),seeded);
 assert.deepEqual((await pool.query("SELECT to_jsonb(f) value FROM family.families f WHERE family_code NOT LIKE 'HL-TEST-G%' ORDER BY id")).rows,legacy.rows);
 pass('Scenario and base seeds are idempotent; no duplicates, password resets or changes to legacy family rows');
 const fixtures=(await pool.query("SELECT f.*,g.name group_name,r.id review_id,r.state,r.payload,r.model_id FROM family.families f JOIN organization.groups g ON g.id=f.current_group_id JOIN assessment.domain_reviews r ON r.family_id=f.id WHERE family_code LIKE 'HL-TEST-G%' ORDER BY family_code")).rows;
 assert.equal(fixtures.length,50);const counts={};for(const f of fixtures)counts[f.state]=(counts[f.state]??0)+1;
 assert.deepEqual(counts,{APPROVED:20,SUBMITTED:10,RETURNED:8,DRAFT:12});
 const cases=(await pool.query("SELECT new_state->>'scenario' scenario,count(*)::int n FROM guidance.history WHERE action='LIVELIHOOD_DEMO_SEEDED' GROUP BY 1")).rows;
 assert.deepEqual(Object.fromEntries(cases.map(x=>[x.scenario,x.n])),{APPROVED:20,SUBMITTED:10,RETURNED:8,IN_PROGRESS:7,UNKNOWN:5});
 for(let g=1;g<=5;g++)assert.ok(new Set(fixtures.filter(f=>f.family_code.startsWith('HL-TEST-G'+g)).map(f=>f.state)).size>=4);
 pass('Exactly 50 reviews: 20 approved, 10 submitted, 8 returned, 7 in progress and 5 explicitly incomplete; mixed across all groups');
 let members=0;const sizes=new Set(),scores=[],completeScores=[];let incomplete=0;
 const model=await engine.model(pool);
 const expected=[[0,5,10,15],[0,2,4,6],[0,1,3,5],[0,1,2,4]];
 for(const f of fixtures){const base=await engine.basics(pool,f),result=engine.evaluate(f.payload,base,model.definition);members+=base.members.length;sizes.add(base.members.length);
   for(const p of base.members){assert.match(p.national_id,/^\d{10}$/);const r=[...p.national_id.slice(0,9)].reduce((s,v,i)=>s+Number(v)*(10-i),0)%11;assert.notEqual(Number(p.national_id[9]),r<2?r:11-r);}
   assert.match(base.members.find(m=>m.relationship_code==='HEAD').mobile,/^09\d{9}$/);
   const chosen=['adequacy','stability','pressure','debt'].map(k=>f.payload.summaries[k]);
   const expectedScore=chosen.includes('UNKNOWN')?null:chosen.reduce((s,v,i)=>s+expected[i][Number(v)],0);
   assert.equal(result.score,expectedScore);assert.equal(result.max,30);assert.equal(result.totalScore,null);assert.equal(result.level,null);
   if(result.score!==null)scores.push(result.score);if(result.complete)completeScores.push(result.score);else incomplete++;
   if(f.state!=='DRAFT')assert.equal(result.complete,true,JSON.stringify(result.missing));
   else assert.equal(result.complete,false);
 }
 assert.equal(members,200);assert.deepEqual([...sizes].sort(),[2,3,4,5,6]);assert.equal(incomplete,12);assert.equal(scores.length,49);assert.equal(Math.min(...scores),0);assert.equal(Math.max(...scores),30);
 for(const [min,max] of [[0,6],[7,12],[13,19],[20,25],[26,30]])assert.ok(scores.filter(n=>n>=min&&n<=max).length>=2);
 pass('200 active members, family sizes 2–6, invalid check digits and phone-shaped fixtures; all 49 computable scores match official tables and all five score bands');
 const decisions=(await pool.query("SELECT d.*,s.snapshot,a.username FROM assessment.domain_decisions d JOIN assessment.domain_submissions s ON s.id=d.submission_id JOIN identity.accounts a ON a.id=d.decided_by")).rows;
 const approved=decisions.filter(d=>d.decision==='APPROVED'),returned=decisions.filter(d=>d.decision==='RETURNED');assert.equal(approved.length,20);assert.equal(returned.length,8);assert.equal(new Set(approved.map(d=>d.decided_at.toISOString())).size,20);assert.equal(new Set(returned.map(d=>d.reason)).size,8);
 for(const d of approved){assert.equal(d.username,'TestV100_Executive');assert.equal(d.snapshot.result.complete,true);assert.deepEqual(engine.evaluate(d.snapshot.payload,d.snapshot,d.snapshot.modelDefinition),d.snapshot.result);const year=new Date(d.decided_at);year.setUTCFullYear(year.getUTCFullYear()+1);assert.equal(d.valid_until.toISOString(),year.toISOString());assert.ok(d.valid_until>new Date());}
 for(const d of returned){assert.ok(d.reason.length>25);assert.ok((await pool.query("SELECT 1 FROM admin.audit_events WHERE event_type='GUIDE_LIVELIHOOD_RETURNED' AND metadata->>'reason'=$1 AND effective_role='EXECUTIVE_MANAGER'",[d.reason])).rowCount);}
 await assert.rejects(pool.query("UPDATE assessment.domain_submissions SET snapshot='{}' WHERE id=$1",[approved[0].submission_id]));await assert.rejects(pool.query('DELETE FROM assessment.domain_decisions WHERE id=$1',[approved[0].id]));
 pass('20 complete immutable snapshots, Shahdeh approvals, varied dates, exact one-year validity and 8 distinct return reasons in workflow/audit');
 const statistics={families:50,activeMembers:members,assessments:50,workflow:Object.fromEntries(cases.map(x=>[x.scenario,x.n])),score:{count:scores.length,unknown:1,min:Math.min(...scores),max:Math.max(...scores),average:scores.reduce((s,x)=>s+x,0)/scores.length,completeAssessmentCount:completeScores.length,completeAssessmentAverage:completeScores.reduce((s,x)=>s+x,0)/completeScores.length},validSnapshots:approved.length,explicitlyIncomplete:5,inProgress:7,totalNotReady:incomplete,returned:8};
 writeFileSync(path.join(out,'statistics.json'),JSON.stringify(statistics,null,2));
 const log=openSync(path.join(out,'backend.log'),'w');server=spawn(process.execPath,['dist/main.js'],{cwd:backend,env,windowsHide:true,stdio:['ignore',log,log]});await waitReady('http://127.0.0.1:3001/api/v1/auth/me',server);
 const post=async(url,body,auth,status=200)=>{const r=await req(url,{...auth,body});assert.equal(r.status,status,JSON.stringify(r.body));return r.body;};
 const get=async(url,auth)=>{const r=await req(url,auth);assert.equal(r.status,200,JSON.stringify(r.body));return r.body;};
 async function login(username,role){const r=await req('/auth/login',{body:{username,password}});assert.equal(r.status,200,JSON.stringify(r.body));const a={cookie:r.cookie,csrf:r.body.csrfToken};if(role)await post('/auth/select-role',{roleCode:role},a);return a;}
 const leader=await login('TestV100_Leader1','GROUP_LEADER'),helper=await login('TestV100_Helper1_1'),executive=await login('TestV100_Executive','EXECUTIVE_MANAGER'),guide=await login('Aseman');
 const own=(await get('/livelihood/families',leader)).families;assert.equal(own.length,10);assert.equal((await get('/livelihood/families',helper)).families.length,10);const foreign=fixtures.find(f=>f.family_code==='HL-TEST-G2-01');
 for(const a of [leader,helper])assert.equal((await req('/livelihood/families/'+foreign.id,a)).status,403);
 assert.equal((await get('/livelihood/queue',executive)).items.length,10);
 for(const f of fixtures){const w=await get('/livelihood/families/'+f.id,guide);assert.equal(w.canEdit,false);assert.equal(w.submissions.length,f.state==='APPROVED'?1:0);if(f.state!=='APPROVED')assert.equal(w.result,null);}
 pass('Leader/helper scope remains group-only; executive receives exactly 10 pending records; guide sees only 20 approved results');
 const ret=fixtures.find(f=>f.family_code==='HL-TEST-G1-07');let w=await get('/livelihood/families/'+ret.id,leader);assert.equal(w.review.state,'RETURNED');
 assert.ok(Buffer.byteLength(JSON.stringify(w.payload))>4096);
 await post('/livelihood/families/'+ret.id+'/draft',{version:w.review.version,payload:{...w.payload,notes:'x'.repeat(270000)}},leader,413);
 const attachment=await post('/livelihood/families/'+ret.id+'/documents',{name:'development-long-evidence.txt',category:'OTHER',mediaType:'text/plain',content:Buffer.alloc(65536,65).toString('base64')},leader);
 assert.ok(attachment.id);
 pass('Long fixture payload exceeds old 4 KiB ceiling; scoped document upload succeeds and requests above 256 KiB remain blocked');
 await post('/livelihood/families/'+ret.id+'/draft',{version:w.review.version,payload:{...w.payload,notes:w.payload.notes+' — توضیح اصلاح‌شده توسط کاربر تست'}},leader);
 w=await get('/livelihood/families/'+ret.id,leader);assert.equal(w.review.state,'READY');const afterEdit=await digest();run(seed);assert.deepEqual(await digest(),afterEdit);
 await post('/livelihood/families/'+ret.id+'/submit',{version:w.review.version},leader);
 assert.equal((await get('/livelihood/families/'+ret.id,leader)).submissions.length,2);
 pass('Returned seeded record can be corrected and resubmitted through real API; rerun preserves user corrections and existing history');
 const {chromium}=createRequire(path.join(root,'package.json'))('playwright');const flog=openSync(path.join(out,'frontend.log'),'w');front=spawn(process.execPath,['tests/preview.mjs'],{cwd:root,env:{...env,PREVIEW_PORT:'5174',BACKEND_PROXY:'http://127.0.0.1:3001'},windowsHide:true,stdio:['ignore',flog,flog]});await waitReady(origin,front);browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});const errors=[];
 async function browserAs(auth){const c=await browser.newContext({viewport:{width:1440,height:1000}});await c.addCookies([{name:'lahout_session',value:auth.cookie.split('=')[1],url:origin,httpOnly:true,sameSite:'Strict'}]);const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));return p;}
 const page=await browserAs(leader);await page.goto(origin+'/workspace/livelihood');await page.getByText('HL-TEST-G1-10',{exact:true}).waitFor();assert.equal(await page.locator('tbody tr').count(),10);await page.screenshot({path:path.join(out,'leader-seeded-list.png'),fullPage:true});
 const ret2=fixtures.find(f=>f.family_code==='HL-TEST-G1-08');await page.goto(origin+'/workspace/livelihood/'+ret2.id);await page.getByRole('button',{name:'نتیجه و ارسال',exact:true}).click();
 await page.getByText(returned.find(d=>d.snapshot.family.id===ret2.id).reason,{exact:false}).first().waitFor();
 await page.screenshot({path:path.join(out,'returned-long-text.png'),fullPage:true});
 const incompleteFamily=fixtures.find(f=>f.family_code==='HL-TEST-G1-10');await page.goto(origin+'/workspace/livelihood/'+incompleteFamily.id);await page.getByRole('button',{name:'نتیجه و ارسال',exact:true}).click();assert.ok(await page.getByRole('button',{name:'ارسال برای مدیر اجرایی',exact:true}).isDisabled());
 const ep=await browserAs(executive);await ep.goto(origin+'/executive/assessments');await ep.locator('a[href^="/executive/assessments/"]').first().waitFor();assert.equal(await ep.locator('a[href^="/executive/assessments/"]').count(),11);await ep.screenshot({path:path.join(out,'executive-seeded-queue.png'),fullPage:true});
 const gp=await browserAs(guide);await gp.goto(origin+'/workspace/livelihood/'+fixtures[0].id);await gp.getByRole('button',{name:'نتیجه و ارسال',exact:true}).click();await gp.getByText('تأییدکننده:',{exact:false}).waitFor();assert.equal(await gp.getByRole('button',{name:'تأیید ارزیابی معیشت',exact:true}).count(),0);
 for(const p of [page,ep,gp])for(const width of [1440,768,390]){await p.setViewportSize({width,height:950});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'overflow '+width+' '+p.url()+' '+JSON.stringify(await p.locator('body *').evaluateAll(elements=>elements.filter(e=>e.getBoundingClientRect().right>innerWidth+1||e.getBoundingClientRect().left < -1).slice(0,8).map(e=>({tag:e.tagName,class:e.className,width:e.getBoundingClientRect().width})))) );}
 assert.deepEqual(errors,[]);await gp.screenshot({path:path.join(out,'approved-mobile.png'),fullPage:true});
 pass('Browser displays seeded list, long return text, incomplete submit block, executive queue and read-only approval at desktop/tablet/mobile without JS errors');
} catch(e){results.push({name:'suite',status:'FAIL',message:e.message});throw e;}
finally{await browser?.close();await stop(front);await stop(server);await pool.end();await dropTestDatabase(admin,dbName);await admin.end();writeFileSync(path.join(out,'results.json'),JSON.stringify({date:new Date().toISOString(),results},null,2));}
