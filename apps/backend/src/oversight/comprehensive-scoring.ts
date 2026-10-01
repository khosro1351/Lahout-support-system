import {comprehensiveFields,visibleQuestion,domainLabels} from './comprehensive-schema';
/** Rules for comprehensive assessment v2. Historical v1 rules remain unchanged. */
export type EducationStatus = 'STUDYING' | 'DROPPED_OUT' | 'NOT_ENROLLED' | 'AT_RISK' | 'GRADUATED' | 'NOT_STUDYING' | 'BELOW_SCHOOL_AGE' | 'UNKNOWN';
export type BaseMember = { id:string; active?:boolean; birth_date?:string|null; profile_data?:{education?:string|null;age?:unknown} };
export type Applicability = 'APPLICABLE' | 'NOT_APPLICABLE' | 'UNKNOWN';
const statuses:Record<string,EducationStatus> = {
 STUDYING:'STUDYING', 'در حال تحصیل':'STUDYING', 'دانش‌آموز':'STUDYING', 'دانش آموز':'STUDYING', 'دانشجو':'STUDYING',
 DROPPED_OUT:'DROPPED_OUT', 'ترک تحصیل':'DROPPED_OUT',
 NOT_ENROLLED:'NOT_ENROLLED', 'ثبت‌نام‌نشده':'NOT_ENROLLED', 'ثبت نام نشده':'NOT_ENROLLED',
 AT_RISK:'AT_RISK', 'در معرض ترک تحصیل':'AT_RISK', 'غیبت شدید':'AT_RISK', 'در معرض ترک تحصیل یا غیبت شدید':'AT_RISK',
 GRADUATED:'GRADUATED', 'فارغ‌التحصیل':'GRADUATED', 'فارغ التحصیل':'GRADUATED',
 NOT_STUDYING:'NOT_STUDYING', 'خارج از تحصیل':'NOT_STUDYING', 'تحصیل نمی‌کند':'NOT_STUDYING',
 BELOW_SCHOOL_AGE:'BELOW_SCHOOL_AGE', 'زیر سن تحصیل':'BELOW_SCHOOL_AGE', 'پیش از سن تحصیل':'BELOW_SCHOOL_AGE', UNKNOWN:'UNKNOWN', 'نامشخص':'UNKNOWN'
};
export function educationStatus(value:unknown):EducationStatus {
 return typeof value==='string' ? statuses[value.trim().replace(/ي/g,'ی').replace(/ك/g,'ک')]??'UNKNOWN' : 'UNKNOWN';
}
/** Date-only age at an explicit assessment date; never reads legacy manual age. */
export function completedAge(birthDate:string|null|undefined,asOf:string):number|null {
 const valid=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
 if(!valid(asOf))throw new Error('Invalid assessment date');
 if(!birthDate||!valid(birthDate)||birthDate>asOf)return null;
 const formatter=new Intl.DateTimeFormat('en-US-u-ca-persian',{year:'numeric',month:'numeric',day:'numeric',timeZone:'UTC'});
 const parts=(value:string)=>{const p=formatter.formatToParts(new Date(value));return ['year','month','day'].map(key=>Number(p.find(x=>x.type===key)!.value));};
 const [y,m,d]=parts(birthDate),[ay,am,ad]=parts(asOf);
 return ay-y-(am<m||(am===m&&ad<d)?1:0);
}
export function memberEducationApplicability(member:BaseMember,asOf:string) {
 const age=completedAge(member.birth_date,asOf),status=educationStatus(member.profile_data?.education);
 let state:Applicability,reason:string;
 if(member.active===false){state='NOT_APPLICABLE';reason='INACTIVE';}
 else if(status==='STUDYING'){state='APPLICABLE';reason='CURRENT_STUDENT';}
 else if(age!==null&&age>=6&&age<=18){state='APPLICABLE';reason='AGE_6_TO_18';}
 else if(['DROPPED_OUT','NOT_ENROLLED','AT_RISK'].includes(status)&&(age===null||(age>=6&&age<=24))){state='APPLICABLE';reason=age===null?'KNOWN_EDUCATION_WITHOUT_DOB':'AGE_6_TO_24_WITH_BARRIER';}
 else if(age===null&&status==='UNKNOWN'){state='UNKNOWN';reason='BASE_DATA_REQUIRED';}
 else {state='NOT_APPLICABLE';reason='NO_APPLICABLE_CRITERION';}
 return {memberId:member.id,state,reason,age,status};
}
export function educationApplicability(members:BaseMember[],asOf:string) {
 const results=members.filter(m=>m.active!==false).map(m=>memberEducationApplicability(m,asOf));
 const eligibleMemberIds=results.filter(m=>m.state==='APPLICABLE').map(m=>m.memberId);
 const unknownMemberIds=results.filter(m=>m.state==='UNKNOWN').map(m=>m.memberId);
 const state:Applicability=eligibleMemberIds.length?'APPLICABLE':unknownMemberIds.length?'UNKNOWN':'NOT_APPLICABLE';
 return {state,eligibleMemberIds,unknownMemberIds,members:results};
}
export const comprehensiveScoreVersion='2.0';
export const domainMaximums={livelihood:30,health:20,housing:20,vulnerability:15,education:15} as const;
export const scoreMappings={
 livelihood:{adequacy:[0,4,8,12,15],stability:[0,2,4,5,6],essentialCosts:[0,1,3,4,5],debt:[0,1,2,3,4]},
 health:{functionalImpact:[0,2,5,8],treatmentGap:[0,2,5,6],financialPressure:[0,2,4,6]},
 housing:{stability:[0,1,3,5,7],qualitySafety:[0,2,4,6],financialPressure:[0,1,3,4],fit:[0,1,2,3]},
 vulnerability:{dependency:[0,2,4,6],socialRisk:[0,1,3,5],crisis:[0,1,2,4]},
 education:{status:[0,4,8,12,15]}
} as const;
export function mappedScore(options:readonly number[],selection:unknown):number|null {
 // Values are stable option codes, never client-supplied point totals.
 if(typeof selection!=='string'||!/^OPTION_[0-9]+$/.test(selection))return null;
 return options[Number(selection.slice(7))]??null;
}
export function normalizeScores(scores:Record<keyof typeof domainMaximums,number|null>,education:Applicability,complete:boolean) {
 const applicableDomains=(Object.keys(domainMaximums) as (keyof typeof domainMaximums)[]).filter(d=>d!=='education'||education!=='NOT_APPLICABLE');
 const applicableMaximum=applicableDomains.reduce((n,d)=>n+domainMaximums[d],0);
 const valid=education!=='UNKNOWN'&&applicableDomains.every(d=>typeof scores[d]==='number'&&Number.isFinite(scores[d])&&scores[d]!>=0&&scores[d]!<=domainMaximums[d]);
 const rawTotal=valid?applicableDomains.reduce((n,d)=>n+scores[d]!,0):null;
 const normalizedScore=complete&&valid?rawTotal!/applicableMaximum*100:null;
 const needLevel=normalizedScore===null?null:normalizedScore>=75?'A':normalizedScore>=50?'B':normalizedScore>=25?'C':'D';
 return {scoreVersion:comprehensiveScoreVersion,domainRawScores:{...scores,education:education==='NOT_APPLICABLE'?null:scores.education},applicableDomains,rawTotal,applicableMaximum,normalizedScore,needLevel};
}

