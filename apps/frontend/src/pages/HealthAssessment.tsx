import {DocumentLink} from '../components/Documents';
import {useEffect,useState} from 'react';
import {Link,useParams} from 'react-router-dom';
import {Screen,Field,useData,Timeline,date} from './GuideWorkspace';
import {useAuth} from '../auth/AuthProvider';
import {api} from '../api/client';
import {AssessmentHeader} from '../components/AssessmentHeader';
import {PersianDate} from '../components/PersianDate';

import {HealthSpecialized} from '../components/HealthSpecialized';
import {FamilyBaseView} from '../components/FamilyBase';
import {digits} from './vocabulary';

type Screening={answer:string;source:string;source_detail:string;notes:string;version:number;creator_name:string;editor_name:string;created_at:string;updated_at:string};
type Member={id:string;first_name:string;last_name:string;relationship_code:string;birth_date:string|null;screening:Screening|null};
type Workspace={family:{code:string};members:Member[];status:string};
const answers={NO:'ندارد',YES:'دارد',UNKNOWN:'نامشخص'};
const sources={INTERVIEW:'گفت‌وگوی مستند با خانواده',OBSERVATION:'مشاهده معتبر',VISIT:'گزارش بازدید',DOCUMENT:'مدرک/سند موجود',OTHER:'سایر'};
const relations:Record<string,string>={HEAD:'سرپرست',SPOUSE:'همسر',CHILD:'فرزند',PARENT:'والد',SIBLING:'خواهر/برادر',OTHER:'سایر'};
const question='آیا این عضو در حال حاضر مسئله‌ای در حوزه سلامت دارد که بر زندگی روزمره، هزینه‌های خانواده، نیاز به مراقبت یا پیگیری درمانی او اثر مؤثر داشته باشد؟';

