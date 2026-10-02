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
const out = path.join(root, 'test-results/documents');
mkdirSync(out, { recursive: true });
const results = [];
const pass = name => { results.push({ name, status: 'PASS' }); console.log('PASS ' + name); };
const dbName = 'lahout_test_documents_' + Date.now();
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

 const sharp=require('sharp'),{PDFDocument}=require('pdf-lib'),{randomUUID}=await import('node:crypto');
 const base='/livelihood/families/'+family.id, make=(files,extra={})=>({requestId:randomUUID(),name:'Document test',category:'OTHER',files,...extra});
 const png=await sharp({create:{width:1400,height:1800,channels:3,background:'#fff'}}).png().toBuffer();
 const f={name:'page.png',mediaType:'image/png',content:png.toString('base64')};
 const body=make([f]),doc=await post(base+'/document-versions',body,leader);
 assert.equal((await post(base+'/document-versions',body,leader)).id,doc.id);
 const manifest=await get(base+'/documents/'+doc.id+'/manifest',leader);assert.equal(manifest.files.length,1);
 const raw=async(d,file)=>{const r=await fetch('http://127.0.0.1:3001/api/v1'+base+'/documents/'+d+'/files/'+file,{headers:{cookie:leader.cookie}});assert.equal(r.status,200);return Buffer.from(await r.arrayBuffer());};
 assert.deepEqual(await raw(doc.id,manifest.files[0].id),png);
 assert.equal((await req('/livelihood/families/'+foreign.id+'/documents/'+doc.id+'/manifest',leader)).status,403);
 await post(base+'/document-versions',make([f]),helper,403);
 pass('Persistent draft document, idempotent retry, authenticated retrieval and scoped write/read permissions');
 const doc2=await post(base+'/document-versions',make([f],{documentId:doc.id}),leader),m2=await get(base+'/documents/'+doc2.id+'/manifest',leader);
 assert.equal(m2.files.length,2);assert.deepEqual(await raw(doc.id,manifest.files[0].id),png);
 const doc3=await post(base+'/document-versions',make([],{documentId:doc2.id,order:m2.files.map(x=>x.id).reverse()}),leader);
 const m3=await get(base+'/documents/'+doc3.id+'/manifest',leader);assert.equal(m3.revision,3);
 await post(base+'/document-versions',make([f],{documentId:doc2.id}),leader,409);
 const replacement=await post(base+'/document-versions',make([f],{documentId:doc3.id,replaceFileId:m3.files[0].id}),leader);
 const rm=await get(base+'/documents/'+replacement.id+'/manifest',leader);assert.equal(rm.files.length,2);
 await post(base+'/documents/'+replacement.id+'/archive',{reason:'Test archive'},leader);
 const list2=await get(base+'/document-list',leader);assert.equal(list2.find(x=>x.id===replacement.id).status,'ARCHIVED');assert.ok(!(await get(base,leader)).documents.some(x=>x.id===replacement.id));
 assert.deepEqual(await raw(doc.id,manifest.files[0].id),png);
 pass('Add, reorder, replace and archive create immutable historical versions; stale writes conflict');
 const pdf=await PDFDocument.create();pdf.addPage().drawText('Readable document page one');pdf.addPage().drawText('Page two');const pdfBytes=await pdf.save();
 const pdfDoc=await post(base+'/document-versions',make([{name:'two.pdf',mediaType:'application/pdf',content:Buffer.from(pdfBytes).toString('base64')}]),leader);
 assert.equal((await get(base+'/document-list',leader)).find(x=>x.id===pdfDoc.id).page_count,2);
 const noise=randomBytes(2200*2400*3),large=await sharp(noise,{raw:{width:2200,height:2400,channels:3}}).png().toBuffer();assert.ok(large.length>3*1024*1024);
 const photo=await post(base+'/document-versions',make([{name:'large.png',mediaType:'image/png',content:large.toString('base64')}]),leader);
 const pm=await get(base+'/documents/'+photo.id+'/manifest',leader);assert.ok(pm.files[0].stored_size<large.length);assert.equal(pm.files[0].media_type,'image/jpeg');
 await post(base+'/document-versions',make([{...f,content:Buffer.from('<script>bad</script>').toString('base64')}]),leader,400);
 pass('Multi-page PDF preserved, large camera image optimized, corrupt disguised payload rejected');
 await stop(server);server=spawn(process.execPath,['dist/main.js'],{cwd:backend,env,windowsHide:true,stdio:['ignore',log,log]});await waitReady('http://127.0.0.1:3001/api/v1/auth/me',server);
 assert.deepEqual(await raw(doc.id,manifest.files[0].id),png);
 assert.ok((await pool.query("SELECT 1 FROM guidance.history WHERE entity_id=$1 AND action='DOCUMENT_VIEWED'",[family.id])).rowCount);
 pass('Files survive backend restart; viewing and mutation audit persisted');


 const legacy=(await pool.query('SELECT d.*,c.category FROM family.documents d JOIN family.document_context c ON c.document_id=d.id WHERE family_id=$1 AND content IS NOT NULL ORDER BY d.id LIMIT 2',[family.id])).rows;
 const legacyCopy=Buffer.from(legacy[0].content);
 const upgraded=await post(base+'/document-versions',make([f],{documentId:legacy[0].id,category:legacy[0].category}),leader);
 assert.equal((await get(base+'/documents/'+upgraded.id+'/manifest',leader)).files.length,2);
 assert.deepEqual(await raw(legacy[0].id,legacy[0].id),legacyCopy);
 assert.deepEqual((await pool.query('SELECT content FROM family.documents WHERE id=$1',[legacy[0].id])).rows[0].content,legacyCopy);
 await post(base+'/documents/'+legacy[1].id+'/archive',{reason:'Legacy archive test'},leader);
 assert.equal((await get(base+'/document-list',leader)).find(x=>x.id===legacy[1].id).status,'ARCHIVED');
 pass('Legacy documents support append and nondeleting archive; original database bytes and historical URLs remain unchanged');


 const membership=(await pool.query('SELECT id FROM family.family_memberships WHERE family_id=$1 AND valid_to IS NULL LIMIT 1',[family.id])).rows[0];
 await pool.query('INSERT INTO assessment.health_forms(membership_id,payload,created_by,updated_by) VALUES($1,$2,$3,$3)',[membership.id,JSON.stringify({documentIds:[doc.id]}),leader.user.accountId]);
 const healthReferenced=await get('/health-assessment/families/'+family.id,leader);
 assert.ok(healthReferenced.documents.some(d=>d.id===doc.id));assert.deepEqual(await raw(doc.id,manifest.files[0].id),png);
 pass('Health form keeps its explicitly referenced historical document after current replacement/archive');

 const fsp=await import('node:fs/promises');
 const countFiles=async()=> (await fsp.readdir(path.join(env.UPLOAD_STORAGE_ROOT,'files'))).length;
 const beforeFiles=await countFiles(),beforeDocs=Number((await pool.query('SELECT count(*) FROM family.documents')).rows[0].count);
 await pool.query("CREATE FUNCTION admin.test_document_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='DOCUMENT_CREATED' THEN RAISE EXCEPTION 'test-only failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER test_document_fail BEFORE INSERT ON guidance.history FOR EACH ROW EXECUTE FUNCTION admin.test_document_fail()");
 await post(base+'/document-versions',make([f]),leader,503);
 await pool.query('DROP TRIGGER test_document_fail ON guidance.history; DROP FUNCTION admin.test_document_fail()');
 assert.equal(await countFiles(),beforeFiles);assert.equal(Number((await pool.query('SELECT count(*) FROM family.documents')).rows[0].count),beforeDocs);
 pass('Database failure rolls back metadata and removes unreferenced persisted files');

 const filesDir=path.join(env.UPLOAD_STORAGE_ROOT,'files');assert.ok(env.UPLOAD_STORAGE_ROOT.endsWith(dbName));
 await fsp.rename(filesDir,filesDir+'-test-backup');await fsp.writeFile(filesDir,'Test-only storage obstruction');
 try{await post(base+'/document-versions',make([f]),leader,503);assert.equal(Number((await pool.query('SELECT count(*) FROM family.documents')).rows[0].count),beforeDocs);}
 finally{await fsp.unlink(filesDir);await fsp.rename(filesDir+'-test-backup',filesDir);}
 assert.equal(await countFiles(),beforeFiles);pass('Filesystem write failure leaves no successful document metadata and preserves existing files');

 const {chromium}=createRequire(path.join(root,'package.json'))('playwright'),flog=openSync(path.join(out,'frontend.log'),'w');
 const startFront=()=>spawn(process.execPath,['tests/preview.mjs'],{cwd:root,env:{...env,PREVIEW_PORT:'5174',BACKEND_PROXY:'http://127.0.0.1:3001'},windowsHide:true,stdio:['ignore',flog,flog]});
 front=startFront();await waitReady(origin,front);browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.addCookies([{name:'lahout_session',value:leader.cookie.split('=')[1],url:origin,httpOnly:true,sameSite:'Strict'}]);
 let page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const openDocs=async()=>{await page.goto(origin+'/workspace/families/'+family.id);await page.locator('#family-documents summary').click();};
 await openDocs();await page.getByRole('button',{name:'عنوان مدرک',exact:true}).click();await page.getByRole('option',{name:'سایر',exact:false}).click();await page.getByLabel('عنوان سایر مدارک',{exact:true}).fill('Browser three pages');
 await page.getByLabel('بارگذاری مدرک',{exact:true}).setInputFiles([{name:'page1.png',mimeType:'image/png',buffer:large},{name:'page2.png',mimeType:'image/png',buffer:png},{name:'page3.png',mimeType:'image/png',buffer:png}]);
 await page.getByRole('button',{name:'تأیید و ذخیره',exact:true}).click();
 const card=()=>page.locator('.document-card').filter({has:page.getByRole('heading',{name:'Browser three pages',exact:true})});
 await card().waitFor();assert.equal(await page.getByLabel('بارگذاری مدرک',{exact:true}).inputValue(),'');
 let uploaded=(await get(base+'/document-list',leader)).find(x=>x.name==='Browser three pages');assert.equal(uploaded.page_count,3);assert.ok(Number(uploaded.original_size)>Number(uploaded.stored_size));
 await page.getByLabel('عنوان سایر مدارک',{exact:true}).fill('Browser second upload');await page.getByLabel('بارگذاری مدرک',{exact:true}).setInputFiles({name:'two.pdf',mimeType:'application/pdf',buffer:Buffer.from(pdfBytes)});
 await page.getByRole('heading',{name:'Browser second upload',exact:true}).waitFor();await card().waitFor();
 await page.reload();await page.locator('#family-documents summary').click();await card().waitFor();
 await card().getByRole('button',{name:'مدیریت صفحات',exact:true}).click();await page.getByRole('button',{name:'پایین‌تر',exact:true}).first().click();await page.getByRole('status').filter({hasText:'مدرک روی سامانه ذخیره شد'}).waitFor();
 uploaded=(await get(base+'/document-list',leader)).find(x=>x.name==='Browser three pages');const ordered=await get(base+'/documents/'+uploaded.id+'/manifest',leader);assert.equal(ordered.files[0].original_name,'page2.png');
 await card().getByRole('button',{name:'مشاهده Browser three pages',exact:true}).click();await page.locator('dialog img').waitFor();assert.ok(await page.locator('dialog img').evaluate(i=>i.complete&&i.naturalWidth>0));await page.getByRole('button',{name:'بعدی',exact:true}).click();await page.getByRole('button',{name:'بزرگ‌نمایی',exact:true}).click();await page.getByRole('button',{name:'بستن',exact:true}).click();
 await page.goto(origin+'/workspace/families/'+family.id);await openDocs();await card().waitFor();
 await page.close();page=await context.newPage();await openDocs();await card().waitFor();
 await stop(front);front=startFront();await waitReady(origin,front);await openDocs();await card().waitFor();
 pass('Browser large upload, separate second upload, three-page ordering/viewer and persistence across refresh/tab/frontend restart');

 await openDocs();await page.getByRole('button',{name:'مشاهده Browser second upload',exact:true}).click();await page.locator('dialog iframe').waitFor();assert.match(await page.locator('dialog iframe').getAttribute('src'),/\/files\//);await page.getByRole('button',{name:'بستن',exact:true}).click();
 const countBeforeCamera=(await get(base+'/document-list',leader)).length;
 await page.getByLabel('بارگذاری مدرک',{exact:true}).setInputFiles({name:'camera.png',mimeType:'image/png',buffer:png});
 await page.getByAltText('پیش‌نمایش عکس ۱').waitFor();assert.equal((await get(base+'/document-list',leader)).length,countBeforeCamera);
 const capture=page.waitForEvent('filechooser');await page.getByRole('button',{name:'انتخاب مجدد',exact:true}).click();await (await capture).setFiles({name:'camera2.png',mimeType:'image/png',buffer:png});
 await page.getByRole('button',{name:'تأیید و ذخیره',exact:true}).click();await page.getByRole('status').filter({hasText:'مدرک روی سامانه ذخیره شد'}).waitFor();assert.equal((await get(base+'/document-list',leader)).length,countBeforeCamera+1);
 await post('/auth/logout',{},leader);Object.assign(leader,await login('TestV100_Leader1','GROUP_LEADER'));await context.clearCookies();await context.addCookies([{name:'lahout_session',value:leader.cookie.split('=')[1],url:origin,httpOnly:true,sameSite:'Strict'}]);await openDocs();await card().waitFor();
 pass('PDF internal viewer, unified picker image preview/reselect/confirm and persisted documents after logout/login');

 for(const width of [1440,768,390]){
  await page.setViewportSize({width,height:900});await openDocs();await card().waitFor();if(width===390)await page.screenshot({path:path.join(out,'mobile-documents.png'),fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.goto(origin+'/leader/families');await page.locator('.family-identity').first().waitFor();
  const metrics=await page.evaluate(()=>{const nav=document.querySelector('.role-sidebar nav'),links=[...nav.children].filter(n=>n.tagName==='A'),styles=links.map(n=>{const s=getComputedStyle(n);return [s.fontSize,s.fontWeight,s.lineHeight,s.paddingTop,s.paddingBottom].join('|');});const code=document.querySelector('.family-identity bdi'),table=document.querySelector('.table-scroll');return {styles,code:getComputedStyle(code).whiteSpace,scroll:table.scrollWidth,client:table.clientWidth};});
  assert.equal(new Set(metrics.styles).size,1);assert.equal(metrics.code,'nowrap');if(width===390)assert.ok(metrics.scroll>metrics.client);
  for(const route of ['/workspace/families/'+family.id,'/workspace/health/'+family.id]){await page.goto(origin+route);await page.locator('h1').waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
 }
 assert.deepEqual(errors,[]);pass('Desktop/tablet/mobile document, base, health and family layouts; horizontal table scrolling, family code and equal sidebar styles');

} catch(e){results.push({name:e.stack??String(e),status:'FAIL'});console.error(e);process.exitCode=1;}
finally{if(browser)await browser.close();await stop(front);await stop(server);await pool.end();await dropTestDatabase(admin,dbName);await admin.end();writeFileSync(path.join(out,'results.json'),JSON.stringify({results},null,2));}
