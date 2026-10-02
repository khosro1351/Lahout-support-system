import {Pool,PoolClient} from 'pg';
import {AppError} from '../common/app-error';
import type {AuthUser} from '../auth/auth.types';
import {evaluateComprehensive,domainMaximums} from './comprehensive-scoring';
import {domainLabels} from './comprehensive-schema';

type Db=Pool|PoolClient;
export const modelReviewWarning='این ارزیابی با نسخه قبلی آغاز شده است و برای ادامه باید همه حوزه‌ها با نسخه جدید بازنگری شوند.';
export const assessmentDate=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export async function currentAssessmentModel(db:Db){
 const model=(await db.query("SELECT * FROM assessment.models WHERE state='ACTIVE' AND definition->>'engine'='comprehensive-v2'")).rows[0];
 if(!model)throw new AppError(409,'MODEL_UNAVAILABLE','مدل فعال ارزیابی جامع در دسترس نیست.');
 return model;
}
export function withCurrentFamily(payload:any,base:any){
 const residence=base.family.residenceType;
 if(!residence)return payload;
 const codes:Record<string,string>={'ملکی':'OWNER','مالک':'OWNER','اجاره‌ای':'RENT','رهنی':'DEPOSIT','نزد بستگان':'RELATIVES','نزد بستگان/دیگران':'RELATIVES','سکونت موقت':'TEMPORARY','موقت':'TEMPORARY','غیررسمی':'INFORMAL','فاقد محل ثابت':'HOMELESS'};
 return {...payload,answers:{...payload.answers,housing:{...payload.answers?.housing,residenceType:codes[residence]??'OTHER',...(!codes[residence]?{residenceTypeOther:residence}:{})}}};
}
export function calculateCurrentAssessment(payload:any,base:any){
 const result=evaluateComprehensive(withCurrentFamily(payload,base).answers??{},base.members,assessmentDate());
 for(const [category,label] of [['NATIONAL_CARD','تصویر کارت ملی سرپرست'],['FAMILY_BOOK','صفحات شناسنامه خانواده']])if(!base.documents.some((d:any)=>d.category===category&&!d.archived))result.missing.push({domain:'livelihood',section:'documents',field:'documents',reason:label+' لازم است',target:'review-documents'});
 if(result.missing.length){result.complete=false;result.normalizedScore=null;result.needLevel=null;}
 return result;
}
export function assessmentDomains(result:any){
 return Object.fromEntries(Object.entries(domainLabels).map(([key,label])=>{
  const applicability=key==='education'?(result?.educationApplicability?.state??'UNKNOWN'):'APPLICABLE';
  return [key,{label,title:label,applicability,status:!result?'NOT_RECORDED':applicability==='NOT_APPLICABLE'?'NOT_APPLICABLE':result.missing?.some((m:any)=>m.domain===key)?'INCOMPLETE':'COMPLETED',score:result?.domainRawScores?.[key]??null,maximum:domainMaximums[key as keyof typeof domainMaximums]}];
 }));
}
/** Single read contract. FINAL is storage immutability, never managerial approval. */
export async function familyAssessmentStatus(db:Db,familyId:string,base:any,u?:AuthUser){
 const model=await currentAssessmentModel(db);
 const versions=(await db.query(`SELECT s.*,m.version AS model_version,d.decision,d.comments,d.created_at AS decided_at FROM assessment.snapshots s JOIN assessment.models m ON m.id=s.model_id LEFT JOIN assessment.decisions d ON d.snapshot_id=s.id WHERE s.family_id=$1 AND m.definition->>'engine'='comprehensive-v2' ORDER BY s.revision DESC`,[familyId])).rows;
 const drafts=(await db.query(`SELECT d.*,m.version AS model_version FROM assessment.drafts d JOIN assessment.models m ON m.id=d.model_id WHERE d.family_id=$1 AND d.submitted_snapshot_id IS NULL AND NOT d.legacy_reference ORDER BY d.created_at DESC`,[familyId])).rows;
 const approved=versions.find(s=>s.decision==='APPROVED')??null;
 const pending=versions.find(s=>!s.decision&&s.model_id===model.id)??null;
 const draft=drafts.find(d=>d.model_id===model.id)??null;
 const currentVersion=versions.find(s=>s.model_id===model.id);
 const returned=currentVersion?.decision==='RETURNED'?currentVersion:null;
 const oldOpen=drafts.some(d=>d.model_id!==model.id)||versions.some(s=>s.model_id!==model.id&&(!s.decision||s.decision==='RETURNED')&&!versions.some(n=>n.revision>s.revision));
 const legacyOpen=!!(await db.query("SELECT 1 FROM assessment.domain_reviews WHERE family_id=$1 AND state<>'APPROVED' UNION ALL SELECT 1 FROM assessment.health_reviews WHERE family_id=$1 AND state<>'APPROVED' LIMIT 1",[familyId])).rowCount;
 const requiresReview=!!draft?.requires_full_review||(!draft&&!pending&&(oldOpen||(legacyOpen&&versions.length===0)));
 const reviewedDomains:string[]=draft?.reviewed_domains??[];
 const remainingDomains=requiresReview?Object.keys(domainLabels).filter(d=>!reviewedDomains.includes(d)):[];
 const result=draft?calculateCurrentAssessment(draft.payload,base):pending?.result??returned?.result??approved?.result??null;
 const status=draft?(requiresReview&&remainingDomains.length?'MODEL_REVIEW_REQUIRED':result.complete?'READY':'DRAFT'):pending?'PENDING':requiresReview?'MODEL_REVIEW_REQUIRED':returned?'RETURNED':approved?'VALID':'NOT_RECORDED';
 const leader=u?.effectiveRole==='GROUP_LEADER'&&base.family.status==='ACTIVE'&&(!base.family.imported||!!base.family.imported.members_confirmed_at);
 const nextAction=base.family.imported&&!base.family.imported.members_confirmed_at&&base.family.status==='ACTIVE'&&u?.effectiveRole==='GROUP_LEADER'?'COMPLETE_MEMBERS':pending?(u?.effectiveRole==='EXECUTIVE_MANAGER'?'REVIEW':'WAIT_FOR_APPROVAL'):leader?(requiresReview?'REVIEW_ALL_DOMAINS':draft||returned?'CONTINUE_DRAFT':'START_ASSESSMENT'):'VIEW';
 const alerts=(await db.query("SELECT id,subject,severity,state,deep_link,source_domain,source_section,source_field,due_at FROM oversight.alerts WHERE family_id=$1 AND state<>'RESOLVED' ORDER BY created_at DESC",[familyId])).rows;
 return {familyId,modelVersion:model.version,modelId:model.id,status,approved,draft,pending,returned,domains:Object.fromEntries(Object.entries(assessmentDomains(result)).map(([key,value])=>[key,{...value,...(remainingDomains.includes(key)?{status:'REVIEW_REQUIRED'}:{})}])),approvedDomains:assessmentDomains(approved?.result),rawTotal:result?.rawTotal??null,applicableMaximum:result?.applicableMaximum??null,normalizedScore:result?.normalizedScore??null,needLevel:result?.needLevel??null,resultSource:draft?'DRAFT':pending?'SUBMITTED':returned?'RETURNED':approved?'APPROVED':null,result,alerts,nextAction,requiresReview,remainingDomains,reviewedDomains,warning:requiresReview?modelReviewWarning:null};
}

export type FamilyAssessmentStatus=Awaited<ReturnType<typeof familyAssessmentStatus>>;
export function assessmentListFields(s:FamilyAssessmentStatus){
 return {assessment:s,comprehensive:true,status:s.status,state:s.status,health_status:s.status,score:s.approved?.result.normalizedScore??null,need_level:s.approved?.result.needLevel??null,complete:!!s.result?.complete&&s.remainingDomains.length===0,missing:s.result?.missing??[],valid_until:null,data_status:s.result?.complete&&!s.remainingDomains.length?'COMPLETED':'INCOMPLETE',alerts:s.alerts,urgency:s.alerts.some(a=>a.severity==='CRITICAL')?'IMMEDIATE':s.alerts.some(a=>a.severity==='VERY_IMPORTANT')?'NECESSARY':s.alerts.length?'IMPORTANT':'NON_URGENT',needs_action:!s.pending&&s.status!=='VALID',reason:s.warning??s.returned?.comments?.map((c:any)=>c.reason).join(' / ')??null,updated_at:s.draft?.updated_at??s.pending?.created_at??s.approved?.decided_at??null};
}
