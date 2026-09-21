import {Pool} from 'pg';
async function main(){
 if(process.env.APP_ENV!=='development'||!process.env.DATABASE_URL)throw new Error('Development/Test only');
 const pool=new Pool({connectionString:process.env.DATABASE_URL}),c=await pool.connect();
 try{await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(1405,9)');
 if((await c.query("SELECT 1 FROM monitoring.seed_batches WHERE key='family-read-context-development-v1'")).rowCount){await c.query('COMMIT');return;}
 const r=(await c.query("SELECT r.* FROM family.research_records r JOIN family.families f ON f.id=r.family_id WHERE f.family_code LIKE 'HL-TEST-%' ORDER BY f.family_code LIMIT 1")).rows[0];
 if(!r)throw new Error('Run existing guide Development/Test seed first');
 const actor=(await c.query("SELECT id FROM identity.accounts WHERE username='Aseman'")).rows[0].id;
 const council=(await c.query("SELECT id FROM guidance.items WHERE kind='COUNCIL' AND archive_final ORDER BY created_at LIMIT 1")).rows[0];
 await c.query('INSERT INTO family.investigation_context(research_id,subject,referral_reason,council_item_id,board_snapshot,findings,final_result,actor_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[r.id,'بررسی وضعیت مسکن — آزمایشی','داده ساختگی Development/Test برای بررسی نمایش',council?.id??null,JSON.stringify([{name:'عضو اول آزمایشی',responsibility:'سرگروه هیأت'},{name:'عضو دوم آزمایشی',responsibility:'عضو هیأت'},{name:'عضو سوم آزمایشی',responsibility:'عضو هیأت'}]),'یافته آزمایشی؛ فاقد اعتبار عملیاتی','نتیجه آزمایشی جهت بررسی رابط',actor]);
 for(const summary of ['بازدید اولیه آزمایشی از محل سکونت','بازدید دوم آزمایشی و تکمیل شواهد'])await c.query('INSERT INTO family.investigation_visits(research_id,visited_at,location,summary,actor_id) VALUES($1,now(),$2,$3,$4)',[r.id,'نشانی ساختگی Development/Test',summary,actor]);
 const person=(await c.query('SELECT person_id FROM family.family_memberships WHERE family_id=$1 AND valid_to IS NULL ORDER BY person_id LIMIT 1',[r.family_id])).rows[0];
 const document=(await c.query("INSERT INTO family.documents(family_id,name,media_type,content) VALUES($1,'شاهد آزمایشی عضو.txt','text/plain',$2) RETURNING id",[r.family_id,Buffer.from('Development/Test synthetic evidence')])).rows[0];
 await c.query("INSERT INTO family.document_context(document_id,person_id,category,actor_id) VALUES($1,$2,'شاهد آزمایشی',$3)",[document.id,person.person_id,actor]);
 await c.query("INSERT INTO family.case_notes(family_id,body,actor_id) VALUES($1,'یادداشت آزمایشی درباره پیگیری خانواده؛ این متن هشدار نیست.',$2)",[r.family_id,actor]);
 await c.query("INSERT INTO family.case_notes(family_id,person_id,body,actor_id) VALUES($1,$2,'یادداشت اختصاصی عضو — داده آزمایشی',$3)",[r.family_id,person.person_id,actor]);
 await c.query("INSERT INTO monitoring.seed_batches(key) VALUES('family-read-context-development-v1')");await c.query('COMMIT');console.log('Development/Test read context seeded; existing records preserved.');
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();await pool.end();}
}
main().catch(()=>{console.error('Read context seed failed; verify development configuration and baseline seed.');process.exitCode=1;});
