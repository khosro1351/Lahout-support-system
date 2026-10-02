import {assertLegacyWritable} from '../oversight/legacy-assessment';
import {Injectable} from '@nestjs/common';
import {PoolClient} from 'pg';
import {GuidanceService,id,input,str} from '../guidance/guidance.service';
import {LivelihoodService} from '../livelihood/livelihood.service';
import type {AuthUser} from '../auth/auth.types';
import {AppError} from '../common/app-error';

@Injectable()
export class HealthScreeningService {
 constructor(private g:GuidanceService,private livelihood:LivelihoodService){}
 private async family(c:PoolClient,familyId:string,u:AuthUser){
  if(u.effectiveRole!=='GROUP_LEADER')throw new AppError(403,'ROLE','غربالگری در اختیار سرگروه مسئول است.');
  return this.livelihood.access(c,familyId,u,true);
 }
 async workspace(familyId:string,u:AuthUser){return this.g.tx(u,async c=>{
  const f=await this.family(c,familyId,u),base=await this.livelihood.basics(c,f);
  const rows=(await c.query(`SELECT m.person_id,s.*,
   cp.first_name||' '||cp.last_name AS creator_name,up.first_name||' '||up.last_name AS editor_name
   FROM assessment.health_screenings s JOIN family.family_memberships m ON m.id=s.membership_id
   JOIN identity.accounts ca ON ca.id=s.created_by JOIN identity.people cp ON cp.id=ca.person_id
   JOIN identity.accounts ua ON ua.id=s.updated_by JOIN identity.people up ON up.id=ua.person_id
   WHERE m.family_id=$1 AND m.valid_to IS NULL`,[familyId])).rows;
  return {family:base.family,members:base.members.map(m=>({id:m.id,first_name:m.first_name,last_name:m.last_name,relationship_code:m.relationship_code,birth_date:m.birth_date,screening:rows.find(s=>s.person_id===m.id)??null})),status:rows.length?'IN_PROGRESS':'NOT_RECORDED'};
 },false);}
 async save(familyId:string,memberId:string,value:unknown,u:AuthUser){
  const b=input(value);
  if(Object.keys(b).some(k=>!['answer','source','sourceDetail','notes','version'].includes(k)))throw new AppError(400,'INVALID','فقط پاسخ و مبنای غربالگری قابل ثبت است.');
  if(typeof b.answer!=='string'||!['NO','YES','UNKNOWN'].includes(b.answer)||typeof b.source!=='string'||!['INTERVIEW','OBSERVATION','VISIT','DOCUMENT','OTHER'].includes(b.source))throw new AppError(400,'SCREENING','پاسخ و مبنای بررسی را انتخاب کنید.');
  if(!Number.isInteger(b.version)||Number(b.version)<0)throw new AppError(400,'VERSION','نسخه معتبر نیست.');
  const detail=str(b.sourceDetail,500,b.source!=='OTHER'),notes=str(b.notes,2000,true);
  return this.g.tx(u,async c=>{
   await this.family(c,familyId,u);await assertLegacyWritable(c,familyId);
   if((await c.query("SELECT 1 FROM assessment.health_reviews WHERE family_id=$1 AND state='SUBMITTED'",[familyId])).rowCount)throw new AppError(409,'LOCKED','نسخه سلامت منتظر تصمیم مدیر اجرایی است.');
   if((await c.query("SELECT 1 FROM assessment.health_reviews WHERE family_id=$1 AND state='APPROVED' AND NOT EXISTS(SELECT 1 FROM assessment.health_reviews WHERE family_id=$1 AND state IN ('DRAFT','RETURNED'))",[familyId])).rowCount)throw new AppError(409,'DRAFT','برای ویرایش سلامت، ارزیابی جدید را با حفظ نسخه تأییدشده ایجاد کنید.');
   const membership=(await c.query('SELECT id FROM family.family_memberships WHERE family_id=$1 AND person_id=$2 AND valid_to IS NULL FOR UPDATE',[id(familyId),id(memberId)])).rows[0];
   if(!membership)throw new AppError(403,'MEMBER','عضو فعال این خانواده نیست.');
   const old=(await c.query('SELECT * FROM assessment.health_screenings WHERE membership_id=$1 FOR UPDATE',[membership.id])).rows[0];
   if(b.version!==(old?.version??0))throw new AppError(409,'STALE','غربالگری تغییر کرده است؛ صفحه را تازه کنید.');
   const next=(await c.query(`INSERT INTO assessment.health_screenings(membership_id,answer,source,source_detail,notes,created_by,updated_by)
    VALUES($1,$2,$3,$4,$5,$6,$6) ON CONFLICT(membership_id) DO UPDATE SET
    answer=EXCLUDED.answer,source=EXCLUDED.source,source_detail=EXCLUDED.source_detail,notes=EXCLUDED.notes,
    updated_by=EXCLUDED.updated_by,updated_at=now(),version=assessment.health_screenings.version+1 RETURNING *`,
    [membership.id,b.answer,b.source,detail,notes,u.accountId])).rows[0];
   if(b.answer!=='YES'){
    const archived=(await c.query('UPDATE assessment.health_forms SET active=false,updated_by=$2,updated_at=now(),version=version+1 WHERE membership_id=$1 AND active RETURNING *',[membership.id,u.accountId])).rows;
    for(const form of archived)await this.g.history(c,u,'FAMILY',familyId,'HEALTH_SPECIALIZED_ARCHIVED',null,form);
   }
   await c.query("UPDATE assessment.health_reviews SET version=version+1,updated_at=now() WHERE family_id=$1 AND state IN ('DRAFT','RETURNED')",[familyId]);
   await this.g.history(c,u,'FAMILY',familyId,'HEALTH_SCREENING_SAVED',old,next);
   return next;
  },false);
 }
}