export type DomainKey=keyof typeof domainMaximums;
export type SectionAnswers=Record<string,unknown>;
export type ComprehensiveAnswers=Partial<Record<DomainKey,SectionAnswers>>;
export type MissingItem={domain:DomainKey;section:string;field:string;memberId?:string;reason:string;target:string};
export type AssessmentAlert={code:string;sourceDomain:DomainKey;sourceSection:string;sourceField:string;memberId?:string;reason:string;severity:'ATTENTION'|'URGENT'|'CRITICAL';target:string};
export const alertDeadlineHours={ATTENTION:168,URGENT:72,CRITICAL:24} as const;
export function assessmentTarget(domain:DomainKey,field:string,memberId?:string) {
 return domain+'-'+(memberId?memberId+'-':'')+field;
}
export function evaluateComprehensive(answers:ComprehensiveAnswers,members:BaseMember[],asOf:string) {
 const active=members.filter(m=>m.active!==false),applicability=educationApplicability(active,asOf);
 const missing:MissingItem[]=[],alerts:AssessmentAlert[]=[];
 const scores:Record<DomainKey,number|null>={livelihood:null,health:null,housing:null,vulnerability:null,education:null};
 const miss=(domain:DomainKey,field:string,reason:string,memberId?:string)=>{
  missing.push({domain,section:field,field,memberId,reason,target:assessmentTarget(domain,field,memberId)});
 };
 if(!active.length)miss('health','screening','حداقل یک عضو فعال در اطلاعات پایه لازم است');
 const selected=(domain:DomainKey,field:string,options:readonly number[],source:SectionAnswers=answers[domain]??{},memberId?:string)=>{
  const score=mappedScore(options,source[field]);
  if(score===null)miss(domain,field,'پاسخ امتیازی معتبر لازم است',memberId);
  return score;
 };
 const required=(domain:DomainKey,field:string,source:SectionAnswers=answers[domain]??{},memberId?:string)=>{
  const value=source[field];
  if(value===undefined||value===null||value===''||value==='UNKNOWN'||(Array.isArray(value)&&!value.length))miss(domain,field,'تکمیل این مورد لازم است',memberId);
 };
 const alert=(domain:DomainKey,field:string,severity:AssessmentAlert['severity'],reason:string,memberId?:string)=>{
  alerts.push({code:domain+'.'+field+(memberId?'.'+memberId:''),sourceDomain:domain,sourceSection:field,sourceField:field,memberId,severity,reason,target:assessmentTarget(domain,field,memberId)});
 };
 const sum=(values:(number|null)[])=>values.every(v=>v!==null)?values.reduce<number>((n,v)=>n+v!,0):null;
 const l=answers.livelihood??{};
 const ls=Object.entries(scoreMappings.livelihood).map(([key,options])=>selected('livelihood',key,options));
 scores.livelihood=sum(ls);
 for(const key of ['incomeRange','incomeSources','mainIncomeSource'])required('livelihood',key);
 if(Array.isArray(l.incomeSources)&&!l.incomeSources.includes(l.mainIncomeSource))miss('livelihood','mainIncomeSource','منبع اصلی باید یکی از منابع انتخاب‌شده باشد');
 if(Array.isArray(l.pressures)&&l.pressures.length>3)miss('livelihood','pressures','حداکثر سه فشار اصلی انتخاب شود');
 if((ls[2]??0)>0)required('livelihood','pressures');
 if((ls[3]??0)>0)required('livelihood','debtType');
 if(['ONE','MULTIPLE'].includes(String(l.economicCapacity)))required('livelihood','workBarrier');
 if(ls[2]===5||ls[3]===4)alert('livelihood',ls[2]===5?'essentialCosts':'debt','URGENT','فشار بحرانی هزینه یا تعهد مالی');
 else if((ls[0]??0)>=8)alert('livelihood','adequacy','ATTENTION','بخشی از نیازهای پایه تأمین نمی‌شود');

 const h=answers.health??{},screening=Array.isArray(h.members)?h.members as SectionAnswers[]:[];
 const impact:number[]=[],treatment:number[]=[];let affected=0,healthComplete=true;
 for(const m of active){
  const response=screening.find(s=>s.memberId===m.id);
  if(!response||!['NO','YES'].includes(String(response.screening))){miss('health','screening','غربالگری سلامت عضو باید روشن باشد',m.id);healthComplete=false;continue;}
  if(response.screening==='NO')continue;
  affected++;required('health','issueType',response,m.id);
  const i=selected('health','functionalImpact',scoreMappings.health.functionalImpact,response,m.id);
  const t=selected('health','treatmentGap',scoreMappings.health.treatmentGap,response,m.id);
  if(i===null||t===null)healthComplete=false;else{impact.push(i);treatment.push(t);}
  if(t===6)alert('health','treatmentGap','CRITICAL','درمان ضروری همراه با خطر جدی دریافت نمی‌شود',m.id);
  else if(t===5)alert('health','treatmentGap','URGENT','درمان لازم به‌طور مؤثر دریافت نمی‌شود',m.id);
  else if((i??0)>=5)alert('health','functionalImpact','ATTENTION','محدودیت قابل توجه سلامت',m.id);
 }
 if(screening.some(s=>!active.some(m=>m.id===s.memberId))||new Set(screening.map(s=>s.memberId)).size!==screening.length)miss('health','screening','فهرست غربالگری باید با اعضای فعال تطبیق داشته باشد');
 // With no affected members, no irrelevant financial question is required.
 const financial=affected?selected('health','financialPressure',scoreMappings.health.financialPressure):0;
 scores.health=healthComplete&&financial!==null?Math.max(0,...impact)+Math.max(0,...treatment)+financial:null;

 const hs=Object.entries(scoreMappings.housing).map(([key,options])=>selected('housing',key,options));
 scores.housing=sum(hs);required('housing','residenceType');required('housing','problems');
 const housing=answers.housing??{};
 if(hs[0]===7&&housing.immediateDanger===true)alert('housing','stability','CRITICAL','فاقد سکونت پایدار همراه با خطر آنی');
 else if(hs[0]===5)alert('housing','stability','URGENT','خطر جدی تخلیه یا جابه‌جایی');
 else if(hs[0]===7||hs[1]===6)alert('housing',hs[0]===7?'stability':'qualitySafety','ATTENTION','وضعیت سکونت یا ایمنی نیازمند پیگیری است');

 const v=answers.vulnerability??{};
 const dep=selected('vulnerability','dependency',scoreMappings.vulnerability.dependency);
 const risk=selected('vulnerability','socialRisk',scoreMappings.vulnerability.socialRisk);
 required('vulnerability','risks');required('vulnerability','crisisType');
 const crisis=v.crisisType==='NONE'?0:selected('vulnerability','crisis',scoreMappings.vulnerability.crisis);
 if(v.crisisType!=='NONE'&&crisis===0)miss('vulnerability','crisis','اثر بحران موجود باید مشخص شود');
 scores.vulnerability=sum([dep,risk,crisis]);
 if((dep??0)>0){
  required('vulnerability','dependentMembers');required('vulnerability','supportAvailability');
  if(Array.isArray(v.dependentMembers)&&v.dependentMembers.some(id=>!active.some(m=>m.id===id)))miss('vulnerability','dependentMembers','عضو وابسته باید فعال و متعلق به خانواده باشد');
 }
 if(Array.isArray(v.risks)&&v.risks.includes('DEPENDENT')&&v.immediateDanger===true)alert('vulnerability','socialRisk','CRITICAL','خطر فوری برای کودک، سالمند یا فرد وابسته');
 else if(risk===5)alert('vulnerability','socialRisk','URGENT','ریسک اجتماعی نیازمند اقدام سریع');
 else if((risk??0)>=3)alert('vulnerability','socialRisk','ATTENTION','ریسک اجتماعی قابل توجه');
 if(crisis===4)alert('vulnerability','crisis','CRITICAL','بحران اخیر با اثر شدید/بحرانی');
 if((dep??0)>0&&['INADEQUATE','ABSENT'].includes(String(v.supportAvailability)))alert('vulnerability','supportAvailability','ATTENTION','حمایت موردنیاز عضو وابسته کافی نیست');

 for(const memberId of applicability.unknownMemberIds)miss('education','applicability','اطلاعات پایه برای تعیین مشمولیت تحصیل کافی نیست',memberId);
 const e=answers.education??{},students=Array.isArray(e.members)?e.members as SectionAnswers[]:[];
 const educationScores:number[]=[];
 if(applicability.state==='APPLICABLE'){
  for(const memberId of applicability.eligibleMemberIds){
   const response=students.find(s=>s.memberId===memberId)??{};
   const points=selected('education','status',scoreMappings.education.status,response,memberId);
   if(points!==null)educationScores.push(points);
   if((points??0)>0){required('education','barrier',response,memberId);required('education','support',response,memberId);}
   if((points??0)>=12)alert('education','status','URGENT','ترک تحصیل یا خطر جدی ترک تحصیل نیازمند پیگیری',memberId);
   else if((points??0)>=8)alert('education','status','ATTENTION','مشکل پایدار تحصیل نیازمند حمایت',memberId);
  }
  if(educationScores.length===applicability.eligibleMemberIds.length)scores.education=Math.max(0,...educationScores);
  if(new Set(students.map(s=>s.memberId)).size!==students.length)miss('education','screening','عضو تکراری در غربالگری آموزش');
 }
 // Only triggered OTHER fields require explanatory text.
 for(const domain of Object.keys(answers) as DomainKey[]){
  const section=answers[domain]??{};
  const validateOther=(record:SectionAnswers,memberId?:string)=>{
   for(const q of comprehensiveFields[domain+(memberId?'Member':'')]??[]){
    if(!visibleQuestion(q,record))continue;
    const value=record[q.key];if(value==='OTHER'||(Array.isArray(value)&&value.includes('OTHER')))required(domain,q.key+'Other',record,memberId);
   }
  };
  validateOther(section);
  if(Array.isArray(section.members))for(const m of section.members as SectionAnswers[])validateOther(m,String(m.memberId));
 }
 const validateQuestions=(domain:DomainKey,key:string,record:SectionAnswers,memberId?:string)=>{
  for(const q of comprehensiveFields[key]??[]){
   if(!visibleQuestion(q,record))continue;
   const value=record[q.key],values=q.multiple?(Array.isArray(value)?value:[]):[value];
   if(q.multiple&&value!==undefined&&!Array.isArray(value))miss(domain,q.key,'فهرست گزینه‌ها معتبر نیست',memberId);
   if(q.type==='text'&&value!==undefined&&(typeof value!=='string'||value.length>2000))miss(domain,q.key,'متن معتبر با طول مجاز لازم است',memberId);
   const blank=value===undefined||value===null||value===''||(q.multiple&&!values.length);
   if(blank){if(!q.optional)miss(domain,q.key,q.label+'؛ پاسخ لازم است',memberId);continue;}
   if(q.type==='boolean'){if(typeof value!=='boolean')miss(domain,q.key,'پاسخ بله/خیر معتبر لازم است',memberId);continue;}
   if(q.options&&values.some(v=>!q.options!.some(o=>o.value===v)))miss(domain,q.key,'گزینه نامعتبر است',memberId);
   if(!q.allowUnknown&&value==='UNKNOWN'&&q.key!=='incomeRange')miss(domain,q.key,'پاسخ نامشخص نیازمند تکمیل است',memberId);
   if(q.multiple&&(new Set(values).size!==values.length||(values.includes('NONE')&&values.length>1)))miss(domain,q.key,'گزینه‌های متناقض یا تکراری انتخاب شده‌اند',memberId);
   if(q.max&&values.length>q.max)miss(domain,q.key,'تعداد انتخاب بیش از حد مجاز است',memberId);
   if(values.includes('OTHER')&&!(typeof record[q.key+'Other']==='string'&&String(record[q.key+'Other']).trim()))miss(domain,q.key+'Other','توضیح کوتاه سایر لازم است',memberId);
  }
 };
 for(const d of ['livelihood','housing','vulnerability'] as DomainKey[])validateQuestions(d,d,answers[d]??{});
 for(const m of active)validateQuestions('health','healthMember',screening.find(s=>s.memberId===m.id)??{},m.id);
 if(affected)validateQuestions('health','health',h);
 for(const memberId of applicability.eligibleMemberIds)validateQuestions('education','educationMember',students.find(s=>s.memberId===memberId)??{},memberId);
 const complete=missing.length===0;
 return {complete,missing,alerts,educationApplicability:applicability,
  ...normalizeScores(scores,applicability.state,complete),
  summaryLines:Object.fromEntries(Object.entries(domainLabels).map(([d,label])=>[d,{label,items:(comprehensiveFields[d]??[]).filter(q=>visibleQuestion(q,answers[d as DomainKey]??{})).map(q=>({field:q.key,label:q.label,value:Array.isArray(answers[d as DomainKey]?.[q.key])?(answers[d as DomainKey]![q.key] as string[]).map(v=>q.options?.find(o=>o.value===v)?.label??v).join('، '):q.options?.find(o=>o.value===answers[d as DomainKey]?.[q.key])?.label??answers[d as DomainKey]?.[q.key]??null}))}])),
  summaries:{health:{activeMembers:active.length,affectedMembers:affected,maxFunctionalImpact:Math.max(0,...impact),maxTreatmentGap:Math.max(0,...treatment),financialPressure:financial},
   education:{applicability:applicability.state,eligibleMembers:applicability.eligibleMemberIds.length,affectedMembers:educationScores.filter(n=>n>0).length}}};
}
