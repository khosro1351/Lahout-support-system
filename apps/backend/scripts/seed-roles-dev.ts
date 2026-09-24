import {Pool} from 'pg';
import argon2 from 'argon2';
async function main(){
 if(process.env.APP_ENV!=='development'||!process.env.DEV_SEED_PASSWORD||process.env.DEV_SEED_PASSWORD.length<12)throw new Error('Development environment and DEV_SEED_PASSWORD (12+ characters) required');
 const pool=new Pool({connectionString:process.env.DATABASE_URL}),c=await pool.connect();
 try{await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(1405,10)');
 const developmentGroups:Record<string,string>={};
 for(const key of ['LeaderDev','MultiRoleDev']){await c.query("INSERT INTO organization.groups(code,name) VALUES($1,$2) ON CONFLICT(code) DO NOTHING",['ROLE-TEST-'+key,'گروه آزمایش نقش '+key]);developmentGroups[key]=(await c.query('SELECT id FROM organization.groups WHERE code=$1',['ROLE-TEST-'+key])).rows[0].id;}
 const hash=await argon2.hash(process.env.DEV_SEED_PASSWORD,{type:argon2.argon2id});
 for(const [name,label,roles] of [['TechSupportDev','پشتیبان فنی',['TECH_ADMIN']],['LeaderDev','سرگروه',['GROUP_LEADER']],['ExecutiveDev','مدیر اجرایی',['EXECUTIVE_MANAGER']],['HelperDev','همیار گروه',['HELPER']],['CouncilDev','عضو شورا',['COUNCIL_MEMBER']],['MultiRoleDev','کاربر چندنقشی',['GROUP_LEADER','COUNCIL_MEMBER']]] as const){
  // Existing accounts and passwords are never overwritten or assigned new roles.
  if((await c.query('SELECT 1 FROM identity.accounts WHERE lower(username)=lower($1)',[name])).rowCount)continue;
  const person=(await c.query("INSERT INTO identity.people(first_name,last_name) VALUES($1,'آزمایشی توسعه') RETURNING id",[label])).rows[0];
  const account=(await c.query('INSERT INTO identity.accounts(person_id,username,password_hash) VALUES($1,$2,$3) RETURNING id',[person.id,name,hash])).rows[0];
  for(const code of roles){const scoped=['GROUP_LEADER','HELPER'].includes(code);await c.query('INSERT INTO identity.role_assignments(account_id,role_code,scope_type,scope_id) VALUES($1,$2,$3,$4)',[account.id,code,scoped?'GROUP':'ORGANIZATION',scoped?developmentGroups[name]??developmentGroups.LeaderDev:null]);}
  await c.query("INSERT INTO admin.audit_events(event_type,entity_type,entity_id,metadata) VALUES('DEVELOPMENT_ROLE_ACCOUNT_CREATED','ACCOUNT',$1,$2)",[account.id,JSON.stringify({source:'DEVELOPMENT/TEST ONLY'})]);
 }
 await c.query('COMMIT');console.log('Development role accounts ready; existing accounts and passwords preserved.');
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();await pool.end();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
