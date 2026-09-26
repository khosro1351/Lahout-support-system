import {Inject,Injectable} from '@nestjs/common';
import {Pool,PoolClient} from 'pg';
import {PG_POOL} from '../database/database.constants';
import {GuidanceService,id,input} from '../guidance/guidance.service';
import {recheckContext} from '../auth/role-context';
import type {AuthUser} from '../auth/auth.types';
import {AppError} from '../common/app-error';
import {schema,checks,documentKinds,emptyPayload,criticalOptions} from './livelihood.schema';
const known=(v:any)=>typeof v==='string'&&v.trim().length>0&&!['UNKNOWN','INCOMPLETE','NOT_RECORDED','نامشخص','نیازمند تکمیل','ثبت نشده','داده ناقص','نامشخص / نیازمند تکمیل'].includes(v.trim().replace(/\u200c/g,' ').replace(/\s+/g,' '));
const validDate=(v:any)=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
const text=(v:any,max=2000)=>typeof v==='string'&&v.length<=max?v.trim():'';
@Injectable()
export class LivelihoodService {
 constructor(@Inject(PG_POOL) private pool:Pool,private g:GuidanceService){}
 async access(db:Pool|PoolClient,familyId:string,u:AuthUser,edit=false){
 const f=(await db.query('SELECT f.*,g.name AS group_name FROM family.families f JOIN organization.groups g ON g.id=f.current_group_id WHERE f.id=$1',[id(familyId)])).rows[0];if(!f)throw new AppError(404,'NOT_FOUND','خانواده پیدا نشد.');
 const leader=u.roles.some(r=>r.roleCode==='GROUP_LEADER'&&r.scopeId===f.current_group_id);
 const read=leader||u.roles.some(r=>r.roleCode==='HELPER'&&r.scopeId===f.current_group_id)||['SUPREME_GUIDE','EXECUTIVE_MANAGER'].includes(u.effectiveRole??'');
 if(!read||edit&&!leader)throw new AppError(403,'SCOPE','این خانواده یا عملیات در محدوده نقش فعال نیست.');return f;
 }
 async basics(db:Pool|PoolClient,f:any){const members=(await db.query(`SELECT p.id,p.first_name,p.last_name,p.national_id,p.mobile,to_char(p.birth_date,'YYYY-MM-DD') AS birth_date,m.relationship_code,m.profile_data FROM family.family_memberships m JOIN identity.people p ON p.id=m.person_id WHERE m.family_id=$1 AND m.valid_to IS NULL ORDER BY CASE WHEN m.relationship_code='HEAD' THEN 0 ELSE 1 END,p.created_at,p.id`,[f.id])).rows;
 const documents=(await db.query('SELECT d.id,d.name,d.media_type,c.category FROM family.documents d LEFT JOIN family.document_context c ON c.document_id=d.id WHERE d.family_id=$1 ORDER BY d.id',[f.id])).rows;
 const activeCritical=(await db.query("SELECT subject FROM oversight.alerts WHERE family_id=$1 AND state<>'RESOLVED' AND severity='CRITICAL'",[f.id])).rows.map(a=>a.subject);
 return {activeCritical,family:{id:f.id,version:f.version,code:f.family_code,groupId:f.current_group_id,groupName:f.group_name,neighborhood:f.neighborhood,...f.basic_data},members,documents};}
 async model(db:Pool|PoolClient){return (await db.query("SELECT * FROM assessment.models WHERE version='1.00-LIVELIHOOD'")).rows[0];}
 async list(u:AuthUser){
 const scoped=['GROUP_LEADER','HELPER'].includes(u.effectiveRole??'');
 const scopes=u.roles.filter(r=>r.roleCode===u.effectiveRole&&r.scopeType==='GROUP').map(r=>r.scopeId);
 const rows=(await this.pool.query(`SELECT f.*,g.code AS group_code,g.name AS group_name,
 (SELECT p.first_name||' '||p.last_name FROM family.head_history h JOIN identity.people p ON p.id=h.person_id WHERE h.family_id=f.id AND h.valid_to IS NULL) AS head_name,
 r.state,r.id AS review_id,r.payload,r.updated_at AS review_updated_at,s.snapshot,s.submitted_at,d.valid_until,d.reason
 FROM family.families f JOIN organization.groups g ON g.id=f.current_group_id
 LEFT JOIN LATERAL(SELECT * FROM assessment.domain_reviews x WHERE x.family_id=f.id ORDER BY created_at DESC,id DESC LIMIT 1) r ON true
 LEFT JOIN LATERAL(SELECT * FROM assessment.domain_submissions x WHERE x.review_id=r.id ORDER BY revision DESC LIMIT 1) s ON true
 LEFT JOIN assessment.domain_decisions d ON d.submission_id=s.id
 WHERE (NOT $1::boolean OR f.current_group_id=ANY($2::uuid[])) ORDER BY f.family_code`,[scoped,scopes])).rows;
 const model=await this.model(this.pool),families=[];
 for(const f of rows){
 const base=await this.basics(this.pool,f);
 const frozen=['SUBMITTED','IN_REVIEW','APPROVED'].includes(f.state);
 const result=u.effectiveRole==='SUPREME_GUIDE'?(f.state==='APPROVED'?f.snapshot?.result:null):frozen?f.snapshot?.result:f.review_id&&model?this.evaluate(f.payload,base,model.definition):null;
 const expired=f.state==='APPROVED'&&f.valid_until&&new Date(f.valid_until)<new Date();
 const status=!f.review_id?'NOT_RECORDED':expired?'EXPIRED':f.state==='APPROVED'?'VALID':['SUBMITTED','IN_REVIEW'].includes(f.state)?'PENDING':f.state==='RETURNED'?'RETURNED':f.state==='READY'?'READY':'DRAFT';
 const alerts=(await this.pool.query("SELECT id,subject,severity,state FROM oversight.alerts WHERE family_id=$1 AND state<>'RESOLVED' ORDER BY created_at DESC",[f.id])).rows;
 const hasUnknown=(v:any):boolean=>v==='UNKNOWN'||(v!=null&&typeof v==='object'&&Object.values(v).some(hasUnknown));
 const dataStatus=!f.review_id?'NOT_RECORDED':!result?'UNKNOWN':result.complete?'COMPLETED':hasUnknown(f.payload)?'UNKNOWN':'INCOMPLETE';
 families.push({data_status:dataStatus,id:f.id,family_code:f.family_code,current_group_id:f.current_group_id,group_code:f.group_code,group_name:f.group_name,head_name:f.head_name,state:f.state,review_id:f.review_id,member_count:base.members.length,status,score:result?.score??null,urgency:result?.urgency??null,complete:result?.complete??false,missing:result?.missing??[],alerts,valid_until:f.valid_until,reason:u.effectiveRole!=='SUPREME_GUIDE'&&f.state==='RETURNED'?f.reason:null,updated_at:f.review_updated_at??f.updated_at,needs_action:['NOT_RECORDED','EXPIRED','RETURNED','INCOMPLETE','READY','DRAFT'].includes(status)});
 }
 return {families};
 }
 async queue(u:AuthUser){
 if(u.effectiveRole!=='EXECUTIVE_MANAGER')throw new AppError(403,'ROLE','نقش مدیر اجرایی لازم است.');
 return {items:(await this.pool.query(`SELECT r.id,r.family_id,r.state,s.id AS submission_id,s.revision,
 s.snapshot->'family'->>'code' AS family_code,s.snapshot->'family'->>'groupName' AS group_name,
 s.snapshot->'family'->>'headName' AS head_name,s.submitted_at,p.first_name||' '||p.last_name AS sender_name,
 COALESCE(s.snapshot->>'leaderName',p.first_name||' '||p.last_name) AS leader_name
 FROM assessment.domain_reviews r JOIN LATERAL(SELECT * FROM assessment.domain_submissions a WHERE a.review_id=r.id ORDER BY revision DESC LIMIT 1) s ON true
 JOIN identity.accounts a ON a.id=s.submitted_by JOIN identity.people p ON p.id=a.person_id
 WHERE r.state IN ('SUBMITTED','IN_REVIEW') ORDER BY s.submitted_at,s.id`)).rows};
 }
 submissionResult(snapshot:any){
 // Revalidate the frozen inputs, never trust a cached complete=true flag.
 if(!snapshot?.family||!Array.isArray(snapshot.members)||!Array.isArray(snapshot.documents)||!snapshot.payload||!Array.isArray(snapshot.modelDefinition?.indicators))return {complete:false,missing:['اطلاعات نسخه ارسالی کامل نیست؛ برای تکمیل بازگردانید.'],breakdown:[],score:null,max:30};
 return this.evaluate(snapshot.payload,snapshot,snapshot.modelDefinition);
 }
 async submission(submissionId:string,u:AuthUser){
 if(u.effectiveRole!=='EXECUTIVE_MANAGER')throw new AppError(403,'ROLE','نقش مدیر اجرایی لازم است.');
 const s=(await this.pool.query(`SELECT s.*,r.family_id,r.state,r.version,d.decision,d.reason,d.decided_at,d.valid_until,
 p.first_name||' '||p.last_name AS sender_name,ap.first_name||' '||ap.last_name AS approver
 FROM assessment.domain_submissions s JOIN assessment.domain_reviews r ON r.id=s.review_id
 JOIN identity.accounts a ON a.id=s.submitted_by JOIN identity.people p ON p.id=a.person_id
 LEFT JOIN assessment.domain_decisions d ON d.submission_id=s.id LEFT JOIN identity.accounts aa ON aa.id=d.decided_by LEFT JOIN identity.people ap ON ap.id=aa.person_id
 WHERE s.id=$1`,[id(submissionId)])).rows[0];
 if(!s)throw new AppError(404,'NOT_FOUND','نسخه ارسالی پیدا نشد.');
 const latest=(await this.pool.query('SELECT id FROM assessment.domain_submissions WHERE review_id=$1 ORDER BY revision DESC LIMIT 1',[s.review_id])).rows[0];
 const previous=(await this.pool.query(`SELECT s.id,s.snapshot->'result' AS result,d.decided_at,d.valid_until FROM assessment.domain_submissions s JOIN assessment.domain_reviews r ON r.id=s.review_id JOIN assessment.domain_decisions d ON d.submission_id=s.id WHERE r.family_id=$1 AND d.decision='APPROVED' AND d.decided_at<$2 ORDER BY d.decided_at DESC LIMIT 1`,[s.family_id,s.submitted_at])).rows[0]??null;
 const history=(await this.pool.query(`SELECT h.action,h.reason,h.occurred_at,h.effective_role,h.simulation,p.first_name||' '||p.last_name AS actor_name FROM guidance.history h LEFT JOIN identity.accounts a ON a.id=h.actor_id LEFT JOIN identity.people p ON p.id=a.person_id WHERE h.entity_type='FAMILY' AND h.entity_id=$1 AND h.action LIKE 'LIVELIHOOD_%' AND (h.new_state->>'id'=$2 OR h.new_state->>'reviewId'=$2 OR h.new_state->>'submissionId' IN(SELECT id::text FROM assessment.domain_submissions WHERE review_id=$2::uuid)) ORDER BY h.occurred_at DESC,h.id DESC`,[s.family_id,s.review_id])).rows;
 return {submission:s,result:this.submissionResult(s.snapshot),canDecide:latest.id===s.id&&!s.decision&&['SUBMITTED','IN_REVIEW'].includes(s.state),previous,history};
 }
 async workflowNotify(c:PoolClient,f:any,submissionId:string,event:string){
 const receiving=event==='SUBMITTED'||event==='RESUBMITTED'?'EXECUTIVE_MANAGER':'GROUP_LEADER';
 const recipients=(await c.query(`SELECT DISTINCT a.id FROM identity.accounts a JOIN identity.role_assignments r ON r.account_id=a.id WHERE a.status='ACTIVE' AND r.role_code=$1 AND r.valid_from<=now() AND (r.valid_to IS NULL OR r.valid_to>now()) AND (($1='EXECUTIVE_MANAGER' AND r.scope_type='ORGANIZATION' AND r.scope_id IS NULL) OR ($1='GROUP_LEADER' AND r.scope_type='GROUP' AND r.scope_id=$2))`,[receiving,f.current_group_id])).rows;
 const messages:Record<string,string>={SUBMITTED:'ارزیابی برای بررسی مدیر اجرایی ارسال شد',RESUBMITTED:'ارزیابی پس از اصلاح مجدداً ارسال شد',RETURNED:'ارزیابی برای تکمیل بازگردانده شد',APPROVED:'ارزیابی معیشت تأیید شد'};
 for(const a of recipients)await c.query(`INSERT INTO guidance.notifications(recipient_id,category,message,visibility,dedupe_key,link_type,link_id) VALUES($1,$2,$3,'PRIVATE',$4,$5,$6) ON CONFLICT(recipient_id,dedupe_key) DO NOTHING`,[a.id,'LIVELIHOOD_'+event,messages[event]+' — '+f.family_code,'livelihood:'+submissionId+':'+event,receiving==='EXECUTIVE_MANAGER'?'LIVELIHOOD_SUBMISSION':'LIVELIHOOD_FAMILY',receiving==='EXECUTIVE_MANAGER'?submissionId:f.id]);
 }
 async editableBase(c:PoolClient,familyId:string){if((await c.query("SELECT 1 FROM assessment.domain_reviews WHERE family_id=$1 AND state IN ('SUBMITTED','IN_REVIEW')",[familyId])).rowCount)throw new AppError(409,'LOCKED','نسخه برای بررسی ارسال شده است؛ تا تصمیم مدیر اجرایی ویرایش مجاز نیست.');}
 async workspace(familyId:string,u:AuthUser){const f=await this.access(this.pool,familyId,u),base=await this.basics(this.pool,f),m=await this.model(this.pool);
 const reviews=(await this.pool.query('SELECT * FROM assessment.domain_reviews WHERE family_id=$1 ORDER BY created_at DESC,id',[familyId])).rows;
 const submissions=(await this.pool.query(`SELECT s.*,d.decision,d.reason,d.decided_at,d.valid_until,p.first_name||' '||p.last_name AS approver FROM assessment.domain_submissions s JOIN assessment.domain_reviews r ON r.id=s.review_id LEFT JOIN assessment.domain_decisions d ON d.submission_id=s.id LEFT JOIN identity.accounts a ON a.id=d.decided_by LEFT JOIN identity.people p ON p.id=a.person_id WHERE r.family_id=$1 ORDER BY s.submitted_at DESC,s.revision DESC`,[familyId])).rows;
 const canEdit=u.effectiveRole==='GROUP_LEADER',review=reviews.find(r=>r.state!=='APPROVED')??null;
 const visible=u.effectiveRole==='SUPREME_GUIDE'?submissions.filter(s=>s.decision==='APPROVED'):submissions;
 const payload=review?.payload??emptyPayload();return {...base,review:u.effectiveRole==='SUPREME_GUIDE'?null:review,payload:u.effectiveRole==='SUPREME_GUIDE'?null:payload,submissions:visible,model:{version:m.version,definition:m.definition},...m.form_schema,canEdit,canReview:u.effectiveRole==='EXECUTIVE_MANAGER',result:u.effectiveRole==='SUPREME_GUIDE'?(visible[0]?.snapshot.result??null):this.evaluate(payload,base,m.definition),history:(await this.pool.query("SELECT h.action,h.occurred_at,h.reason,h.effective_role,h.simulation,p.first_name||' '||p.last_name AS actor_name FROM guidance.history h LEFT JOIN identity.accounts a ON a.id=h.actor_id LEFT JOIN identity.people p ON p.id=a.person_id WHERE h.entity_type='FAMILY' AND h.entity_id=$1 AND h.action LIKE 'LIVELIHOOD_%' ORDER BY h.occurred_at DESC",[familyId])).rows};}
 evaluate(p:any,base:any,model:any){const missing:string[]=[];const activeCritical=[...new Set([...(p.critical??[]),...(base.activeCritical??[])])];const f=base.family,head=base.members.find((m:any)=>m.relationship_code==='HEAD');
 for(const [key,label] of [['neighborhood','محله'],['residenceType','نوع سکونت'],['formedOn','تاریخ تشکیل/انتقال پرونده'],['source','منبع اطلاعات اولیه']])if(!known(f[key])||key==='formedOn'&&!validDate(f[key]))missing.push(label);
 if(!head)missing.push('سرپرست خانواده');else{if(!known(head.national_id))missing.push('شناسه ملی سرپرست');if(!known(head.mobile))missing.push('شماره تماس');}
 if(!base.members.length)missing.push('اعضای خانواده');
 for(const m of base.members){if(!known(m.first_name)||!known(m.last_name)||!known(m.relationship_code))missing.push('مشخصات عضو');if(!m.birth_date&&!(Number.isInteger(m.profile_data?.age)&&m.profile_data.age>=0&&m.profile_data.age<=130))missing.push('سن/تولد '+m.first_name);for(const k of ['education','health'])if(!known(m.profile_data?.[k]))missing.push((k==='education'?'وضعیت تحصیل ':'وضعیت سلامت مؤثر ')+m.first_name);}
 for(const code of ['NATIONAL_CARD','FAMILY_BOOK'])if(!base.documents.some((d:any)=>d.category===code))missing.push(documentKinds[code as keyof typeof documentKinds]);
 for(const [section,fields] of Object.entries(schema)){const rows=p[section];if(!Array.isArray(rows)||!rows.length){missing.push({income:'منابع درآمد (یا ثبت بدون درآمد)',employment:'اشتغال و توان اقتصادی',expenses:'هزینه‌ها و تعهدات',evidence:'شواهد معیشت'}[section]!);continue;}
 rows.forEach((row:any,i:number)=>{for(const field of fields as any[]){const v=row[field.key];if(field.optional)continue;if(field.type==='number'){if(typeof v!=='number'||!Number.isFinite(v)||v<0)missing.push(field.label+' ردیف '+(i+1));}else if(!known(v)||field.options&&!field.options.includes(v)||field.type==='member'&&!base.members.some((m:any)=>m.id===v))missing.push(field.label+' ردیف '+(i+1));}});}
 for(const category of schema.expenses[0].options!)if(!p.expenses?.some((e:any)=>e.type===category))missing.push('بررسی هزینه: '+category);
 if(p.expenses?.some((e:any)=>e.payment==='هزینه‌ای ندارد'&&e.amount!==0))missing.push('مبلغ هزینه‌ای که وجود ندارد باید صفر باشد');
 for(const member of base.members)if(!p.employment?.some((e:any)=>e.memberId===member.id))missing.push('اطلاعات زمینه‌ای اشتغال '+member.first_name);
 if(p.income?.some((i:any)=>i.type==='بدون درآمد'&&(i.amount!==0||i.period!=='بدون دریافت'||i.continuity!=='فاقد منبع')))missing.push('برای بدون درآمد، مبلغ صفر، بدون دریافت و فاقد منبع ثبت شود');
 if(p.evidence?.some((e:any)=>e.source==='مدرک رسمی')&&!base.documents.some((d:any)=>!['NATIONAL_CARD','FAMILY_BOOK',null].includes(d.category)))missing.push('مدرک رسمی معیشت ذکرشده در شواهد');
 for(const doc of p.requiredDocumentIds??[])if(!base.documents.some((d:any)=>d.id===doc))missing.push('مدرک موضوعی انتخاب‌شده در این خانواده نیست');
 const breakdown=model.indicators.map((i:any)=>{const o=i.options.find((o:any)=>o.code===p.summaries?.[i.key]);if(!o)missing.push(i.label);return {key:i.key,label:i.label,max:i.max,selection:o?.label??'نامشخص',points:o?.points??null};});
 for(let i=0;i<checks.length;i++)if(p.checks?.[i]!==true)missing.push(checks[i]);
 if(!known(p.notes))missing.push('جمع‌بندی نهایی سرگروه');if(!['IMMEDIATE','NECESSARY','IMPORTANT','NON_URGENT'].includes(p.urgency))missing.push('فوریت');
 if(activeCritical.length&&!known(p.criticalAction))missing.push('اقدام فوری آغازشده برای نشانه بحرانی');
 return {complete:missing.length===0,missing:[...new Set(missing)],breakdown,score:breakdown.every((b:any)=>b.points!==null)?breakdown.reduce((a:number,b:any)=>a+b.points,0):null,max:30,totalScore:null,level:null,urgency:activeCritical.length?'IMMEDIATE':p.urgency,critical:activeCritical,scope:'LIVELIHOOD',otherDomains:'NOT_ASSESSED'};}
 payload(value:any){const p=input(value);const allowed=Object.keys(emptyPayload());if(Object.keys(p).some(k=>!allowed.includes(k)))throw new AppError(400,'MANUAL_SCORE','فقط پاسخ‌ها قابل ثبت‌اند؛ امتیاز دستی مجاز نیست.');
 for(const [name,fields] of Object.entries(schema)){if(p[name]!==undefined&&(!Array.isArray(p[name])||p[name].length>100))throw new AppError(400,'ROWS','تعداد ردیف معتبر نیست.');for(const row of p[name]??[]){input(row);for(const k of Object.keys(row))if(!(fields as any[]).some(f=>f.key===k))throw new AppError(400,'FIELD','فیلد ناشناخته در پاسخ');for(const v of Object.values(row))if(!['string','number'].includes(typeof v)||typeof v==='string'&&v.length>3000)throw new AppError(400,'FIELD','مقدار فیلد معتبر نیست.');}}
 if(p.summaries&&Object.entries(input(p.summaries)).some(([k,v])=>!['adequacy','stability','pressure','debt'].includes(k)||typeof v!=='string'||!['','UNKNOWN','0','1','2','3'].includes(v)))throw new AppError(400,'SUMMARY','گزینه جمع‌بندی معتبر نیست.');
 if(p.checks!==undefined&&(!Array.isArray(p.checks)||p.checks.length>10||p.checks.some((x:any)=>typeof x!=='boolean')))throw new AppError(400,'CHECKS','کنترل مراحل معتبر نیست.');
 if(p.critical!==undefined&&(!Array.isArray(p.critical)||p.critical.some((c:any)=>!criticalOptions.includes(c))))throw new AppError(400,'CRITICAL','نشانه معتبر نیست.');
 if(p.requiredDocumentIds!==undefined&&(!Array.isArray(p.requiredDocumentIds)||p.requiredDocumentIds.length>100||p.requiredDocumentIds.some((v:any)=>typeof v!=='string')))throw new AppError(400,'DOCUMENT','مدرک معتبر نیست.');
 for(const k of ['notes','criticalAction','urgency'])if(p[k]!==undefined&&(typeof p[k]!=='string'||p[k].length>5000))throw new AppError(400,'TEXT','متن معتبر نیست.');return {...emptyPayload(),...p};}
 async saveBasics(familyId:string,value:unknown,u:AuthUser){const b=input(value);return this.g.tx(u,async c=>{const f=await this.access(c,familyId,u,true);await this.editableBase(c,familyId);await c.query('SELECT id FROM family.families WHERE id=$1 FOR UPDATE',[familyId]);if(b.version!==f.version)throw new AppError(409,'STALE','اطلاعات خانواده تغییر کرده است. صفحه را تازه کنید.');
 const family=input(b.family),members=b.members;if(!Array.isArray(members)||!members.length||members.length>40||members.some(m=>!m||typeof m!=='object'||Array.isArray(m))||members.filter(m=>m.relationship_code==='HEAD').length!==1)throw new AppError(400,'MEMBERS','یک سرپرست و فهرست اعضای معتبر لازم است.');
 const old=await this.basics(c,f);for(const m of old.members)if(!members.some((x:any)=>x.id===m.id))throw new AppError(400,'MEMBERS','حذف عضو موجود در این مرحله مجاز نیست.');
 for(const m of members){if(!known(m.first_name)||!known(m.last_name)||!['HEAD','SPOUSE','CHILD','PARENT','SIBLING','OTHER'].includes(m.relationship_code))throw new AppError(400,'MEMBER','نام و نسبت عضو لازم است.');let person=m.id;
 if(person&&!old.members.some((x:any)=>x.id===person))throw new AppError(403,'MEMBER','عضو متعلق به این خانواده نیست.');
 const profile:any=input(m.profile_data??{});if(profile.age!==undefined&&profile.age!==null&&profile.age!==''&&(!Number.isInteger(profile.age)||profile.age<0||profile.age>130))throw new AppError(400,'AGE','سن معتبر نیست.');
 if(m.birth_date&&!validDate(m.birth_date))throw new AppError(400,'DATE','تاریخ تولد معتبر نیست.');
 const nid=text(m.national_id,20)||null,mobile=text(m.mobile,20)||null;
 if(nid&&!/^\d{10}$/.test(nid)&&!(f.family_code.startsWith('HL-TEST-')&&/^TEST-[A-Za-z0-9-]+$/.test(nid)))throw new AppError(400,'NATIONAL_ID','کد ملی ۱۰ رقمی یا شناسه TEST برای پرونده آزمایشی لازم است.');
 if(!person)person=(await c.query('INSERT INTO identity.people(first_name,last_name,national_id,mobile,birth_date) VALUES($1,$2,$3,$4,$5) RETURNING id',[text(m.first_name,100),text(m.last_name,100),nid,mobile,m.birth_date||null])).rows[0].id;
 else await c.query('UPDATE identity.people SET first_name=$2,last_name=$3,national_id=$4,mobile=$5,birth_date=$6,updated_at=now() WHERE id=$1',[person,text(m.first_name,100),text(m.last_name,100),nid,mobile,m.birth_date||null]);
 const pd=JSON.stringify({age:profile.age??null,education:text(profile.education),health:text(profile.health),notes:text(profile.notes)});
 if(m.id)await c.query('UPDATE family.family_memberships SET relationship_code=$3,profile_data=$4 WHERE family_id=$1 AND person_id=$2 AND valid_to IS NULL',[familyId,person,m.relationship_code,pd]);else await c.query('INSERT INTO family.family_memberships(family_id,person_id,relationship_code,profile_data) VALUES($1,$2,$3,$4)',[familyId,person,m.relationship_code,pd]);
 if(m.relationship_code==='HEAD'){const h=(await c.query('SELECT person_id FROM family.head_history WHERE family_id=$1 AND valid_to IS NULL',[familyId])).rows[0];if(h?.person_id!==person){await c.query('UPDATE family.head_history SET valid_to=current_date WHERE family_id=$1 AND valid_to IS NULL',[familyId]);await c.query('INSERT INTO family.head_history(family_id,person_id) VALUES($1,$2)',[familyId,person]);}}
 }
 if(family.formedOn&&!validDate(family.formedOn))throw new AppError(400,'DATE','تاریخ تشکیل پرونده معتبر نیست.');
 const basic={residenceType:text(family.residenceType),formedOn:text(family.formedOn,10),source:text(family.source)};
 await c.query('UPDATE family.families SET neighborhood=$2,basic_data=$3,version=version+1,updated_at=now() WHERE id=$1',[familyId,text(family.neighborhood,150),JSON.stringify(basic)]);await c.query("UPDATE assessment.domain_reviews SET state='DRAFT',version=version+1 WHERE family_id=$1 AND state='READY'",[familyId]);await this.g.history(c,u,'FAMILY',familyId,'LIVELIHOOD_BASE_UPDATED',old,{family:basic,members:members.length});return {ok:true};},false);}
 async save(familyId:string,value:unknown,u:AuthUser){const b=input(value),p=this.payload(b.payload);return this.g.tx(u,async c=>{const f=await this.access(c,familyId,u,true),m=await this.model(c);let review=(await c.query("SELECT * FROM assessment.domain_reviews WHERE family_id=$1 AND state<>'APPROVED' FOR UPDATE",[familyId])).rows[0];
 if(review&&(!['DRAFT','READY','RETURNED'].includes(review.state)||review.version!==b.version)||!review&&b.version!==0)throw new AppError(409,'STATE','نسخه تغییر کرده یا برای بررسی قفل است.');
 const result=this.evaluate(p,await this.basics(c,f),m.definition);const previous=review??null;
 if(review)review=(await c.query('UPDATE assessment.domain_reviews SET payload=$2,state=$3,version=version+1,updated_at=now() WHERE id=$1 RETURNING *',[review.id,JSON.stringify(p),result.complete?'READY':'DRAFT'])).rows[0];
 else review=(await c.query("INSERT INTO assessment.domain_reviews(family_id,domain_code,model_id,payload,state,created_by) VALUES($1,'LIVELIHOOD',$2,$3,$4,$5) RETURNING *",[familyId,m.id,JSON.stringify(p),result.complete?'READY':'DRAFT',u.accountId])).rows[0];
 await this.g.history(c,u,'FAMILY',familyId,previous?'LIVELIHOOD_DRAFT_UPDATED':'LIVELIHOOD_CREATED',previous?{id:previous.id,version:previous.version}:null,{id:review.id,version:review.version,result});
 for(const [i,flag] of (p.critical as string[]).entries()){const code='LIVELIHOOD_V100_'+criticalOptions.indexOf(flag);const exists=await c.query('SELECT id FROM oversight.alerts WHERE family_id=$1 AND rule_code=$2',[familyId,code]);if(!exists.rowCount){const owner=(await c.query("SELECT account_id FROM identity.role_assignments WHERE role_code='GROUP_LEADER' AND scope_id=$1 AND valid_from<=now() AND (valid_to IS NULL OR valid_to>now()) LIMIT 1",[f.current_group_id])).rows[0]?.account_id??u.accountId;await c.query("INSERT INTO oversight.alerts(family_id,group_id,rule_code,subject,severity,owner_id) VALUES($1,$2,$3,$4,'CRITICAL',$5)",[familyId,f.current_group_id,code,flag,owner]);await this.g.history(c,u,'FAMILY',familyId,'LIVELIHOOD_CRITICAL_RECORDED',null,{flag,action:p.criticalAction});}}
 return {review,result};},false);}
 async submit(familyId:string,value:unknown,u:AuthUser){const b=input(value);return this.g.tx(u,async c=>{const f=await this.access(c,familyId,u,true);const r=(await c.query("SELECT * FROM assessment.domain_reviews WHERE family_id=$1 AND state<>'APPROVED' FOR UPDATE",[familyId])).rows[0];if(!r||r.version!==b.version||!['DRAFT','READY','RETURNED'].includes(r.state))throw new AppError(409,'STATE','پیش‌نویس قابل ارسال نیست.');const base=await this.basics(c,f),model=(await c.query('SELECT * FROM assessment.models WHERE id=$1',[r.model_id])).rows[0],result=this.evaluate(r.payload,base,model.definition);if(!result.complete)throw new AppError(422,'INCOMPLETE','موارد الزامی هنوز ناقص‌اند.',result.missing);
 const revision=(await c.query('SELECT COALESCE(max(revision),0)+1 n FROM assessment.domain_submissions WHERE review_id=$1',[r.id])).rows[0].n;
 const leaders=(await c.query("SELECT p.first_name||' '||p.last_name AS name FROM identity.role_assignments r JOIN identity.accounts a ON a.id=r.account_id JOIN identity.people p ON p.id=a.person_id WHERE r.role_code='GROUP_LEADER' AND r.scope_id=$1 AND a.status='ACTIVE' AND r.valid_from<=now() AND (r.valid_to IS NULL OR r.valid_to>now()) ORDER BY r.id",[f.current_group_id])).rows;
 const snapshot={leaderName:leaders.map(x=>x.name).join('، '),...base,family:{...base.family,headName:base.members.filter((x:any)=>x.relationship_code==='HEAD').map((x:any)=>x.first_name+' '+x.last_name)[0]},payload:r.payload,result,modelVersion:model.version,modelDefinition:model.definition,formSchema:model.form_schema,reviewId:r.id,revision,submittedBy:u.accountId,effectiveRole:u.effectiveRole,simulation:u.simulation};
 const s=(await c.query('INSERT INTO assessment.domain_submissions(review_id,revision,snapshot,submitted_by) VALUES($1,$2,$3,$4) RETURNING id',[r.id,revision,JSON.stringify(snapshot),u.accountId])).rows[0];await c.query("UPDATE assessment.domain_reviews SET state='SUBMITTED',version=version+1,updated_at=now() WHERE id=$1",[r.id]);const event=revision>1?'RESUBMITTED':'SUBMITTED';await this.g.history(c,u,'FAMILY',familyId,'LIVELIHOOD_'+event,null,{reviewId:r.id,submissionId:s.id,revision,result});await this.workflowNotify(c,f,s.id,event);return {id:s.id};},false);}
 async review(submissionId:string,value:unknown,u:AuthUser,action:string){const b=input(value);return this.g.tx(u,async c=>{if(u.effectiveRole!=='EXECUTIVE_MANAGER')throw new AppError(403,'ROLE','نقش مدیر اجرایی لازم است.');const s=(await c.query('SELECT s.*,r.family_id,r.state,r.version FROM assessment.domain_submissions s JOIN assessment.domain_reviews r ON r.id=s.review_id WHERE s.id=$1 FOR UPDATE OF r',[id(submissionId)])).rows[0];if(!s||!['SUBMITTED','IN_REVIEW'].includes(s.state)||b.version!==s.version)throw new AppError(409,'STATE','این ارسال دیگر قابل تصمیم‌گیری نیست.');const latest=(await c.query('SELECT id FROM assessment.domain_submissions WHERE review_id=$1 ORDER BY revision DESC LIMIT 1',[s.review_id])).rows[0];if(latest.id!==s.id)throw new AppError(409,'STALE','ارسال جدیدتری وجود دارد.');
 if(action==='begin'){await c.query("UPDATE assessment.domain_reviews SET state='IN_REVIEW',version=version+1 WHERE id=$1",[s.review_id]);await this.g.history(c,u,'FAMILY',s.family_id,'LIVELIHOOD_REVIEW_STARTED',null,{submissionId});return {ok:true};}
 if(Object.keys(b).some(k=>!['version','reason'].includes(k)))throw new AppError(400,'MANUAL_SCORE','مدیر فقط تصمیم ثبت می‌کند؛ امتیاز دستی مجاز نیست.');
 const reason=text(b.reason);if(action==='return'&&!known(reason))throw new AppError(400,'REASON','علت برگشت الزامی است.');const result=this.submissionResult(s.snapshot);if(action==='approve'&&!result.complete)throw new AppError(422,'INCOMPLETE','این ارزیابی هنوز قابل تأیید نیست.',result.missing);
 const decision=action==='approve'?'APPROVED':'RETURNED';const row=(await c.query("INSERT INTO assessment.domain_decisions(submission_id,decision,reason,decided_by,valid_until) VALUES($1,$2,$3,$4,CASE WHEN $2='APPROVED' THEN now()+interval '1 year' ELSE NULL END) RETURNING *",[s.id,decision,reason||null,u.accountId])).rows[0];await c.query('UPDATE assessment.domain_reviews SET state=$2,version=version+1,updated_at=now() WHERE id=$1',[s.review_id,decision]);await this.g.history(c,u,'FAMILY',s.family_id,'LIVELIHOOD_'+decision,null,{submissionId:s.id,decision,validUntil:row.valid_until,approvedAt:row.decided_at},reason);if(decision==='APPROVED')await this.g.history(c,u,'FAMILY',s.family_id,'LIVELIHOOD_SNAPSHOT_VALIDATED',null,{submissionId:s.id,reviewId:s.review_id,decisionId:row.id,approvedAt:row.decided_at,validUntil:row.valid_until});const f=(await c.query('SELECT * FROM family.families WHERE id=$1',[s.family_id])).rows[0];await this.workflowNotify(c,f,s.id,decision);return row;},false);}
 async upload(familyId:string,value:unknown,u:AuthUser){const b:any=input(value);const name=text(b.name,150),category=b.category,media=b.mediaType;if(!name||/[\\/]/.test(name)||!Object.keys(documentKinds).includes(category)||!['application/pdf','image/png','image/jpeg','text/plain'].includes(media)||typeof b.content!=='string'||!/^[A-Za-z0-9+/]*={0,2}$/.test(b.content))throw new AppError(400,'DOCUMENT','عنوان، نوع و فایل معتبر لازم است.');const bytes=Buffer.from(b.content,'base64');if(!bytes.length||bytes.length>256*1024)throw new AppError(400,'SIZE','حداکثر حجم مدرک ۲۵۶ کیلوبایت است.');
 if(media==='application/pdf'&&!bytes.subarray(0,5).equals(Buffer.from('%PDF-'))||media==='image/png'&&bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||media==='image/jpeg'&&bytes.subarray(0,3).toString('hex')!=='ffd8ff')throw new AppError(400,'TYPE','محتوای فایل با نوع آن سازگار نیست.');
 return this.g.tx(u,async c=>{await this.access(c,familyId,u,true);await this.editableBase(c,familyId);const doc=(await c.query('INSERT INTO family.documents(family_id,name,media_type,content) VALUES($1,$2,$3,$4) RETURNING id,name,media_type',[familyId,name,media,bytes])).rows[0];await c.query('INSERT INTO family.document_context(document_id,category,actor_id) VALUES($1,$2,$3)',[doc.id,category,u.accountId]);await this.g.history(c,u,'FAMILY',familyId,'LIVELIHOOD_DOCUMENT_ADDED',null,{id:doc.id,name,category});return doc;},false);}
 async document(familyId:string,documentId:string,u:AuthUser){await this.access(this.pool,familyId,u);const d=(await this.pool.query('SELECT * FROM family.documents WHERE id=$1 AND family_id=$2',[id(documentId),familyId])).rows[0];if(!d)throw new AppError(404,'DOCUMENT','مدرک پیدا نشد.');return d;}
}
