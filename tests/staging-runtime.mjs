import {dropTestDatabase} from './database-cleanup.mjs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {spawn,spawnSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {mkdirSync,writeFileSync,openSync} from 'node:fs';
import path from 'node:path';
const root=fileURLToPath(new URL('..',import.meta.url)),backend=path.join(root,'apps/backend');
const require=createRequire(path.join(backend,'package.json')), {Pool}=require('pg');
const adminUrl=process.env.TEST_DATABASE_ADMIN_URL||process.env.DATABASE_URL;
if(!adminUrl)throw new Error('Test PostgreSQL URL required');
const db='lahout_staging_test_'+Date.now(),admin=new Pool({connectionString:adminUrl});
const url=new URL(adminUrl);url.pathname='/'+db;
const secret=randomBytes(32).toString('base64url');
const env={...process.env,APP_ENV:'staging',DATABASE_URL:url.href,STAGING_SEED_ENABLED:'true',STAGING_GUIDE_PASSWORD:secret,PORT:'3012',RENDER_EXTERNAL_URL:'https://lahout-staging.invalid',FRONTEND_ORIGIN:'https://lahout-staging.invalid'};
const out=path.join(root,'test-results/staging');mkdirSync(out,{recursive:true});
const results=[];const pass=name=>{results.push({name,status:'PASS'});console.log('PASS '+name);};let child;await admin.query('CREATE DATABASE '+db);const pool=new Pool({connectionString:url.href});
try {
 const prepare=extra=>spawnSync(process.execPath,['scripts/prepare-staging.mjs'],{cwd:root,env:{...env,...extra},encoding:'utf8',windowsHide:true});
 await assert.rejects(dropTestDatabase(admin,'lahout_local'),/non-test database/);
 assert.notEqual(prepare({APP_ENV:'production'}).status,0);assert.notEqual(prepare({DATABASE_URL:adminUrl}).status,0);pass('Staging preparation rejects production and non-staging databases');
 assert.equal(prepare({}).status,0);const before=(await pool.query("SELECT password_hash FROM identity.accounts WHERE username='Aseman'")).rows[0].password_hash;
 assert.equal(prepare({STAGING_GUIDE_PASSWORD:randomBytes(32).toString('base64url')}).status,0);assert.equal((await pool.query("SELECT password_hash FROM identity.accounts WHERE username='Aseman'")).rows[0].password_hash,before);assert.equal((await pool.query('SELECT count(*)::int n FROM core.schema_migrations')).rows[0].n,12);pass('Dedicated staging database: twelve migrations, synthetic seed, repeat preserves account password');
 const log=openSync(path.join(out,'runtime.log'),'a');child=spawn(process.execPath,['scripts/start-staging.mjs'],{cwd:root,env,windowsHide:true,stdio:['ignore',log,log]});
 let ready=false;for(let i=0;i<100;i++){try{const r=await fetch('http://127.0.0.1:3012/api/v1/health/ready');if(r.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}assert.ok(ready);pass('Cloud launcher binds public port and health verifies real PostgreSQL');
 const base='http://127.0.0.1:3012';for(const route of ['/login','/guide','/guide/families/test/assessments','/workspace/health/test']){const r=await fetch(base+route);assert.equal(r.status,200);assert.match(await r.text(),/<div id="root">/);}
 const html=await(await fetch(base+'/login')).text();const asset=html.match(/src="([^"]+\.js)"/)[1];const js=await fetch(base+asset);assert.equal(js.status,200);assert.match(js.headers.get('content-type'),/javascript/);
 for(const route of ['/.env','/assets/missing.js','/api/v1/not-real','/package.json'])assert.equal((await fetch(base+route)).status,404);pass('Single-origin compiled UI, deep links and assets work; private files and unknown APIs remain unavailable');
 const login=await fetch(base+'/api/v1/auth/login',{method:'POST',headers:{origin:env.FRONTEND_ORIGIN,'content-type':'application/json'},body:JSON.stringify({username:'Aseman',password:secret})});assert.equal(login.status,200);assert.match(login.headers.get('set-cookie'),/Secure/);assert.match(login.headers.get('set-cookie'),/HttpOnly/);assert.equal((await login.json()).redirectTo,'/guide');pass('Staging-only guide login uses secure session cookie and role routing');
} catch(e){results.push({name:'suite',status:'FAIL',message:e.message});throw e;}
finally{if(child&&child.exitCode===null){child.kill();await new Promise(r=>child.once('exit',r));}await pool.end();await dropTestDatabase(admin, db);await admin.end();writeFileSync(path.join(out,'results.json'),JSON.stringify({date:new Date().toISOString(),results},null,2));}
