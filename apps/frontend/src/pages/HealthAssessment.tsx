import {useEffect,useState} from 'react';
import {useParams} from 'react-router-dom';
import {Screen,Field,useData} from './GuideWorkspace';
import {useAuth} from '../auth/AuthProvider';
import {api} from '../api/client';
import {AssessmentDomainTabs} from '../components/AssessmentDomainTabs';
import {PersianDate} from '../components/PersianDate';

type Screening={answer:string;source:string;source_detail:string;notes:string;version:number;creator_name:string;editor_name:string;created_at:string;updated_at:string};
type Member={id:string;first_name:string;last_name:string;relationship_code:string;birth_date:string|null;screening:Screening|null};
type Workspace={family:{code:string};members:Member[];status:string};
const answers={NO:'ندارد',YES:'دارد',UNKNOWN:'نامشخص'};
const sources={INTERVIEW:'گفت‌وگوی مستند با خانواده',OBSERVATION:'مشاهده معتبر',VISIT:'گزارش بازدید',DOCUMENT:'مدرک/سند موجود',OTHER:'سایر'};
const relations:Record<string,string>={HEAD:'سرپرست',SPOUSE:'همسر',CHILD:'فرزند',PARENT:'والد',SIBLING:'خواهر/برادر',OTHER:'سایر'};
const question='آیا این عضو در حال حاضر مسئله‌ای در حوزه سلامت دارد که بر زندگی روزمره، هزینه‌های خانواده، نیاز به مراقبت یا پیگیری درمانی او اثر مؤثر داشته باشد؟';

function MemberScreening({member,familyId,refresh}:{member:Member;familyId:string;refresh:()=>void}){
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
 return <details className="panel" data-member={member.id}>
  <summary>{member.first_name} {member.last_name} — {saved?'ثبت شده':'ثبت نشده'}</summary>
  {member.birth_date&&<p>تاریخ تولد: <PersianDate value={member.birth_date}/></p>}
  <form onSubmit={e=>void save(e)}>
   <fieldset disabled={busy}><legend>{question}</legend>
    {Object.entries(answers).map(([key,label])=><label className="check-field" key={key}>
     <input type="radio" name={'screening-'+member.id} value={key} required checked={answer===key} onChange={()=>{setAnswer(key);setMessage('');}}/>{label}
    </label>)}
   </fieldset>
   {answer==='YES'&&<p className="quiet-state">فرم تخصصی نیازمند تکمیل</p>}
   {answer==='UNKNOWN'&&<p role="status" className="quiet-state">وضعیت نامشخص است؛ برای تکمیل غربالگری نیاز به بررسی دارد.</p>}
   <fieldset disabled={busy}><div className="filter-grid">
    <Field label="منبع / مبنای بررسی"><select required value={source} onChange={e=>setSource(e.target.value)}>
     <option value="" disabled>انتخاب مبنای بررسی</option>{Object.entries(sources).map(([key,label])=><option value={key} key={key}>{label}</option>)}
    </select></Field>
    {source==='OTHER'&&<Field label="توضیح مبنای سایر"><input required maxLength={500} value={detail} onChange={e=>setDetail(e.target.value)}/></Field>}
    <Field label="توضیح غربالگری (اختیاری)"><textarea maxLength={2000} value={notes} onChange={e=>setNotes(e.target.value)}/></Field>
   </div></fieldset>
   {error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
   <button disabled={busy||!answer||!source||(source==='OTHER'&&!detail.trim())}>ذخیره غربالگری</button>
  </form>
  {saved&&<div className="workflow-facts">
   <p>ثبت‌کننده: {saved.creator_name} · زمان ثبت: <PersianDate value={saved.created_at} withTime/></p>
   <p>آخرین ویرایش‌کننده: {saved.editor_name} · آخرین ویرایش: <PersianDate value={saved.updated_at} withTime/></p>
  </div>}
 </details>;
}
function LeaderHealthScreening({familyId}:{familyId:string}){
 const {data:loaded,error,refresh}=useData<Workspace>('/health-screening/families/'+familyId);
 const [data,setData]=useState<Workspace|null>(null);
 useEffect(()=>{if(loaded)setData(loaded);},[loaded]);
 return <Screen title="سلامت و درمان" error={error} loading={!data&&!error}>{data&&!error&&<div dir="rtl">
  <AssessmentDomainTabs familyId={familyId} badges={{health:data.status==='NOT_RECORDED'?'ثبت نشده':'در حال تکمیل'}}/>
  <h2>غربالگری سلامت اعضای خانواده</h2>
  <p><bdi>{data.family.code}</bdi></p>
  <div className="table-scroll"><table><thead><tr><th>نام و نام خانوادگی</th><th>نسبت</th><th>وضعیت غربالگری</th><th>مسئله مؤثر سلامت</th><th>وضعیت فرم تخصصی</th><th>اقدام</th></tr></thead>
   <tbody>{data.members.map(m=><tr key={m.id}>
    <td>{m.first_name} {m.last_name}</td><td>{relations[m.relationship_code]??m.relationship_code}</td>
    <td>{!m.screening?'ثبت نشده':m.screening.answer==='UNKNOWN'?'نامشخص / نیازمند بررسی':'ثبت شده'}</td>
    <td>{m.screening?answers[m.screening.answer as keyof typeof answers]:'—'}</td>
    <td>{m.screening?.answer==='YES'?'فرم تخصصی نیازمند تکمیل':m.screening?.answer==='NO'?'نیاز ندارد':'—'}</td>
    <td><button className="secondary" onClick={()=>{const el=document.getElementById('screening-'+m.id)?.querySelector('details');if(el){el.open=true;el.querySelector('input')?.focus();}}}>ثبت / ویرایش غربالگری</button></td>
   </tr>)}</tbody></table></div>
  {!data.members.length&&<p>عضو فعالی در این خانواده ثبت نشده است.</p>}
  {data.members.map(m=><div id={'screening-'+m.id} key={m.id}><MemberScreening member={m} familyId={familyId} refresh={refresh}/></div>)}
 </div>}</Screen>;
}
function ExistingHealthPlaceholder({familyId}:{familyId:string}){
 const {data,error}=useData('/livelihood/families/'+familyId);
 return <Screen title="سلامت و درمان" error={error} loading={!data&&!error}>{data&&<>
  <AssessmentDomainTabs familyId={familyId}/><p>ارزیابی سلامت و درمان این خانواده هنوز تکمیل نشده است.</p>
 </>}</Screen>;
}
export function HealthAssessment(){
 const {id}=useParams(),{user}=useAuth();
 return user?.effectiveRole==='GROUP_LEADER'?<LeaderHealthScreening key={id} familyId={id!}/>:<ExistingHealthPlaceholder familyId={id!}/>;
}
