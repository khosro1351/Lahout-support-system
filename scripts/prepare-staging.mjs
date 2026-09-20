import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
const root=fileURLToPath(new URL('..',import.meta.url));
if(process.env.APP_ENV!=='staging')throw new Error('Staging preparation requires APP_ENV=staging');
const database=new URL(process.env.DATABASE_URL||'');
if(!decodeURIComponent(database.pathname).includes('staging'))throw new Error('Use a dedicated database with staging in its name');
function run(script,extra={}){
 const r=spawnSync(process.execPath,['.tools/scripts/'+script+'.js'],{cwd:path.join(root,'apps/backend'),env:{...process.env,...extra},stdio:'pipe',windowsHide:true,encoding:'utf8'});
 if(r.status!==0)throw new Error('Staging preparation failed at '+script+'; inspect database availability/configuration. No secrets logged.');
 console.log('Completed '+script);
}
run('migrate');
if(process.env.STAGING_SEED_ENABLED==='true'){
 const password=process.env.STAGING_GUIDE_PASSWORD;
 if(!password||password.length<16)throw new Error('Set a staging-only guide password of at least 16 characters in hosting secrets');
 run('seed-dev',{APP_ENV:'development',DEV_SEED_PASSWORD:password});
 run('seed-access-dev',{APP_ENV:'development'});
 run('seed-guide-dev',{APP_ENV:'development',DEV_SEED_PASSWORD:process.env.STAGING_FIXTURE_PASSWORD||randomBytes(32).toString('base64url')});
 console.log('Synthetic staging data ready. Existing passwords and decisions are preserved.');
}
