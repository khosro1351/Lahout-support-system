import {assertLegacyWritable,hasComprehensive} from '../oversight/legacy-assessment';
import {Injectable} from '@nestjs/common';
import {PoolClient} from 'pg';
import {GuidanceService,id,input,str} from '../guidance/guidance.service';
import {LivelihoodService} from '../livelihood/livelihood.service';
import type {AuthUser} from '../auth/auth.types';
import {AppError} from '../common/app-error';

import {healthFields} from './health.schema';
export {healthFields} from './health.schema';
const score={score:null,max:20,status:'PENDING_RULES'};
@Injectable()
export class HealthWorkflowService {
 constructor(private g:GuidanceService,private livelihood:LivelihoodService){}
 private async access(c:PoolClient,familyId:string,u:AuthUser,edit=false){if(edit)await assertLegacyWritable(c,familyId);
  if(!['GROUP_LEADER','EXECUTIVE_MANAGER','SUPREME_GUIDE'].includes(u.effectiveRole??'')||edit&&u.effectiveRole!=='GROUP_LEADER')throw new AppError(403,'ROLE','این عملیات در اختیار نقش فعال نیست.');
  return this.livelihood.access(c,familyId,u,edit);
 }
 private async current(c:PoolClient,familyId:string){return (await c.query("SELECT * FROM assessment.health_reviews WHERE family_id=$1 AND state<>'APPROVED' FOR UPDATE",[familyId])).rows[0];}
 private async content(c:PoolClient,f:any){
  const base=await this.livelihood.basics(c,f);
  const records=(await c.query(`SELECT m.person_id,s.answer,s.source,s.source_detail,s.notes,s.version AS screening_version,s.created_by,s.created_at,s.updated_by,s.updated_at,cp.first_name||' '||cp.last_name AS creator_name,ep.first_name||' '||ep.last_name AS editor_name,h.id AS form_id,h.version AS form_version,h.payload AS specialized
   FROM family.family_memberships m LEFT JOIN assessment.health_screenings s ON s.membership_id=m.id LEFT JOIN assessment.health_forms h ON h.membership_id=m.id AND h.active
   LEFT JOIN identity.accounts ca ON ca.id=s.created_by LEFT JOIN identity.people cp ON cp.id=ca.person_id LEFT JOIN identity.accounts ea ON ea.id=s.updated_by LEFT JOIN identity.people ep ON ep.id=ea.person_id
   WHERE m.family_id=$1 AND m.valid_to IS NULL`,[f.id])).rows;
  const referenced=[...new Set<string>(records.flatMap(x=>x.specialized?.documentIds??[]))].filter(doc=>!base.documents.some(d=>d.id===doc));
  const documents=referenced.length?[...base.documents,...await this.livelihood.referencedDocuments(c,f.id,referenced)]:base.documents;
  const members=base.members.map(m=>({...m,...records.find(x=>x.person_id===m.id)}));
  const missing:string[]=[];
  if(!members.length)missing.push('اعضای فعال خانواده ثبت نشده‌اند');
  for(const m of members){const name=m.first_name+' '+m.last_name;
   if(!['NO','YES'].includes(m.answer))missing.push(name+'؛ غربالگری نیازمند بررسی است');
   if(m.answer==='YES')for(const [key,label] of Object.entries(healthFields))if(!m.specialized?.[key]?.trim())missing.push(name+'؛ '+label);
  }
  return {...base,documents,members,fields:healthFields,result:{...score,complete:!missing.length,missing},schemaVersion:'HEALTH_CONTENT_V1'};
 }
 async workspace(familyId:string,u:AuthUser){return this.g.tx(u,async c=>{
  const f=await this.access(c,familyId,u),review=await this.current(c,familyId);
  const submissions=(await c.query(`SELECT s.*,d.decision,d.reason,d.decided_at,p.first_name||' '||p.last_name AS approver FROM assessment.health_submissions s JOIN assessment.health_reviews r ON r.id=s.review_id LEFT JOIN assessment.health_decisions d ON d.submission_id=s.id LEFT JOIN identity.accounts a ON a.id=d.decided_by LEFT JOIN identity.people p ON p.id=a.person_id WHERE r.family_id=$1 AND ($2::boolean=false OR d.decision='APPROVED') ORDER BY s.submitted_at DESC,s.revision DESC`,[familyId,u.effectiveRole==='SUPREME_GUIDE'])).rows;
  const history=(await c.query("SELECT h.id,h.action,h.reason,h.occurred_at,p.first_name||' '||p.last_name AS actor_name FROM guidance.history h LEFT JOIN identity.accounts a ON a.id=h.actor_id LEFT JOIN identity.people p ON p.id=a.person_id WHERE entity_type='FAMILY' AND entity_id=$1 AND action LIKE 'HEALTH_%' ORDER BY occurred_at DESC,h.id DESC",[familyId])).rows;
  const base=u.effectiveRole==='SUPREME_GUIDE'?{family:{id:f.id,code:f.family_code},members:[],fields:healthFields,documents:[],result:score}:await this.content(c,f);
  return {...base,review:u.effectiveRole==='SUPREME_GUIDE'?null:review,submissions,history,canEdit:false,canDecide:false};
 },false);}
 async draft(familyId:string,value:unknown,u:AuthUser){const b=input(value);if(Object.keys(b).length)throw new AppError(400,'INVALID','پیش‌نویس از اطلاعات جاری ایجاد می‌شود.');return this.g.tx(u,async c=>{
  await this.access(c,familyId,u,true);const existing=await this.current(c,familyId);if(existing){if(existing.state==='SUBMITTED')throw new AppError(409,'LOCKED','نسخه منتظر تصمیم مدیر اجرایی است.');return existing;}
  const r=(await c.query('INSERT INTO assessment.health_reviews(family_id,created_by) VALUES($1,$2) RETURNING *',[familyId,u.accountId])).rows[0];await this.g.history(c,u,'FAMILY',familyId,'HEALTH_DRAFT_CREATED',null,r);return r;
 },false);}
 async form(familyId:string,memberId:string,value:unknown,u:AuthUser){const b=input(value),payload=input(b.payload);
  if(Object.keys(b).some(k=>!['version','payload'].includes(k))||Object.keys(payload).some(k=>![...Object.keys(healthFields),'cost','documentIds','notes'].includes(k)))throw new AppError(400,'INVALID','فیلد نامعتبر در فرم سلامت وجود دارد.');
  const next:Record<string,any>={};for(const key of [...Object.keys(healthFields),'notes'])next[key]=str(payload[key],2000,true);
  next.cost=payload.cost??null;if(next.cost!==null&&(typeof next.cost!=='number'||!Number.isFinite(next.cost)||next.cost<0))throw new AppError(400,'COST','هزینه معتبر نیست.');
  if(!Array.isArray(payload.documentIds)||payload.documentIds.length>30)throw new AppError(400,'DOCUMENT','فهرست مدارک معتبر نیست.');next.documentIds=[...new Set(payload.documentIds.map(id))];
  if(!Number.isInteger(b.version)||Number(b.version)<0)throw new AppError(400,'VERSION','نسخه معتبر نیست.');
  return this.g.tx(u,async c=>{
   await this.access(c,familyId,u,true);const review=await this.current(c,familyId);if(!review||review.state==='SUBMITTED')throw new AppError(409,'DRAFT','ابتدا پیش‌نویس سلامت قابل ویرایش را باز کنید.');
   const m=(await c.query('SELECT m.id,s.answer FROM family.family_memberships m JOIN assessment.health_screenings s ON s.membership_id=m.id WHERE m.family_id=$1 AND m.person_id=$2 AND m.valid_to IS NULL FOR UPDATE OF m',[familyId,id(memberId)])).rows[0];
   if(!m||m.answer!=='YES')throw new AppError(409,'SCREENING','فرم تخصصی فقط برای عضو دارای مشکل مؤثر قابل ثبت است.');
   const old=(await c.query('SELECT * FROM assessment.health_forms WHERE membership_id=$1 AND active FOR UPDATE',[m.id])).rows[0];if(b.version!==(old?.version??0))throw new AppError(409,'STALE','فرم تغییر کرده است؛ صفحه را تازه کنید.');
   const docs=(await c.query('SELECT id FROM family.documents WHERE family_id=$1 AND id=ANY($2::uuid[])',[familyId,next.documentIds])).rows;if(docs.length!==next.documentIds.length)throw new AppError(403,'DOCUMENT','مدرک باید متعلق به همین خانواده باشد.');
   const row=old?(await c.query('UPDATE assessment.health_forms SET payload=$2,version=version+1,updated_by=$3,updated_at=now() WHERE id=$1 RETURNING *',[old.id,JSON.stringify(next),u.accountId])).rows[0]:(await c.query('INSERT INTO assessment.health_forms(membership_id,payload,created_by,updated_by) VALUES($1,$2,$3,$3) RETURNING *',[m.id,JSON.stringify(next),u.accountId])).rows[0];
   await c.query('UPDATE assessment.health_reviews SET version=version+1,updated_at=now() WHERE id=$1',[review.id]);await this.g.history(c,u,'FAMILY',familyId,'HEALTH_SPECIALIZED_SAVED',old,row);return row;
  },false);
 }
 async submit(familyId:string,value:unknown,u:AuthUser){const b=input(value);if(Object.keys(b).some(k=>k!=='version'))throw new AppError(400,'INVALID','فقط نسخه جاری قابل ارسال است.');return this.g.tx(u,async c=>{
  const f=await this.access(c,familyId,u,true),r=await this.current(c,familyId);if(!r||r.state==='SUBMITTED'||b.version!==r.version)throw new AppError(409,'STALE','پیش‌نویس تغییر کرده یا قبلاً ارسال شده است.');
  const snapshot=await this.content(c,f);if(!snapshot.result.complete)throw new AppError(422,'INCOMPLETE','غربالگری و فرم‌های تخصصی را تکمیل کنید.',snapshot.result.missing);
  const revision=(await c.query('SELECT count(*)::int+1 AS n FROM assessment.health_submissions WHERE review_id=$1',[r.id])).rows[0].n;
  const s=(await c.query('INSERT INTO assessment.health_submissions(review_id,revision,snapshot,submitted_by) VALUES($1,$2,$3,$4) RETURNING *',[r.id,revision,JSON.stringify(snapshot),u.accountId])).rows[0];
  await c.query("UPDATE assessment.health_reviews SET state='SUBMITTED',version=version+1,updated_at=now() WHERE id=$1",[r.id]);const event=r.state==='RETURNED'?'RESUBMITTED':'SUBMITTED';await this.g.history(c,u,'FAMILY',familyId,'HEALTH_'+event,null,{submissionId:s.id,reviewId:r.id});await this.notify(c,f,s.id,event);return s;
 },false);}
 async decide(submissionId:string,value:unknown,u:AuthUser,decision:'APPROVED'|'RETURNED'){await this.g.tx(u,c=>assertLegacyWritable(c,submissionId),false);const b=input(value);if(u.effectiveRole!=='EXECUTIVE_MANAGER')throw new AppError(403,'ROLE','تصمیم در اختیار مدیر اجرایی است.');if(Object.keys(b).some(k=>!['version','reason'].includes(k)))throw new AppError(400,'INVALID','فیلد تصمیم معتبر نیست.');const reason=str(b.reason,2000,decision==='APPROVED');return this.g.tx(u,async c=>{
  const s=(await c.query('SELECT s.*,r.family_id,r.state,r.version FROM assessment.health_submissions s JOIN assessment.health_reviews r ON r.id=s.review_id WHERE s.id=$1 FOR UPDATE OF r',[id(submissionId)])).rows[0];if(!s)throw new AppError(404,'NOT_FOUND','نسخه سلامت پیدا نشد.');
  const latest=(await c.query('SELECT id FROM assessment.health_submissions WHERE review_id=$1 ORDER BY revision DESC LIMIT 1',[s.review_id])).rows[0];if(s.state!=='SUBMITTED'||s.version!==b.version||latest.id!==s.id)throw new AppError(409,'STALE','نسخه قبلاً بررسی شده یا تغییر کرده است.');
  const d=(await c.query('INSERT INTO assessment.health_decisions(submission_id,decision,reason,decided_by) VALUES($1,$2,$3,$4) RETURNING *',[s.id,decision,reason||null,u.accountId])).rows[0];await c.query('UPDATE assessment.health_reviews SET state=$2,version=version+1,updated_at=now() WHERE id=$1',[s.review_id,decision]);await this.g.history(c,u,'FAMILY',s.family_id,'HEALTH_'+decision,null,{...d,reviewId:s.review_id},reason);const f=await this.access(c,s.family_id,u);await this.notify(c,f,s.id,decision);return d;
 },false);}
 async queue(u:AuthUser){return this.g.tx(u,async c=>{if(u.effectiveRole!=='EXECUTIVE_MANAGER')throw new AppError(403,'ROLE','دسترسی مجاز نیست.');return {items:(await c.query("SELECT r.*,f.family_code,s.id AS submission_id,s.submitted_at FROM assessment.health_reviews r JOIN family.families f ON f.id=r.family_id JOIN LATERAL(SELECT * FROM assessment.health_submissions s WHERE s.review_id=r.id ORDER BY revision DESC LIMIT 1)s ON true WHERE r.state='SUBMITTED' ORDER BY s.submitted_at")).rows};},false);}
 private async notify(c:PoolClient,f:any,submissionId:string,event:string){const target=['SUBMITTED','RESUBMITTED'].includes(event)?'EXECUTIVE_MANAGER':'GROUP_LEADER';
  const people=(await c.query("SELECT DISTINCT a.id FROM identity.accounts a JOIN identity.role_assignments r ON r.account_id=a.id WHERE a.status='ACTIVE' AND r.role_code=$1 AND r.valid_from<=now() AND (r.valid_to IS NULL OR r.valid_to>now()) AND ($1='EXECUTIVE_MANAGER' OR r.scope_id=$2)",[target,f.current_group_id])).rows;
  const label:Record<string,string>={SUBMITTED:'ارزیابی سلامت برای بررسی ارسال شد',RESUBMITTED:'ارزیابی سلامت پس از اصلاح ارسال شد',RETURNED:'ارزیابی سلامت برای اصلاح بازگردانده شد',APPROVED:'محتوای ارزیابی سلامت تأیید شد'};
  for(const p of people)await c.query("INSERT INTO guidance.notifications(recipient_id,category,message,visibility,dedupe_key,link_type,link_id) VALUES($1,$2,$3,'PRIVATE',$4,'HEALTH_FAMILY',$5) ON CONFLICT(recipient_id,dedupe_key) DO NOTHING",[p.id,'HEALTH_'+event,label[event]+' — '+f.family_code,'health:'+submissionId+':'+event,f.id]);
 }
}
