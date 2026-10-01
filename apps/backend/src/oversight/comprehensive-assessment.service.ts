import {Inject,Injectable} from '@nestjs/common';
import {Pool,PoolClient} from 'pg';
import {PG_POOL} from '../database/database.constants';
import {GuidanceService,id,input,str} from '../guidance/guidance.service';
import {LivelihoodService} from '../livelihood/livelihood.service';
import {DocumentsService} from '../documents/documents.service';
import {recheckContext} from '../auth/role-context';
import type {AuthUser} from '../auth/auth.types';
import {AppError} from '../common/app-error';
import {evaluateComprehensive,alertDeadlineHours,assessmentTarget,domainMaximums, type ComprehensiveAnswers} from './comprehensive-scoring';
import {comprehensiveFields,domainLabels} from './comprehensive-schema';

const asOf=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
@Injectable()
export class ComprehensiveAssessmentService {
 constructor(@Inject(PG_POOL) private pool:Pool,private g:GuidanceService,private livelihood:LivelihoodService,private docs:DocumentsService){}
 private async access(db:Pool|PoolClient,familyId:string,u:AuthUser,edit=false){
  const roles=await recheckContext(db as PoolClient,u);
  const f=await this.livelihood.access(db,familyId,{...u,roles},edit);
  if(edit&&(u.effectiveRole!=='GROUP_LEADER'||f.status!=='ACTIVE'))throw new AppError(403,'STATE','ویرایش ارزیابی فقط برای سرگروه خانواده فعال مجاز است.');
  if(edit&&f.imported&&!f.imported.members_confirmed_at)throw new AppError(409,'MEMBERS','ابتدا تکمیل اعضای خانواده را تأیید کنید.');
  return f;
 }
 private withBase(payload:any,base:any){
  const residence=base.family.residenceType;
  if(!residence)return payload;
  const codes:Record<string,string>={'ملکی':'OWNER','مالک':'OWNER','اجاره‌ای':'RENT','رهنی':'DEPOSIT','سکونت نزد بستگان':'RELATIVES','نزد بستگان/دیگران':'RELATIVES','اسکان موقت':'TEMPORARY','موقت':'TEMPORARY','غیررسمی':'INFORMAL','فاقد محل ثابت':'HOMELESS'};
  return {...payload,answers:{...payload.answers,housing:{...payload.answers?.housing,residenceType:codes[residence]??'OTHER',...(!codes[residence]?{residenceTypeOther:residence}:{})}}};
 }
 private calculate(payload:any,base:any){
 const result=evaluateComprehensive(this.withBase(payload,base).answers??{},base.members,asOf());
 for(const [category,label] of [['NATIONAL_CARD','تصویر کارت ملی سرپرست'],['FAMILY_BOOK','صفحات شناسنامه خانواده']])if(!base.documents.some((d:any)=>d.category===category&&!d.archived))result.missing.push({domain:'livelihood',section:'documents',field:'documents',reason:label+' لازم است',target:'review-documents'});
 if(result.missing.length){result.complete=false;result.normalizedScore=null;result.needLevel=null;}
 return result;
 }
 private async versions(db:Pool|PoolClient,familyId:string){
  return (await db.query(`SELECT s.*,d.decision,d.comments,d.actor_id AS decided_by,d.created_at AS decided_at FROM assessment.snapshots s JOIN assessment.models m ON m.id=s.model_id LEFT JOIN assessment.decisions d ON d.snapshot_id=s.id WHERE s.family_id=$1 AND m.version='2.0' ORDER BY s.revision DESC`,[familyId])).rows;
 }
 private payload(value:unknown){
  const p=input(value);
  if(Object.keys(p).some(k=>!['answers','evidence','notes'].includes(k)))throw new AppError(400,'PAYLOAD','امتیاز و وضعیت توسط سرور تعیین می‌شوند.');
  const answers=input(p.answers??{});
  for(const [domain,value] of Object.entries(answers)){
   if(!(domain in domainLabels))throw new AppError(400,'DOMAIN','حوزه معتبر نیست.');
   const section=input(value);
   const allowed=new Set([...(comprehensiveFields[domain]??[]).flatMap(q=>[q.key,q.key+'Other']),'members']);
   if(Object.keys(section).some(k=>!allowed.has(k)))throw new AppError(400,'FIELD','فیلد ناشناخته در حوزه.');
   if(section.members!==undefined){
    if(!['health','education'].includes(domain)||!Array.isArray(section.members)||section.members.length>100)throw new AppError(400,'MEMBERS','فهرست اعضا معتبر نیست.');
    const memberFields=new Set(['memberId',...(comprehensiveFields[domain+'Member']??[]).flatMap(q=>[q.key,q.key+'Other'])]);
    for(const item of section.members){const row=input(item);id(row.memberId);if(Object.keys(row).some(k=>!memberFields.has(k)))throw new AppError(400,'FIELD','فیلد عضو معتبر نیست.');}
   }
  }
  if(p.evidence!==undefined&&(!Array.isArray(p.evidence)||p.evidence.length>100))throw new AppError(400,'DOCUMENT','فهرست مدارک معتبر نیست.');
  const evidence=[...new Set((p.evidence??[] as any[]).map((v:unknown)=>id(v)))];
  const notes=p.notes===undefined?'':str(p.notes,4000,true);
  if(JSON.stringify(p).length>150000)throw new AppError(400,'SIZE','حجم فرم بیش از حد مجاز است.');
  return {answers:answers as ComprehensiveAnswers,evidence,notes};
 }
 async workspace(familyId:string,u:AuthUser){
  const f=await this.access(this.pool,familyId,u),base=await this.livelihood.basics(this.pool,f),versions=await this.versions(this.pool,familyId);
  const draft=(await this.pool.query(`SELECT d.* FROM assessment.drafts d JOIN assessment.models m ON m.id=d.model_id WHERE d.family_id=$1 AND d.submitted_snapshot_id IS NULL AND NOT d.legacy_reference AND m.version='2.0'`,[familyId])).rows[0]??null;
  const latest=versions[0],payload=draft?.payload??(latest&&(!latest.decision||latest.decision==='RETURNED')?{answers:latest.answers,evidence:latest.evidence.map((d:any)=>d.id),notes:latest.result.notes}: {answers:{},evidence:[],notes:''});
  const legacy=(await this.pool.query(`SELECT d.id,d.payload,d.created_at,m.version AS model_version FROM assessment.drafts d JOIN assessment.models m ON m.id=d.model_id WHERE d.family_id=$1 AND m.version<>'2.0' ORDER BY d.created_at DESC`,[familyId])).rows;
  const legacyDomains=(await this.pool.query(`SELECT 'livelihood' AS domain,id,payload FROM assessment.domain_reviews WHERE family_id=$1`,[familyId]).catch(()=>({rows:[]}))).rows;
  return {...base,fields:comprehensiveFields,labels:domainLabels,maximums:domainMaximums,draft,versions,payload:this.withBase(payload,base),
   result:this.calculate(payload,base),canEdit:u.effectiveRole==='GROUP_LEADER'&&f.status==='ACTIVE'&&(!latest||!!latest.decision)&&(!f.imported||!!f.imported.members_confirmed_at),
   canReview:u.effectiveRole==='EXECUTIVE_MANAGER',legacy,legacyDomains,
   alerts:(await this.pool.query("SELECT * FROM oversight.alerts WHERE family_id=$1 AND rule_code LIKE 'V2.%' ORDER BY created_at DESC",[familyId])).rows,
   history:(await this.pool.query("SELECT action,occurred_at,reason FROM guidance.history WHERE entity_type='FAMILY' AND entity_id=$1 AND action LIKE 'COMPREHENSIVE_%' ORDER BY occurred_at DESC",[familyId])).rows};
 }
 async preview(familyId:string,value:unknown,u:AuthUser){
  const f=await this.access(this.pool,familyId,u),base=await this.livelihood.basics(this.pool,f),payload=this.payload(value);
  return this.calculate(payload,base);
 }
 async save(familyId:string,value:unknown,u:AuthUser){
  const b=input(value);let payload=this.payload(b.payload);
  return this.g.tx(u,async c=>{
   const f=await this.access(c,familyId,u,true);await c.query('SELECT id FROM family.families WHERE id=$1 FOR UPDATE',[familyId]);
   const base=await this.livelihood.basics(c,f);payload=this.withBase(payload,base);
   const versions=await this.versions(c,familyId);if(versions[0]&&!versions[0].decision)throw new AppError(409,'SUBMITTED','نسخه ارسالی فقط پس از بازگشت قابل اصلاح است.');
   const model=(await c.query("SELECT id FROM assessment.models WHERE version='2.0'")).rows[0];
   let draft=(await c.query('SELECT * FROM assessment.drafts WHERE family_id=$1 AND model_id=$2 AND submitted_snapshot_id IS NULL AND NOT legacy_reference FOR UPDATE',[familyId,model.id])).rows[0];
   if(draft&&draft.version!==b.version)throw new AppError(409,'STALE','پیش‌نویس تغییر کرده؛ صفحه را تازه کنید.');
   if(!draft&&b.version!==null&&b.version!==undefined)throw new AppError(409,'STALE','نسخه پیش‌نویس معتبر نیست.');
   const old=draft;
   if(!draft){
    const legacy=(await c.query('UPDATE assessment.drafts SET legacy_reference=true WHERE family_id=$1 AND model_id<>$2 AND submitted_snapshot_id IS NULL AND NOT legacy_reference RETURNING id',[familyId,model.id])).rows;
    if(legacy.length)await this.g.history(c,u,'FAMILY',familyId,'COMPREHENSIVE_LEGACY_REFERENCE',null,{drafts:legacy});
    draft=(await c.query('INSERT INTO assessment.drafts(family_id,model_id,created_by,payload,previous_snapshot_id) VALUES($1,$2,$3,$4,$5) RETURNING *',[familyId,model.id,u.accountId,JSON.stringify(payload),versions[0]?.decision==='RETURNED'?versions[0].id:null])).rows[0];
   }else draft=(await c.query('UPDATE assessment.drafts SET payload=$2,version=version+1,updated_at=now() WHERE id=$1 RETURNING *',[draft.id,JSON.stringify(payload)])).rows[0];
   const result=this.calculate(payload,base);
   const selected=await this.docs.list(c,familyId,true,payload.evidence);
   if(selected.length!==payload.evidence.length)throw new AppError(400,'DOCUMENT','مدرک باید متعلق به همین خانواده باشد.');
   await this.g.history(c,u,'FAMILY',familyId,old?'COMPREHENSIVE_SECTION_SAVED':'COMPREHENSIVE_CREATED',old,draft);
   await this.g.history(c,u,'FAMILY',familyId,'COMPREHENSIVE_SCORE_APPLICABILITY_NEED',null,{draftId:draft.id,result});
   await this.syncAlerts(c,f,u,result.alerts,draft.id,null,result.missing);
   return {draft,result};
  },false);
 }
 async submit(familyId:string,value:unknown,u:AuthUser){
  const b=input(value);return this.g.tx(u,async c=>{
   const f=await this.access(c,familyId,u,true);await c.query('SELECT id FROM family.families WHERE id=$1 FOR UPDATE',[familyId]);
   const d=(await c.query(`SELECT d.* FROM assessment.drafts d JOIN assessment.models m ON m.id=d.model_id WHERE d.id=$1 AND d.family_id=$2 AND m.version='2.0' FOR UPDATE OF d`,[id(b.draftId),familyId])).rows[0];
   if(!d||d.version!==b.version||d.submitted_snapshot_id||d.legacy_reference)throw new AppError(409,'STALE','پیش‌نویس تغییر کرده یا قبلاً ارسال شده است.');
   const latest=(await this.versions(c,familyId))[0];if(latest&&!latest.decision)throw new AppError(409,'SUBMITTED','یک نسخه منتظر بررسی است.');
   const base=await this.livelihood.basics(c,f),p=this.withBase(this.payload(d.payload),base),result=this.calculate(p,base);
   if(!result.complete)throw new AppError(422,'INCOMPLETE','همه موارد مرور نهایی را تکمیل کنید.');
   const evidenceIds=[...new Set([...p.evidence,...base.documents.filter((d:any)=>['NATIONAL_CARD','FAMILY_BOOK'].includes(d.category)&&!d.archived).map((d:any)=>d.id)])];const documents=await this.docs.list(c,familyId,true,evidenceIds);if(documents.length!==evidenceIds.length)throw new AppError(400,'DOCUMENT','مدرک معتبر نیست.');
   const revision=(await c.query('SELECT COALESCE(max(revision),0)+1 n FROM assessment.snapshots WHERE family_id=$1',[familyId])).rows[0].n;
   const urgent=result.alerts.some(a=>a.severity==='CRITICAL')?'IMMEDIATE':result.alerts.some(a=>a.severity==='URGENT')?'NECESSARY':result.alerts.length?'IMPORTANT':'NON_URGENT';
   const frozen={...result,notes:p.notes,asOf:asOf(),previousSnapshotId:d.previous_snapshot_id,submittedBy:u.accountId};
   const s=(await c.query(`INSERT INTO assessment.snapshots(family_id,model_id,revision,actor_id,answers,members,evidence,result,state,score,level,urgency) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'FINAL',$9,$10,$11) RETURNING *`,[familyId,d.model_id,revision,u.accountId,JSON.stringify(p.answers),JSON.stringify(base.members),JSON.stringify(documents),JSON.stringify(frozen),result.normalizedScore,result.needLevel,urgent])).rows[0];
   await c.query('UPDATE assessment.drafts SET submitted_snapshot_id=$2 WHERE id=$1',[d.id,s.id]);
   await this.syncAlerts(c,f,u,result.alerts,d.id,s.id);
   await this.g.history(c,u,'FAMILY',familyId,d.previous_snapshot_id?'COMPREHENSIVE_RESUBMITTED':'COMPREHENSIVE_SUBMITTED',null,{snapshotId:s.id,revision,result:frozen,documents});
   await c.query(`INSERT INTO guidance.notifications(recipient_id,category,message,visibility,link_type,link_id,dedupe_key) SELECT DISTINCT account_id,'ASSESSMENT','ارزیابی جامع برای بررسی ارسال شد','PRIVATE','COMPREHENSIVE_FAMILY',$1::uuid,$2::text FROM identity.role_assignments WHERE role_code='EXECUTIVE_MANAGER' AND valid_from<=now() AND (valid_to IS NULL OR valid_to>now()) ON CONFLICT(recipient_id,dedupe_key) DO NOTHING`,[familyId,'comprehensive:submit:'+s.id]);
   return s;
  },false);
 }
 async decide(familyId:string,value:unknown,u:AuthUser){
  const b=input(value);return this.g.tx(u,async c=>{
   await this.access(c,familyId,u);
   if(u.effectiveRole!=='EXECUTIVE_MANAGER'||!(await recheckContext(c,u)).some(r=>r.roleCode==='EXECUTIVE_MANAGER'&&r.scopeType==='ORGANIZATION'))throw new AppError(403,'ROLE','فقط مدیر اجرایی می‌تواند تصمیم بگیرد.');
   const s=(await this.versions(c,familyId)).find(s=>s.id===id(b.snapshotId));
   if(!s||s.decision)throw new AppError(409,'DECIDED','نسخه قابل تصمیم‌گیری نیست.');
   if(!['APPROVED','RETURNED'].includes(String(b.decision)))throw new AppError(400,'DECISION','تصمیم معتبر نیست.');
   const comments=b.decision==='RETURNED'?b.comments:[];
   if(!Array.isArray(comments)||(b.decision==='RETURNED'&&(!comments.length||comments.length>30)))throw new AppError(400,'COMMENTS','حداقل یک توضیح بازگشت لازم است.');
   const normalized=comments.map((x:any)=>{
    const a=input(x),domain=str(a.domain),field=typeof a.field==='string'?a.field:'',memberId=a.memberId?id(a.memberId):undefined;
    if(!(domain in domainLabels)||(field&&![...(comprehensiveFields[domain]??[]),...(comprehensiveFields[domain+'Member']??[])].some(q=>q.key===field)))throw new AppError(400,'TARGET','منشأ توضیح معتبر نیست.');
    const memberField=(comprehensiveFields[domain+'Member']??[]).some(q=>q.key===field);
    if(memberField&&!memberId)throw new AppError(400,'MEMBER','برای سؤال عضو، عضو مرتبط را انتخاب کنید.');
    if(memberId&&(!memberField||!s.members.some((m:any)=>m.id===memberId)))throw new AppError(400,'MEMBER','عضو یا سؤال متعلق به این منشأ نیست.');
    return {domain,section:field||domain,field,memberId,reason:str(a.reason,2000),target:field?assessmentTarget(domain as any,field,memberId):domain};
   });
   const decision=(await c.query('INSERT INTO assessment.decisions(snapshot_id,decision,comments,actor_id) VALUES($1,$2,$3,$4) RETURNING *',[s.id,b.decision,JSON.stringify(normalized),u.accountId])).rows[0];
   await this.g.history(c,u,'FAMILY',familyId,'COMPREHENSIVE_'+b.decision,null,decision);
   for(const comment of normalized)await this.g.history(c,u,'FAMILY',familyId,'COMPREHENSIVE_RETURN_COMMENT',null,comment);
   await c.query("INSERT INTO guidance.notifications(recipient_id,category,message,visibility,link_type,link_id,dedupe_key) VALUES($1,'ASSESSMENT',$2,'PRIVATE','COMPREHENSIVE_FAMILY',$3,$4) ON CONFLICT(recipient_id,dedupe_key) DO NOTHING",[s.actor_id,b.decision==='RETURNED'?'ارزیابی جامع برای اصلاح بازگشت داده شد':'ارزیابی جامع تأیید شد',familyId,'comprehensive:decision:'+s.id]);
   return decision;
  },false);
 }
 async queue(u:AuthUser){
  if(!['EXECUTIVE_MANAGER','SUPREME_GUIDE'].includes(u.effectiveRole??''))throw new AppError(403,'ROLE','دسترسی مدیریتی لازم است.');
  return {items:(await this.pool.query(`SELECT s.id,s.family_id,s.revision,s.created_at,s.score,s.level,f.family_code,f.status FROM assessment.snapshots s JOIN assessment.models m ON m.id=s.model_id JOIN family.families f ON f.id=s.family_id LEFT JOIN assessment.decisions d ON d.snapshot_id=s.id WHERE m.version='2.0' AND d.id IS NULL ORDER BY s.created_at`)).rows};
 }
 private async syncAlerts(c:PoolClient,f:any,u:AuthUser,flags:any[],draftId:string,snapshotId:string|null,missing:any[]=[]){
  const owner=(await c.query("SELECT account_id FROM identity.role_assignments WHERE role_code='GROUP_LEADER' AND scope_id=$1 AND valid_from<=now() AND (valid_to IS NULL OR valid_to>now()) ORDER BY valid_from DESC LIMIT 1",[f.current_group_id])).rows[0]?.account_id;
  if(flags.length&&!owner)throw new AppError(409,'OWNER','مسئول پیگیری خانواده مشخص نیست.');
  const detected=new Set(flags.map(a=>'V2.'+a.code));
  const old=(await c.query("SELECT * FROM oversight.alerts WHERE family_id=$1 AND rule_code LIKE 'V2.%' FOR UPDATE",[f.id])).rows;
  for(const flag of flags){
   const code='V2.'+flag.code,previous=old.find(a=>a.rule_code===code),severity=({ATTENTION:'IMPORTANT',URGENT:'VERY_IMPORTANT',CRITICAL:'CRITICAL'} as any)[flag.severity];
   const link='/workspace/families/'+f.id+'/assessment/'+flag.sourceDomain+(snapshotId?'?version='+snapshotId:'')+'#'+flag.target;
   let alert;
   if(previous){
    alert=(await c.query(`UPDATE oversight.alerts SET subject=$2,severity=$3,owner_id=$4,trigger_detected=true,last_detected_at=now(),updated_at=now(),assessment_version_id=$5,assessment_draft_id=$6,deep_link=$7,state=CASE WHEN state='RESOLVED' THEN 'OPEN' ELSE state END,resolved_at=NULL,resolved_by=NULL,due_at=CASE WHEN state='RESOLVED' OR severity<>$3 THEN now()+$8*interval '1 hour' ELSE due_at END WHERE id=$1 RETURNING *`,[previous.id,flag.reason,severity,owner,snapshotId,draftId,link,alertDeadlineHours[flag.severity as keyof typeof alertDeadlineHours]])).rows[0];
   }else alert=(await c.query(`INSERT INTO oversight.alerts(family_id,member_id,rule_code,subject,severity,owner_id,assessment_version_id,assessment_draft_id,source_domain,source_section,source_field,deep_link,due_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now()+$13*interval '1 hour') RETURNING *`,[f.id,flag.memberId??null,code,flag.reason,severity,owner,snapshotId,draftId,flag.sourceDomain,flag.sourceSection,flag.sourceField,link,alertDeadlineHours[flag.severity as keyof typeof alertDeadlineHours]])).rows[0];
   await this.g.history(c,u,'FAMILY',f.id,previous?'COMPREHENSIVE_ALERT_UPDATED':'COMPREHENSIVE_ALERT_CREATED',previous??null,alert);
   if(!previous||previous.state==='RESOLVED')await c.query("INSERT INTO guidance.notifications(recipient_id,category,message,visibility,link_type,link_id,dedupe_key) VALUES($1,'ASSESSMENT_ALERT',$2,'PRIVATE','ALERT',$3,$4) ON CONFLICT(recipient_id,dedupe_key) DO NOTHING",[owner,flag.reason,alert.id,'assessment-alert:'+alert.id+':'+alert.last_detected_at.toISOString()]);
  }
  for(const previous of old)if(!detected.has(previous.rule_code)&&previous.state!=='RESOLVED'&&!missing.some(m=>m.domain===previous.source_domain)){
   const next=(await c.query("UPDATE oversight.alerts SET trigger_detected=false,state='RESOLVED',resolved_at=now(),resolved_by=$2,action_taken='اصلاح منشأ ارزیابی',result='شرط ایجاد هشدار در نسخه کاری برطرف شد',updated_at=now() WHERE id=$1 RETURNING *",[previous.id,u.accountId])).rows[0];
   await this.g.history(c,u,'FAMILY',f.id,'COMPREHENSIVE_ALERT_RESOLVED',previous,next);
  }
 }
}