function MemberScreening({member,familyId,refresh,open,onSelect,children,formComplete=false}:{member:Member;familyId:string;refresh:()=>void;open:boolean;onSelect:(id:string)=>void;children?:React.ReactNode;formComplete?:boolean}){
 const saved=member.screening;
 const [answer,setAnswer]=useState(saved?.answer??''),[source,setSource]=useState(saved?.source??'');
 const [detail,setDetail]=useState(saved?.source_detail??''),[notes,setNotes]=useState(saved?.notes??'');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 useEffect(()=>{setAnswer(saved?.answer??'');setSource(saved?.source??'');setDetail(saved?.source_detail??'');setNotes(saved?.notes??'');},[saved?.version]);
 async function save(e:React.FormEvent){
  e.preventDefault();setBusy(true);setError('');setMessage('');
  try{
   await api('/health-screening/families/'+familyId+'/members/'+member.id,{method:'POST',body:JSON.stringify({answer,source,sourceDetail:detail,notes,version:saved?.version??0})});
   setMessage('غربالگری ذخیره شد.');refresh();
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 return <details className="panel screening-form" data-member={member.id} open={open}>
  <summary onClick={e=>{e.preventDefault();onSelect(open?'':member.id);}}>{member.first_name} {member.last_name} — {saved?'ثبت شده':'ثبت نشده'}</summary>
  {member.birth_date&&<p>تاریخ تولد: <PersianDate value={member.birth_date}/></p>}
  <form onSubmit={e=>void save(e)}>
   <fieldset className="screening-question" disabled={busy}><legend>{question}</legend><div className="screening-choices">
    {Object.entries(answers).map(([key,label])=><label className="check-field" key={key}>
     <input type="radio" name={'screening-'+member.id} value={key} required checked={answer===key} onChange={()=>{setAnswer(key);setMessage('');}}/>{label}
    </label>)}
   </div></fieldset>
   {answer==='YES'&&<p className="quiet-state">{formComplete?'فرم تخصصی تکمیل شده':'فرم تخصصی نیازمند تکمیل'}</p>}
   {answer==='UNKNOWN'&&<p role="status" className="quiet-state">وضعیت نامشخص است؛ برای تکمیل غربالگری نیاز به بررسی دارد.</p>}
   <fieldset disabled={busy}><div className="filter-grid">
    <Field label="منبع / مبنای بررسی"><select required value={source} onChange={e=>setSource(e.target.value)}>
     <option value="" disabled>انتخاب مبنای بررسی</option>{Object.entries(sources).map(([key,label])=><option value={key} key={key}>{label}</option>)}
    </select></Field>
    {source==='OTHER'&&<Field label="توضیح مبنای سایر"><input required maxLength={500} value={detail} onChange={e=>setDetail(e.target.value)}/></Field>}
    <Field label="توضیح غربالگری (اختیاری)"><textarea maxLength={2000} value={notes} onChange={e=>setNotes(e.target.value)}/></Field>
   </div></fieldset>
   {error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
   <div className="workspace-actions"><button disabled={busy||!answer||!source||(source==='OTHER'&&!detail.trim())}>ذخیره غربالگری</button></div>
  </form>
  {children}
  {saved&&<details className="workflow-facts"><summary>جزئیات ثبت غربالگری</summary>
   <p>ثبت‌کننده: {saved.creator_name} · زمان ثبت: <PersianDate value={saved.created_at} withTime/></p>
   <p>آخرین ویرایش‌کننده: {saved.editor_name} · آخرین ویرایش: <PersianDate value={saved.updated_at} withTime/></p>
  </details>}
 </details>;
}

type Row=Record<string,any>;
const workflowStates:Record<string,string>={NOT_RECORDED:'ثبت نشده',READY:'آماده ارسال',DRAFT:'در حال تکمیل',SUBMITTED:'منتظر تأیید مدیر اجرایی',RETURNED:'برگشتی برای اصلاح',APPROVED:'تأییدشده'};
export function HealthAssessment(){
 const {id}=useParams(),{user}=useAuth(),{data:loaded,error,refresh}=useData('/health-assessment/families/'+id);
 const [data,setData]=useState<Row|null>(null),[expanded,setExpanded]=useState(''),[selected,setSelected]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[reason,setReason]=useState('');
 useEffect(()=>{setData(null);setSelected('');setExpanded('');},[id]);
 useEffect(()=>{if(loaded)setData(loaded);},[loaded]);
 async function run(path:string,body:Row){setBusy(true);setMessage('');try{await api(path,{method:'POST',body:JSON.stringify(body)});setMessage('ثبت شد.');refresh();return true;}catch(e){setMessage((e as Error).message);return false;}finally{setBusy(false);}}
 const review=data?.review,submission=data?.submissions?.find((s:Row)=>s.id===selected)??data?.submissions?.[0];
 const historical=!!submission&&(!!selected||!review||review.state==='SUBMITTED'||user?.effectiveRole!=='GROUP_LEADER');
 const shown=historical?submission.snapshot:data,members:Row[]=shown?.members??[],fields=shown?.fields??data?.fields??{};
 const editable=!historical&&data?.canEdit&&user?.effectiveRole==='GROUP_LEADER';
 const formComplete=(m:Row)=>m.specialized&&Object.keys(fields).every(k=>m.specialized[k]?.trim());
 return <Screen title="سلامت و درمان" error={error} loading={!data&&!error}>{data&&<div className="health-workspace">
 <AssessmentHeader familyId={id!} familyCode={data.family.code} familyStatus={data.family.status} status={workflowStates[historical?(submission.decision??'SUBMITTED'):(review?.state==='DRAFT'&&data.result.complete?'READY':review?.state??'NOT_RECORDED')]} mode={historical?'حالت مشاهده نسخه تاریخی':editable?'حالت ویرایش ارزیابی سلامت':'حالت مشاهده ارزیابی سلامت'} reason={submission?.decision==='RETURNED'?submission.reason:undefined}>
 {user?.effectiveRole==='GROUP_LEADER'&&!review&&<button disabled={busy} onClick={()=>void run('/health-assessment/families/'+id+'/draft',{}).then(ok=>{if(ok){setSelected('');setExpanded('');}})}>{submission?'ایجاد ارزیابی جدید با حفظ نسخه تأییدشده':'ایجاد پیش‌نویس سلامت'}</button>}
 {review&&['DRAFT','RETURNED'].includes(review.state)&&user?.effectiveRole==='GROUP_LEADER'&&<button className="secondary" onClick={()=>{setSelected('');setExpanded('');}}>ادامه ارزیابی در حال تکمیل</button>}
 {editable&&review&&<><button disabled={busy||!data.result?.complete} onClick={()=>void run('/health-assessment/families/'+id+'/submit',{version:review.version}).then(ok=>{if(ok)setSelected('');})}>ارسال سلامت برای مدیر اجرایی</button>{!data.result?.complete&&<a href="#health-completeness">بررسی موارد لازم برای ارسال</a>}</>}
 {data.canDecide&&<a href="#health-decision">بررسی و تصمیم مدیر اجرایی</a>}
 </AssessmentHeader>
 <p className="quiet-state">امتیاز سلامت: نامشخص — در انتظار تصویب قواعد عددی (سقف حوزه: ۲۰). تأیید این نسخه مربوط به محتوای ارزیابی است.</p>
 {!!data.submissions?.length&&<Field label="نسخه سلامت"><select value={historical?submission.id:''} onChange={e=>{setSelected(e.target.value);setExpanded('');}}>{review&&review.state!=='SUBMITTED'&&user?.effectiveRole==='GROUP_LEADER'&&<option value="">ارزیابی جاری — {workflowStates[review.state]}</option>}{data.submissions.map((s:Row)=><option key={s.id} value={s.id}>نسخه {digits(s.revision)} — {workflowStates[s.decision??'SUBMITTED']} — {date(s.submitted_at)}</option>)}</select></Field>}

 {historical&&<section className="panel"><p>ارسال: <PersianDate value={submission.submitted_at} withTime/> {submission.decision==='APPROVED'&&<> · تأییدکننده: {submission.approver} · <PersianDate value={submission.decided_at} withTime/></>}</p><details><summary>اطلاعات خانواده در زمان ارسال این نسخه</summary><FamilyBaseView family={shown.family} members={members} asOf={submission.submitted_at}/></details></section>}
 <h2>غربالگری سلامت اعضای خانواده</h2>
 <div className="panel table-scroll screening-summary"><table><thead><tr><th>نام و نام خانوادگی</th><th>نسبت</th><th>وضعیت غربالگری</th><th>مسئله مؤثر سلامت</th><th>وضعیت فرم تخصصی</th><th>اقدام</th></tr></thead><tbody>{members.map(m=><tr key={m.id}><td>{m.first_name} {m.last_name}</td><td>{relations[m.relationship_code]??m.relationship_code}</td><td>{m.answer==='UNKNOWN'?'نامشخص / نیازمند بررسی':m.answer?'ثبت شده':'ثبت نشده'}</td><td>{answers[m.answer as keyof typeof answers]??'—'}</td><td>{m.answer==='NO'?'نیاز ندارد':m.answer==='YES'?formComplete(m)?'تکمیل شده':'فرم تخصصی نیازمند تکمیل':'نیازمند بررسی'}</td><td><button className="secondary" onClick={()=>{setExpanded(m.id);requestAnimationFrame(()=>document.getElementById('screening-'+m.id)?.scrollIntoView({block:'start',behavior:'smooth'}));}}>{editable?'ثبت / ویرایش غربالگری':'مشاهده جزئیات'}</button></td></tr>)}</tbody></table></div>
 {!members.length&&<p>نسخه یا عضو فعالی برای نمایش وجود ندارد.</p>}
 {members.map(m=><div key={m.id} id={'screening-'+m.id}>{editable?<MemberScreening member={{...m,screening:m.answer?{...m,version:m.screening_version}:null} as Member} familyId={id!} refresh={refresh} open={expanded===m.id} onSelect={setExpanded} formComplete={!!formComplete(m)}>
 {m.answer==='YES'&&(review?<HealthSpecialized member={m} familyId={id!} fields={fields} documents={data.documents??[]} refresh={refresh}/>:<p>برای تکمیل فرم تخصصی، «ایجاد پیش‌نویس سلامت» را انتخاب کنید.</p>)}
 </MemberScreening>:<details className="panel" data-member={m.id} open={expanded===m.id}><summary onClick={e=>{e.preventDefault();setExpanded(expanded===m.id?'':m.id);}}>{m.first_name} {m.last_name}</summary><dl className="read-only-grid"><div><dt>پاسخ غربالگری</dt><dd>{answers[m.answer as keyof typeof answers]??'ثبت نشده'}</dd></div><div><dt>منبع بررسی</dt><dd>{sources[m.source as keyof typeof sources]??'ثبت نشده'}</dd></div><div><dt>توضیحات</dt><dd>{m.notes||'—'} {m.source_detail}</dd></div>{m.answer==='YES'&&Object.entries(fields as Record<string,string>).map(([k,label])=><div key={k}><dt>{label}</dt><dd>{m.specialized?.[k]||'ثبت نشده'}</dd></div>)}{m.specialized&&<><div><dt>هزینه تقریبی (تومان)</dt><dd>{m.specialized.cost==null?'ثبت نشده':digits(m.specialized.cost)}</dd></div><div><dt>توضیحات تکمیلی</dt><dd>{m.specialized.notes||'—'}</dd></div></>}</dl>{m.specialized?.documentIds?.map((doc:string)=>{const d=shown.documents?.find((x:Row)=>x.id===doc);return d?<p key={doc}><DocumentLink familyId={id!} document={d}/></p>:null;})}</details>}</div>)}
 {editable&&review&&<section className="panel" id="health-completeness"><h2>نتیجه و ارسال سلامت</h2><p>غربالگری همه اعضا و فرم‌های لازم بررسی می‌شوند؛ امتیاز عددی در این مرحله شرط ارسال نیست.</p>{data.result?.missing?.length>0&&<ul>{data.result.missing.map((m:string)=><li key={m}>{m}</li>)}</ul>}</section>}
 {data.canDecide&&submission&&submission.id===data.submissions[0]?.id&&<section className="panel" id="health-decision"><h2>تصمیم مدیر اجرایی</h2><Field label="دلیل بازگشت سلامت"><textarea value={reason} onChange={e=>setReason(e.target.value)} maxLength={2000}/></Field><div className="workspace-actions"><button disabled={busy} onClick={()=>void run('/health-assessment/submissions/'+submission.id+'/approve',{version:review.version})}>تأیید محتوای سلامت</button><button className="secondary" disabled={busy||!reason.trim()} onClick={()=>void run('/health-assessment/submissions/'+submission.id+'/return',{version:review.version,reason})}>بازگرداندن برای اصلاح</button></div></section>}
 {message&&<p role="status">{message}</p>}
 <details className="panel"><summary>تاریخچه و جزئیات ثبت سلامت</summary><Timeline rows={data.history??[]}/></details>
 </div>}</Screen>;
}
export function HealthQueue(){const {data,error}=useData('/health-assessment/queue');return <Screen title="ارزیابی‌های سلامت منتظر تأیید" error={error}>{data?.items.map((r:Row)=><Link className="data-row" key={r.id} to={'/workspace/health/'+r.family_id}><strong>{r.family_code}</strong><span>بررسی ارزیابی سلامت</span><PersianDate value={r.submitted_at} withTime/></Link>)}{data&&!data.items.length&&<p>ارزیابی سلامت منتظر تأیید وجود ندارد.</p>}</Screen>;}
