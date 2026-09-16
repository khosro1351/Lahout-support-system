import { Pool } from 'pg';
import argon2 from 'argon2';
async function main(){
 if(process.env.APP_ENV==='production')throw new Error('Development seed forbidden in production');
 if(!process.env.DATABASE_URL||!process.env.DEV_SEED_PASSWORD)throw new Error('Local database and temporary development password required');
 const pool=new Pool({connectionString:process.env.DATABASE_URL}),c=await pool.connect();
 try{await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(1405,5)');
 const guide=(await c.query("SELECT id FROM identity.accounts WHERE username='Aseman'")).rows[0];if(!guide)throw new Error('Seed Aseman first');
 const hash=await argon2.hash(process.env.DEV_SEED_PASSWORD,{type:argon2.argon2id});
 const accounts:string[]=[];
 for(const [username,name,role] of [['GuideDemoHelper','همیار آزمایشی','HELPER'],['GuideDemoManager','مدیر آزمایشی','EXECUTIVE_MANAGER']]){
 let a=(await c.query('SELECT id FROM identity.accounts WHERE username=$1',[username])).rows[0];
 if(!a){const p=(await c.query("INSERT INTO identity.people(first_name,last_name) VALUES($1,'Development/Test') RETURNING id",[name])).rows[0];a=(await c.query('INSERT INTO identity.accounts(person_id,username,password_hash) VALUES($1,$2,$3) RETURNING id',[p.id,username,hash])).rows[0];await c.query("INSERT INTO identity.role_assignments(account_id,role_code,scope_type) VALUES($1,$2,'ORGANIZATION')",[a.id,role]);}accounts.push(a.id);
 }
 if(!(await c.query("SELECT 1 FROM organization.groups WHERE code='DEV-GUIDE-01'")).rowCount){const g=(await c.query("INSERT INTO organization.groups(code,name) VALUES('DEV-GUIDE-01','گروه نمونه Development/Test') RETURNING id")).rows[0];await c.query("INSERT INTO identity.role_assignments(account_id,role_code,scope_type,scope_id) VALUES($1,'GROUP_LEADER','GROUP',$2)",[accounts[0],g.id]);await c.query("INSERT INTO family.families(family_code,current_group_id,created_by,neighborhood) VALUES('HL-DEV-GUIDE', $1,$2,'محله آزمایشی')",[g.id,guide.id]);}
 const sampleId='14050000-0000-4000-8000-000000000005';
 if(!(await c.query('SELECT 1 FROM guidance.items WHERE id=$1',[sampleId])).rowCount){await c.query("INSERT INTO guidance.items(id,kind,subject,body,created_by,audience_type) VALUES($1,'COUNCIL','مصوبه نمونه Development/Test','بررسی یک پیشنهاد آزمایشی شورا؛ داده واقعی نیست.',$2,'GUIDE')",[sampleId,accounts[1]]);await c.query('INSERT INTO guidance.recipients(item_id,account_id) VALUES($1,$2)',[sampleId,guide.id]);await c.query("INSERT INTO guidance.history(entity_type,entity_id,actor_id,action,new_state) VALUES('ITEM',$1,$2,'CREATED',$3)",[sampleId,accounts[1],JSON.stringify({development:true,subject:'مصوبه نمونه Development/Test'})]);}
 await c.query('COMMIT');console.log('Guide Development/Test seed complete; existing records and passwords preserved.');
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();await pool.end();}
}
main().catch(()=>{console.error('Guide development seed failed');process.exitCode=1;});
