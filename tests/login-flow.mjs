import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, openSync } from 'node:fs';
import { createHash } from 'node:crypto';
const root=fileURLToPath(new URL('..',import.meta.url));
const backend=path.join(root,'apps/backend');
const require=createRequire(path.join(backend,'package.json'));
const {Pool}=require('pg'); const argon2=require('argon2');
const password=process.env.DEV_SEED_PASSWORD;
if(!password||!process.env.TEST_DATABASE_ADMIN_URL)throw new Error('DEV_SEED_PASSWORD and TEST_DATABASE_ADMIN_URL are required');
const results=[];const out=path.join(root,'test-results');mkdirSync(out,{recursive:true});
const pass=name=>{results.push({name,status:'PASS'});console.log('PASS '+name);};
const dbName='lahout_test_'+Date.now();
const admin=new Pool({connectionString:process.env.TEST_DATABASE_ADMIN_URL});
await admin.query(`CREATE DATABASE ${dbName}`);
const dbUrl=new URL(process.env.TEST_DATABASE_ADMIN_URL);dbUrl.pathname='/'+dbName;
const pool=new Pool({connectionString:dbUrl.href});
const env={...process.env,DATABASE_URL:dbUrl.href,APP_ENV:'development',BACKEND_PORT:'3001',FRONTEND_ORIGIN:'http://127.0.0.1:5174',COOKIE_SECURE:'false',SESSION_TTL_HOURS:'12'};
let server,front,browser;
function run(script){const r=spawnSync(process.execPath,[script],{cwd:backend,env,windowsHide:true,encoding:'utf8'});assert.equal(r.status,0,r.stderr||r.stdout);}
async function waitReady(url){for(let i=0;i<300;i++){try{await fetch(url,{signal:AbortSignal.timeout(500)});return;}catch{await new Promise(r=>setTimeout(r,200));}}throw new Error('Server did not become ready');}
async function start(extra={}){const log=openSync(path.join(out,'backend.log'),'a');server=spawn(process.execPath,['dist/main.js'],{cwd:backend,env:{...env,...extra},windowsHide:true,stdio:['ignore',log,log]});await waitReady('http://127.0.0.1:3001/api/v1/auth/me');}
async function stop(){if(!server)return;const child=server;server=null;if(child.exitCode!==null)return;await new Promise(r=>{child.once('exit',r);child.kill();});}
async function req(route,{body,method=body===undefined?'GET':'POST',cookie,csrf,origin=env.FRONTEND_ORIGIN}={}){
 const headers={origin};if(body!==undefined)headers['content-type']='application/json';if(cookie)headers.cookie=cookie;if(csrf)headers['x-csrf-token']=csrf;
 const r=await fetch('http://127.0.0.1:3001/api/v1/auth/'+route,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
 return {status:r.status,body:await r.json(),headers:r.headers,cookie:r.headers.get('set-cookie')?.split(';')[0]};
}
const login=(username='Aseman',pw=password,cookie)=>req('login',{body:{username,password:pw},cookie});
async function fixture(username,status,role,mobile){const person=await pool.query('INSERT INTO identity.people(first_name,last_name,mobile) VALUES ($1,$2,$3) RETURNING id',[username,'test',mobile]);const a=await pool.query('INSERT INTO identity.accounts(person_id,username,password_hash,status) VALUES ($1,$2,$3,$4) RETURNING id',[person.rows[0].id,username,await argon2.hash(password,{type:argon2.argon2id}),status]);await pool.query("INSERT INTO identity.role_assignments(account_id,role_code,scope_type) VALUES ($1,$2,'ORGANIZATION')",[a.rows[0].id,role]);return a.rows[0].id;}
try{
 run('.tools/scripts/migrate.js');run('.tools/scripts/migrate.js');pass('Original PostgreSQL migrations apply and rerun safely');
 run('.tools/scripts/seed-dev.js');const original=await pool.query("SELECT password_hash FROM identity.accounts WHERE username='Aseman'");run('.tools/scripts/seed-dev.js');assert.equal((await pool.query("SELECT password_hash FROM identity.accounts WHERE username='Aseman'")).rows[0].password_hash,original.rows[0].password_hash);assert.ok(original.rows[0].password_hash.startsWith('$argon2id$'));pass('Aseman seed is idempotent and stores Argon2id only');
 await fixture('mobile_fixture','ACTIVE','COUNCIL_MEMBER','09121112233');await fixture('inactive_fixture','SUSPENDED','COUNCIL_MEMBER',null);const roleless=await fixture('helper_fixture','ACTIVE','COUNCIL_MEMBER',null);await pool.query('UPDATE identity.role_assignments SET valid_to=now() WHERE account_id=$1',[roleless]);
 await start();assert.equal((await req('guide-home')).status,401);pass('Guide API rejects unauthenticated access');
 const malformed=await fetch('http://127.0.0.1:3001/api/v1/auth/login',{method:'POST',headers:{origin:env.FRONTEND_ORIGIN,'content-type':'application/json'},body:'{"password":'});assert.equal(malformed.status,400);assert.equal((await malformed.json()).error.message,'درخواست معتبر نیست.');
 const huge=await fetch('http://127.0.0.1:3001/api/v1/auth/login',{method:'POST',headers:{origin:env.FRONTEND_ORIGIN,'content-type':'application/json'},body:JSON.stringify({username:'a'.repeat(5000),password})});assert.equal(huge.status,413);pass('Malformed JSON and excessive request bodies return safe 4xx errors');
 for(const body of [null,{username:4,password:[]},{username:'',password:''},{username:'x'.repeat(81),password}])assert.equal((await req('login',{body})).status,400);pass('Missing, wrong-type and oversized fields are rejected safely');
 const failures=[];for(const [name,pw] of [['missing_fixture',password],['Aseman','wrong-password'],['inactive_fixture',password],['helper_fixture',password]]){const r=await login(name,pw);assert.equal(r.status,401);assert.equal(r.cookie,undefined);failures.push(r.body.error.message);}assert.equal(new Set(failures).size,1);pass('Unknown, wrong-password, suspended and roleless accounts share safe errors');
 await stop();await start();
 let ok=await login('  aSeMaN  ');assert.equal(ok.status,200);assert.equal(ok.body.redirectTo,'/guide');assert.ok(ok.body.user.roles.some(r=>r.roleCode==='SUPREME_GUIDE'));assert.ok(!JSON.stringify(ok.body).includes('password'));pass('Aseman login accepts case and outer whitespace and routes to guide');
 assert.match(ok.headers.get('set-cookie'),/HttpOnly/);assert.match(ok.headers.get('set-cookie'),/SameSite=Strict/i);assert.equal(ok.headers.get('cache-control'),'no-store');
 const token=ok.cookie.split('=')[1];assert.match(token,/^[A-Za-z0-9_-]{43}$/);const stored=(await pool.query('SELECT token_hash,expires_at FROM identity.auth_sessions WHERE id=$1',[ok.body.user.sessionId])).rows[0];assert.equal(stored.token_hash,createHash('sha256').update(token).digest('hex'));assert.ok(new Date(stored.expires_at)>new Date());pass('Opaque HttpOnly/Strict cookie, hashed server token, expiry and no-store');
 assert.equal((await req('me',{cookie:ok.cookie})).status,200);assert.equal((await req('guide-home',{cookie:ok.cookie})).status,200);pass('Session restores identity and authorizes guide endpoint');
 const old=ok;ok=await login('Aseman',password,old.cookie);assert.notEqual(ok.cookie,old.cookie);assert.equal((await req('me',{cookie:old.cookie})).status,401);pass('Re-login rotates token and revokes previous session');
 assert.equal((await req('logout',{method:'POST',cookie:ok.cookie})).status,403);assert.equal((await req('logout',{method:'POST',cookie:ok.cookie,csrf:'wrong'})).status,403);assert.equal((await req('me',{cookie:ok.cookie})).status,200);pass('Missing or incorrect CSRF cannot log out a session');
 assert.equal((await req('login',{body:{username:'Aseman',password},origin:'https://evil.invalid'})).status,403);pass('Cross-origin login is rejected');
 const lo=await req('logout',{method:'POST',cookie:ok.cookie,csrf:ok.body.csrfToken});assert.equal(lo.status,200);assert.equal((await req('me',{cookie:ok.cookie})).status,401);pass('Logout revokes database session and clears cookie');
 for(const mobile of ['09121112233','۰۹۱۲۱۱۱۲۲۳۳','٠٩١٢١١١٢٢٣٣','+989121112233'])assert.equal((await login(mobile)).status,200);pass('Registered mobile works with Latin, Persian, Arabic and +98 input');
 ok=await login();await pool.query("UPDATE identity.auth_sessions SET expires_at=now()-interval '1 second' WHERE id=$1",[ok.body.user.sessionId]);assert.equal((await req('me',{cookie:ok.cookie})).status,401);pass('Expired session is rejected');
 await stop();await start();ok=await login();await pool.query("UPDATE identity.role_assignments SET valid_to=now()-interval '1 second' WHERE account_id=$1",[ok.body.user.accountId]);assert.equal((await req('guide-home',{cookie:ok.cookie})).status,403);await pool.query('UPDATE identity.role_assignments SET valid_to=NULL WHERE account_id=$1',[ok.body.user.accountId]);pass('Role revocation is enforced by server on existing session');
 await pool.query("UPDATE identity.accounts SET status='DISABLED' WHERE id=$1",[ok.body.user.accountId]);assert.equal((await req('me',{cookie:ok.cookie})).status,401);await pool.query("UPDATE identity.accounts SET status='ACTIVE' WHERE id=$1",[ok.body.user.accountId]);pass('Disabled account loses existing session access');
 const family=await fetch('http://127.0.0.1:3001/api/v1/families',{headers:{cookie:ok.cookie}});assert.equal(family.status,404);pass('Deferred family API is inactive');
 for(let i=0;i<9;i++)await login('missing_fixture');assert.equal((await login()).status,429);pass('Login rate limit blocks excess attempts');
 await stop();await start({COOKIE_SECURE:'true',APP_ENV:'production',FRONTEND_ORIGIN:'https://lahout.test'});const secure=await req('login',{body:{username:'Aseman',password},origin:'https://lahout.test'});assert.equal(secure.status,200);assert.match(secure.headers.get('set-cookie'),/; Secure/);pass('Production configuration issues Secure cookie');
 const {loadConfig}=require('../backend/dist/common/config.js');Object.assign(process.env,env,{APP_ENV:'production',COOKIE_SECURE:'false'});assert.throws(loadConfig);pass('Production refuses insecure cookie configuration');
 await stop();await start();
 const fl=openSync(path.join(out,'frontend.log'),'a');front=spawn(process.execPath,['tests/preview.mjs'],{cwd:root,env:{...process.env,PREVIEW_PORT:'5174',BACKEND_PROXY:'http://127.0.0.1:3001'},windowsHide:true,stdio:['ignore',fl,fl]});await waitReady('http://127.0.0.1:5174');
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE??'playwright');browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
 const context=await browser.newContext({viewport:{width:1366,height:900}});const page=await context.newPage();const pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));
 await page.goto('http://127.0.0.1:5174/guide');await page.waitForURL('**/login');assert.equal(await page.locator('html').getAttribute('dir'),'rtl');assert.equal(await page.locator('html').getAttribute('lang'),'fa');assert.equal(await page.locator('#username').inputValue(),'');await page.screenshot({path:path.join(out,'login-desktop.png'),fullPage:true});pass('Browser direct access redirects to blank Persian RTL login');
 await page.getByRole('button',{name:'ورود به سامانه'}).click();assert.equal(await page.locator('#username').getAttribute('aria-invalid'),'true');await page.locator('#username').fill('Aseman');await page.getByRole('button',{name:'ورود به سامانه'}).click();assert.equal(await page.locator('#password').getAttribute('aria-invalid'),'true');pass('Browser empty-field validation');
 await page.locator('#password').fill('wrong-password');await page.getByRole('button',{name:'نمایش رمز عبور',exact:true}).click();assert.equal(await page.locator('#password').getAttribute('type'),'text');await page.getByRole('button',{name:'پنهان کردن رمز عبور'}).click();await page.locator('#password').press('Enter');await page.getByRole('alert').waitFor();assert.equal(await page.locator('#password').inputValue(),'');pass('Password visibility toggle, Enter submit and safe failure');
 await page.locator('#password').fill(password);await page.locator('#password').press('Enter');await page.waitForURL('**/guide');await page.getByRole('heading',{name:'صفحه اصلی راهبر عالی'}).waitFor();await page.screenshot({path:path.join(out,'guide-desktop.png'),fullPage:true});assert.ok(!(await page.evaluate(()=>document.cookie)).includes('lahout_session'));pass('Browser Aseman login reaches authorized guide home with inaccessible cookie');
 await page.reload();await page.getByRole('heading',{name:'صفحه اصلی راهبر عالی'}).waitFor();pass('Browser refresh preserves session');
 await page.getByRole('button',{name:'خروج از حساب'}).click();await page.waitForURL('**/login');await page.goto('http://127.0.0.1:5174/guide');await page.waitForURL('**/login');pass('Browser logout prevents re-entry');
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(out,'login-mobile.png'),fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));pass('Mobile 390px layout has no horizontal overflow');
 await page.locator('#username').fill('Aseman');await page.locator('#password').fill(password);await page.locator('#password').press('Enter');await page.waitForURL('**/guide');await page.getByRole('heading',{name:'صفحه اصلی راهبر عالی'}).waitFor();await pool.query("UPDATE identity.auth_sessions SET expires_at=now()-interval '1 second'");await page.reload();await page.waitForURL('**/login');pass('Expired browser session returns to login');
 await page.route('**/api/v1/auth/login',route=>route.abort());await page.locator('#username').fill('Aseman');await page.locator('#password').fill(password);await page.locator('#password').press('Enter');await page.getByRole('alert').waitFor();assert.match(await page.getByRole('alert').innerText(),/ارتباط/);assert.equal(await page.getByRole('button',{name:'ورود به سامانه'}).isEnabled(),true);pass('Network failure is safe and submit recovers');
 assert.deepEqual(pageErrors,[]);pass('No browser JavaScript exceptions');
}catch(e){results.push({name:'Failure',status:'FAIL',error:e.message});console.error(e);process.exitCode=1;}
finally{if(browser)await browser.close();if(front)front.kill();await stop();await pool.end();await admin.query(`DROP DATABASE ${dbName} WITH (FORCE)`);await admin.end();writeFileSync(path.join(out,'results.json'),JSON.stringify({date:new Date().toISOString(),database:'Real PostgreSQL, isolated database removed after tests',results},null,2));}
