import {FamilyBase} from '../components/FamilyBase';
import {AssessmentDomainTabs} from '../components/AssessmentDomainTabs';
import {PersianDate} from '../components/PersianDate';
import {Link,useParams} from 'react-router-dom';
import {Screen,Timeline,useData} from './GuideWorkspace';
import {useAuth} from '../auth/AuthProvider';
import {ContextAlerts} from './ReviewContext';
import {display} from './ReviewPages';
import {Score,Status,operationalGroup,urgencyLabel} from './LeaderWorkspace';
import {digits} from './vocabulary';
type Row=Record<string,any>;
const domains:Record<string,string>={health:'سلامت',housing:'مسکن',vulnerability:'آسیب‌پذیری ویژه',education:'آموزش'};
function EvidenceValue({value}:{value:unknown}){if(value==null)return <>ثبت نشده</>;if(typeof value==='object')return <>اطلاعات ساختاریافته موجود است؛ در فرم ثبت‌شده مشاهده کنید.</>;return <>{String(value)}</>;}
export function SharedFamilyWorkspace(){
 const {id}=useParams(),{user}=useAuth(),guide=user?.effectiveRole==='SUPREME_GUIDE';
 const {data,error,refresh}=useData('/shared/families/'+id),livelihood=useData('/livelihood/families'),f=data?.family,row=livelihood.data?.families.find((x:Row)=>x.id===id),members:Row[]=data?.members??[],alerts:Row[]=data?.alerts??[];
 return <Screen title={f?'پرونده '+f.family_code:'پرونده خانواده'} error={error}><div className="family-workspace">{!data&&!error&&<p role="status">در حال دریافت اطلاعات…</p>}{data&&!f&&<p role="alert">اطلاعات اصلی این پرونده در دسترس نیست. از فهرست خانواده‌ها دوباره وارد شوید.</p>}{f&&<>
 <AssessmentDomainTabs familyId={id!}/>
 <section className="panel"><h2>خلاصه پرونده خانواده</h2><div className="family-summary"><p><small>شناسه پرونده</small><bdi>{f.family_code}</bdi></p><p><small>سرپرست</small><strong>{f.head_name??'سرپرست ثبت نشده'}</strong></p><p><small>گروه</small>{operationalGroup(f.group_name,row?.group_code)}</p><p><small>تلفن تماس</small><bdi>{f.mobile??'ثبت نشده'}</bdi></p><p><small>تعداد اعضای فعال</small>{digits(members.length)}</p><p><small>محله</small>{f.neighborhood??'ثبت نشده'}</p><p><small>هشدارهای فعال</small>{digits(alerts.filter(a=>a.state!=='RESOLVED'&&!a.closed_at).length)}</p></div></section>
 </>}
 <FamilyBase key={id} familyId={id!} onSaved={()=>{refresh();livelihood.refresh();}}/>
 {f&&<>
 <details className="panel"><summary>مدارک ({digits(data.documents?.length??0)})</summary>{(data.documents??[]).map((d:Row)=><p key={d.id}><a href={'/api/v1/cases/families/'+id+'/documents/'+d.id}>{d.name}</a></p>)}{!data.documents?.length&&<p>مدرکی ثبت نشده است.</p>}</details>
 <details className="panel"><summary>تحقیقات و بازدیدها</summary>{(data.research??[]).map((r:Row)=><details key={r.id}><summary>{r.source==='LEADER'?'فرم سرگروه':'فرم هیأت تحقیق'} · <PersianDate value={r.recorded_at} withTime/></summary><p>تکمیل: <PersianDate value={r.completed_at} withTime/></p>{Object.entries(r.answers??{}).map(([key,value])=><p key={key}>{domains[key]??key}: <EvidenceValue value={value}/></p>)}</details>)}{!data.research?.length&&<p>تحقیق یا بازدیدی ثبت نشده است.</p>}</details>
 <details className="panel"><summary>حمایت‌های ثبت‌شده</summary>{(data.supports??[]).map((s:Row)=><article key={s.id}><strong>{s.category}</strong><p>{s.amount==null?'مبلغ ثبت نشده':digits(s.amount)} · {display(s.status)} · <PersianDate value={s.occurred_at} withTime/></p><EvidenceValue value={s.result}/></article>)}{!data.supports?.length&&<p>حمایتی ثبت نشده است.</p>}</details>
 <ContextAlerts alerts={alerts} refresh={refresh}/><details className="panel"><summary>تاریخچه پرونده</summary><Timeline rows={data.history??[]} renderDate={value=><PersianDate value={value} withTime/>}/></details>
 </>}</div></Screen>;
}
