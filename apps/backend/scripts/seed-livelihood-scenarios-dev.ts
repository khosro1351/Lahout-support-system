import {DocumentsService} from '../src/documents/documents.service';
/** Synthetic development fixtures only. Never reset a review or impersonate a real decision. */
import 'reflect-metadata';
import {Pool, PoolClient} from 'pg';
import {createHash} from 'node:crypto';
import {LivelihoodService} from '../src/livelihood/livelihood.service';
import {GuidanceService} from '../src/guidance/guidance.service';
import {schema, checks, emptyPayload} from '../src/livelihood/livelihood.schema';

const SOURCE = 'LIVELIHOOD_DEMO_50_V1 DEVELOPMENT/TEST ONLY';
const uid = (key:string) => {
  const h=createHash('sha256').update('lahout-livelihood-v100-test:'+key).digest('hex');
  return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;
};
// Ten digits, deliberately wrong Iranian check digit; not an identity record.
function invalidNationalId(index:number) {
  const prefix=String(880000000+index), sum=[...prefix].reduce((s,v,i)=>s+Number(v)*(10-i),0)%11;
  const correct=sum<2?sum:11-sum;
  return prefix+String((correct+1)%10);
}
const reasons=[
  'مبلغ درآمد ماهانه با شرح کار روزمزدی تطابق ندارد؛ تعداد روزهای کار و مبلغ دریافتی دوباره بررسی و توضیح داده شود.',
  'مدرک بدهی، مانده تعهد و مبلغ قسط را به‌روشنی نشان نمی‌دهد؛ توضیح تکمیلی و شاهد خوانا ثبت شود.',
  'منبع دوم تأمین معاش مشخص نیست؛ پرداخت‌کننده، استمرار کمک و سهم آن در بودجه خانواده روشن شود.',
  'هزینه ضروری ثبت‌شده نیازمند توضیح و مستند تکمیلی درباره دوره پرداخت و اثر آن بر خوراک خانواده است.',
  'وضعیت اشتغال عضو مؤثر خانواده روشن نیست؛ مهارت، امکان کار و مانع دسترسی به شغل جداگانه توضیح داده شود.',
  'شرح معوقات اجاره با مبلغ هزینه ماهانه یکسان نوشته شده است؛ بدهی انباشته از اجاره جاری تفکیک و دوباره ارسال شود.',
  'در توضیح حمایت بستگان، مبلغ هفتگی و ماهانه با هم آمده است؛ دوره دریافت و استمرار آن بازبینی شود.',
  'جمع‌بندی فشار هزینه‌ها کوتاه است؛ دلیل انتخاب گزینه و شواهد مربوط به هزینه‌های ضروری با شرح کافی ثبت شود.'
];
function scenario(g:number,n:number) {
  if(n<=4)return 'APPROVED';
  if(n<=6)return 'SUBMITTED';
  if(n===7||(n===8&&g<=3))return 'RETURNED';
  return n===10?'UNKNOWN':'IN_PROGRESS';
}
async function main() {
  if(process.env.APP_ENV!=='development')throw new Error('Development-only seed; APP_ENV must be development');
  const pool=new Pool({connectionString:process.env.DATABASE_URL}), c=await pool.connect();
  const service=new LivelihoodService(pool,new GuidanceService(pool),new DocumentsService(pool,new GuidanceService(pool)));
  let created=0, skipped=0, returnIndex=0;
  try {
    await c.query('BEGIN');
    await c.query('SELECT pg_advisory_xact_lock(1405,11)');
    await c.query('SELECT pg_advisory_xact_lock(1405,5)');
    const model=await service.model(c);
    if(!model)throw new Error('Run migrations and base livelihood development seed first');
    const families=(await c.query("SELECT f.*,g.name AS group_name,p.provenance FROM family.families f JOIN organization.groups g ON g.id=f.current_group_id JOIN family.case_profiles p ON p.family_id=f.id WHERE f.family_code ~ '^HL-TEST-G[1-5]-(0[1-9]|10)$' ORDER BY f.family_code FOR UPDATE OF f")).rows;
    if(families.length!==50)throw new Error('Expected exactly 50 existing V100 test families; run base seed first');
    const executive=uid('account:Executive');
    for(const f of families) {
      const key=f.family_code.slice(8), g=Number(key[1]), n=Number(key.slice(3)), index=(g-1)*10+n-1;
      const target=scenario(g,n), reason=target==='RETURNED'?reasons[returnIndex++]:null;
      const leader=uid('account:Leader'+g), group=uid('group:'+g);
      if(f.id!==uid('family:'+key)||f.current_group_id!==group||f.created_by!==leader||f.provenance!=='V100 DEVELOPMENT/TEST ONLY — no full assessment')throw new Error('Refusing non-fixture or reassigned family '+f.family_code);
      const marker=(await c.query("SELECT 1 FROM guidance.history WHERE entity_id=$1 AND action='LIVELIHOOD_DEMO_SEEDED' AND new_state->>'source'=$2",[f.id,SOURCE])).rowCount;
      if(marker){skipped++;continue;}
      if(f.version!==1||(await c.query('SELECT 1 FROM assessment.domain_reviews WHERE family_id=$1',[f.id])).rowCount)throw new Error('Existing edits/review preserved; cannot enrich '+f.family_code);
      for(const [account,role,scope] of [[leader,'GROUP_LEADER',group],[executive,'EXECUTIVE_MANAGER',null]]) {
        if(!(await c.query("SELECT 1 FROM identity.accounts a JOIN identity.role_assignments r ON r.account_id=a.id WHERE a.id=$1 AND a.username LIKE 'TestV100_%' AND a.status='ACTIVE' AND r.role_code=$2 AND r.scope_id IS NOT DISTINCT FROM $3::uuid AND r.valid_from<=now() AND (r.valid_to IS NULL OR r.valid_to>now())",[account,role,scope])).rowCount)throw new Error('Fixture actor or role missing');
      }
      const time=new Date(); time.setUTCDate(time.getUTCDate()-(3+index));time.setUTCHours(10,index%60,0,0);
      const decisionAt=time.toISOString(), submittedAt=new Date(+time-86400000).toISOString(), createdAt=new Date(+time-2*86400000).toISOString();
      const residence=['اجاره‌ای','با بستگان','ملکی','موقت','رهن/ودیعه'][index%5];
      const neighborhood=['محله بهاران، کوچه باغ انار، بن‌بست دوم','محله گلستان، خیابان فرهنگ، نزدیک میدان کتاب','محله چشمه‌سار، خیابان سروهای بلند، کوچه همدلی شرقی، ساختمان آفتاب، طبقه دوم'][index%3];
      await c.query('UPDATE family.families SET neighborhood=$2,basic_data=$3,version=version+1,updated_at=now() WHERE id=$1',[f.id,neighborhood,JSON.stringify({residenceType:residence,formedOn:createdAt.slice(0,10),source:SOURCE+' — تمام مشخصات، تماس‌ها و رویدادها فرضی هستند'})]);
      const size=2+index%5;
      for(let m=0;m<Math.max(size,3);m++) {
        const person=uid('member:'+key+':'+m);
        if(m>=size){await c.query('UPDATE family.family_memberships SET valid_to=current_date WHERE family_id=$1 AND person_id=$2 AND valid_to IS NULL',[f.id,person]);continue;}
        const headAge=[34,46,61,29,72][index%5];
        const age=m===0?headAge:m===1?(index%5===0?76:index%4===0?Math.min(16,headAge-20):headAge-3):[7,13,19,68][(m-2)%4];
        const rel=m===0?'HEAD':m===1?(index%5===0?'PARENT':index%4===0?'CHILD':'SPOUSE'):(m===5?'SIBLING':'CHILD');
        const first=['آرزو','فرهاد','باران','آرین','نرگس','سامان'][(index+m)%6];
        const last=index%7===0?'مهرآیین باغستانی نیک‌اندیش':'مهرآیین';
        const birth=`${time.getUTCFullYear()-age}-${String(1+index%12).padStart(2,'0')}-${String(1+(index+m)%27).padStart(2,'0')}`;
        const profile={age,education:age<6?'زیر سن تحصیل':age<19?'در حال تحصیل — اطلاعات زمینه‌ای':'خارج از تحصیل',health:'اطلاعات زمینه‌ای؛ حوزه سلامت ارزیابی نشده است',notes:SOURCE+'؛ '+(rel==='HEAD'&&index%4===0?'خانواده تک‌سرپرست؛ ':'')+(age>65?'عضو سالمند؛ ':'')};
        // Prefix 0900 provides phone-shaped, synthetic fixtures; never send messages/calls.
        const phone=m===0?'0900'+String(1000000+index).padStart(7,'0'):null;
        if(m<3){
          const existing=(await c.query('SELECT p.national_id FROM identity.people p JOIN family.family_memberships m ON m.person_id=p.id WHERE p.id=$1 AND m.family_id=$2 AND m.valid_to IS NULL',[person,f.id])).rows[0];
          if(!existing?.national_id?.startsWith('TEST-'+key+'-'))throw new Error('Existing member edits preserved');
          await c.query('UPDATE identity.people SET national_id=$2,mobile=$3,birth_date=$4,first_name=CASE WHEN $5 THEN first_name ELSE $6 END,last_name=CASE WHEN $5 THEN last_name ELSE $7 END,updated_at=now() WHERE id=$1',[person,invalidNationalId(index*6+m),phone,birth,m===0,first,last]);
          await c.query('UPDATE family.family_memberships SET relationship_code=$3,profile_data=$4 WHERE family_id=$1 AND person_id=$2',[f.id,person,rel,JSON.stringify(profile)]);
        }else{
          await c.query('INSERT INTO identity.people(id,first_name,last_name,national_id,birth_date) VALUES($1,$2,$3,$4,$5)',[person,first,last,invalidNationalId(index*6+m),birth]);
          await c.query('INSERT INTO family.family_memberships(family_id,person_id,relationship_code,profile_data) VALUES($1,$2,$3,$4)',[f.id,person,rel,JSON.stringify(profile)]);
        }
      }
      const docCategory=['INCOME','DEBT','EXPENSE'][index%3];
      if(!(target==='UNKNOWN'&&g===4)) {
        const doc=(await c.query("INSERT INTO family.documents(family_id,name,media_type,content) VALUES($1,$2,'text/plain',$3) RETURNING id",[f.id,['نمونه آزمایشی گواهی مستمری و توضیح دوره دریافت','نمونه آزمایشی صورت تعهدات و مانده اقساط بدهی خانواده','نمونه آزمایشی رسید هزینه‌های ضروری و شرح پرداخت چندمرحله‌ای سرگروه'][index%3]+'.txt',Buffer.from(SOURCE+'\n'+decisionAt+'\nثبت‌شده؛ مدرک واقعی نیست.')])).rows[0];
        await c.query('INSERT INTO family.document_context(document_id,category,actor_id) VALUES($1,$2,$3)',[doc.id,docCategory,leader]);
      }
      const current=(await c.query('SELECT f.*,g.name AS group_name FROM family.families f JOIN organization.groups g ON g.id=f.current_group_id WHERE f.id=$1',[f.id])).rows[0];
      const base=await service.basics(c,current), p:any=emptyPayload();
      // Different option combinations across the entire 0..30 range; score is never supplied.
      const options=[['0','0','0','0'],['0','1','1','1'],['1','0','0','1'],['1','1','1','1'],['1','2','1','2'],['2','1','1','1'],['2','2','3','0'],['3','1','2','2'],['3','2','3','1'],['3','3','3','3'],['3','3','2','2'],['2','2','2','2'],['0','1','0','2'],['2','0','1','1'],['1','2','2','0'],['3','1','3','0'],['3','2','2','3']];
      const selected=options[(index*7)%options.length];
      p.summaries=Object.fromEntries(['adequacy','stability','pressure','debt'].map((k,i)=>[k,selected[i]]));
      const noIncome=selected[1]==='3';
      const kinds=['حقوق','کار روزمزدی/موردی','کار فصلی','خوداشتغالی محدود','مستمری','کمک بستگان','کمک نهادها/کانون','درآمد اعضای خانواده','سایر'];
      const incomeType=noIncome?'بدون درآمد':kinds[index%kinds.length];
      p.income=[{type:incomeType,recipient:'سرپرست و اعضای خانواده — داده فرضی',amount:noIncome?0:[26000000,18500000,11200000,5400000][Number(selected[0])]+index*35000,period:noIncome?'بدون دریافت':incomeType==='کار فصلی'?'فصلی':'ماهانه',continuity:noIncome?'فاقد منبع':['پایدار','نسبتاً پایدار','موقت'][Number(selected[1])],notes:'داده کاملاً فرضی؛ '+(incomeType==='سایر'?'کار موقت بسته‌بندی و آماده‌سازی محصولات خانگی؛ ':'')+'گزینه جمع‌بندی بر مبنای ظرفیت خانواده، اندازه خانوار و شرح نیازها انتخاب شده است.'}];
      if(!noIncome&&index%3===0)p.income.push({type:'کمک بستگان',recipient:'کمک غیرمستمر خواهر سرپرست',amount:750000+index*10000,period:'نامنظم',continuity:'ناپایدار',notes:'منبع دوم فرضی؛ وعده پرداخت به‌عنوان درآمد قطعی ثبت نشده است.'});
      p.employment=base.members.map((member:any,i:number)=>({memberId:member.id,state:member.profile_data.age<18?'کودک / خارج از سن کار':i===0?(noIncome?'بدون شغل و درآمد':incomeType==='مستمری'?'مستمری':'کار روزمزدی/موردی'):'بیکار با درآمد محدود از منابع دیگر',ability:member.profile_data.age<18||member.profile_data.age>65?'ندارد':'دارد',skill:i===0?'تعمیر و بازسازی وسایل خانگی و خیاطی سفارشی در مقیاس محدود':'مهارت عمومی',barrier:member.profile_data.age<18?'خارج از سن کار':member.profile_data.age>65?'سالمندی و محدودیت توان انجام کار مستمر':['ندارد','مهارت دارد ولی فرصت شغلی مناسب در دسترس نیست','مراقبت از عضو خانواده و محدودیت زمان برای اشتغال','نداشتن ابزار و سرمایه اولیه'][index%4],notes:'فقط زمینه اشتغال؛ بدون امتیاز مستقل'}));
      p.expenses=schema.expenses[0].options!.map((type,i)=>{const zero=(i===1&&residence==='ملکی')||(i===6&&selected[3]==='0')||(i===4&&!base.members.some((m:any)=>m.profile_data.age>=6&&m.profile_data.age<19));return {type,amount:zero?0:[6500000,9000000,850000,1100000,650000,500000,1900000,350000][i]+index*17000,payment:zero?'هزینه‌ای ندارد':Number(selected[2])<2?'پرداخت‌شده':['بخشی پرداخت‌شده','معوق'][i%2],effect:zero?'هزینه مؤثری در این بخش وجود ندارد':'شرح فرضی اثر هزینه بر بودجه جاری و تأمین نیازهای پایه خانواده؛ '+model.definition.indicators[2].options[Number(selected[2])].label,evidence:'گفت‌وگوی فرضی با سرپرست و مرور هزینه‌های یک ماه؛ این مبلغ سند پرداخت واقعی نیست.'};});
      p.evidence=[{source:'گفت‌وگوی مستقیم با خانواده',description:'سناریوی آزمایشی گفت‌وگو درباره درآمدها، هزینه‌های ضروری و اقساط؛ هیچ مصاحبه واقعی انجام نشده است.'}];
      p.checks=checks.map(()=>true);p.urgency=['NON_URGENT','IMPORTANT','NECESSARY'][index%3];
      p.notes='جمع‌بندی آزمایشی سرگروه: '+model.definition.indicators.map((v:any,i:number)=>v.label+' '+v.options[Number(selected[i])].label).join('؛ ')+'؛ ظرفیت کار اعضا و حمایت ناپایدار بستگان به‌عنوان اطلاعات زمینه‌ای بررسی شده است. سایر حوزه‌ها ارزیابی نشده‌اند.';
      if(target==='IN_PROGRESS'){p.checks[9]=false;p.notes='در حال تکمیل گفت‌وگوی فرضی؛ جمع‌بندی نهایی هنوز انجام نشده است.';p.evidence=[];}
      if(target==='UNKNOWN'){
        p.checks[4]=false;
        if(g===1)p.income[0].type='UNKNOWN';
        if(g===2)delete p.income[0].amount;
        if(g===3)p.summaries.debt='UNKNOWN';
        if(g===4)p.evidence=[{source:'مدرک رسمی',description:'مدرک موضوعی هزینه هنوز تحویل نشده است — سناریوی نقص واقعی'}];
        if(g===5)p.employment=[];
      }
      const payload=service.payload(p), result=service.evaluate(payload,base,model.definition);
      if(['APPROVED','SUBMITTED','RETURNED'].includes(target)&&!result.complete)throw new Error('Invalid complete fixture: '+result.missing.join(', '));
      if(['UNKNOWN','IN_PROGRESS'].includes(target)&&result.complete)throw new Error('Incomplete fixture unexpectedly complete');
      const reviewId=uid('demo-review:'+key);
      await c.query("INSERT INTO assessment.domain_reviews(id,family_id,domain_code,model_id,payload,state,created_by,created_at,updated_at) VALUES($1,$2,'LIVELIHOOD',$3,$4,'DRAFT',$5,$6,$6)",[reviewId,f.id,model.id,JSON.stringify(payload),leader,createdAt]);
      await history(c,f.id,leader,'GROUP_LEADER',group,'LIVELIHOOD_CREATED',createdAt,{reviewId,source:SOURCE,scenario:target});
      if(['APPROVED','SUBMITTED','RETURNED'].includes(target)){
        const sid=uid('demo-submission:'+key), snapshot={...base,family:{...base.family,headName:base.members.filter((m:any)=>m.relationship_code==='HEAD').map((m:any)=>m.first_name+' '+m.last_name)[0]},payload,result,modelVersion:model.version,modelDefinition:model.definition,formSchema:model.form_schema,reviewId,revision:1,submittedBy:leader,effectiveRole:'GROUP_LEADER',simulation:false,seedSource:SOURCE};
        await c.query('INSERT INTO assessment.domain_submissions(id,review_id,revision,snapshot,submitted_by,submitted_at) VALUES($1,$2,1,$3,$4,$5)',[sid,reviewId,JSON.stringify(snapshot),leader,submittedAt]);
        await c.query("UPDATE assessment.domain_reviews SET state='SUBMITTED',version=version+1,updated_at=$2 WHERE id=$1",[reviewId,submittedAt]);
        await history(c,f.id,leader,'GROUP_LEADER',group,'LIVELIHOOD_SUBMITTED',submittedAt,{submissionId:sid,result,source:SOURCE});
        if(target!=='SUBMITTED'){
          await c.query("UPDATE assessment.domain_reviews SET state='IN_REVIEW',version=version+1 WHERE id=$1",[reviewId]);
          await history(c,f.id,executive,'EXECUTIVE_MANAGER',null,'LIVELIHOOD_REVIEW_STARTED',decisionAt,{submissionId:sid,source:SOURCE});
          await c.query("INSERT INTO assessment.domain_decisions(submission_id,decision,reason,decided_by,decided_at,valid_until) VALUES($1,$2,$3,$4,$5,CASE WHEN $2='APPROVED' THEN $5::timestamptz+interval '1 year' ELSE NULL END)",[sid,target,reason,executive,decisionAt]);
          await c.query('UPDATE assessment.domain_reviews SET state=$2,version=version+1,updated_at=$3 WHERE id=$1',[reviewId,target,decisionAt]);
          await history(c,f.id,executive,'EXECUTIVE_MANAGER',null,'LIVELIHOOD_'+target,decisionAt,{submissionId:sid,source:SOURCE},reason);
        }
      }
      await history(c,f.id,leader,'GROUP_LEADER',group,'LIVELIHOOD_DEMO_SEEDED',new Date().toISOString(),{source:SOURCE,scenario:target,reviewId});
      created++;
    }
    await c.query('COMMIT');
    console.log(JSON.stringify({source:SOURCE,created,skipped,preserved:'Existing marked fixtures, user edits and immutable decisions are never reset'}));
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();await pool.end();}
}
async function history(c:PoolClient,family:string,actor:string,role:string,group:string|null,action:string,at:string,next:any,reason:string|null=null){
  const scopes=JSON.stringify([{roleCode:role,scopeType:group?'GROUP':'ORGANIZATION',scopeId:group}]);
  await c.query("INSERT INTO guidance.history(entity_type,entity_id,actor_id,action,new_state,reason,effective_role,effective_scopes,simulation,occurred_at) VALUES('FAMILY',$1,$2,$3,$4,$5,$6,$7,false,$8)",[family,actor,action,JSON.stringify(next),reason,role,scopes,at]);
  await c.query("INSERT INTO admin.audit_events(event_type,entity_type,entity_id,actor_account_id,metadata,effective_role,effective_scopes,simulation,occurred_at) VALUES($1,'FAMILY',$2,$3,$4,$5,$6,false,$7)",['GUIDE_'+action,family,actor,JSON.stringify({next,reason,source:SOURCE}),role,scopes,at]);
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
