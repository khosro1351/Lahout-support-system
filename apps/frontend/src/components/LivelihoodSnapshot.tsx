import {PersianDate} from './PersianDate';
import {digits} from '../pages/vocabulary';
type Row=Record<string,any>;
const sections={income:'درآمد و منابع',employment:'اشتغال و توان اقتصادی',expenses:'هزینه‌ها و تعهدات',evidence:'شواهد و توضیحات'};
export function LivelihoodSnapshot({snapshot}:{snapshot:Row}){
 const p=snapshot.payload,form=snapshot.formSchema;
 function value(field:Row,row:Row){const v=row[field.key];if(v===null||v===undefined||v==='')return 'ثبت نشده';if(v==='UNKNOWN')return 'نامشخص';if(field.type==='date')return <PersianDate value={v}/>;if(field.type==='member'){const m=snapshot.members.find((m:Row)=>m.id===v);return m?m.first_name+' '+m.last_name:'عضو ثبت‌شده در نسخه';}return typeof v==='number'?digits(v):String(v);}
 return <div className="assessment-readonly">
 <section className="panel assessment-summary" id="section-summary"><h2>جمع‌بندی چهار شاخص معیشت</h2><p><strong>{digits(snapshot.result.score)} از ۳۰</strong></p><dl>{snapshot.modelDefinition.indicators.map((i:Row)=><div key={i.key}><dt>{i.label}</dt><dd>{i.options.find((o:Row)=>o.code===p.summaries?.[i.key])?.label??'نامشخص'}</dd></div>)}<div><dt>فوریت</dt><dd>{{IMMEDIATE:'فوری',NECESSARY:'ضروری',IMPORTANT:'مهم',NON_URGENT:'غیرفوری'}[p.urgency as string]??'ثبت نشده'}</dd></div><div><dt>جمع‌بندی سرگروه</dt><dd>{p.notes||'ثبت نشده'}</dd></div></dl><details><summary>نشانه‌ها و کنترل‌های هنگام ارسال</summary><p>{p.critical?.join('، ')||'نشانه‌ای ثبت نشده است'}</p><p>{p.criticalAction||'اقدام فوری ثبت نشده است'}</p><ul className="assessment-checks">{form.checks.map((c:string,i:number)=><li key={c}>{p.checks?.[i]?'✓':'—'} {c}</li>)}</ul></details></section>
 {Object.entries(sections).map(([key,title])=><section className="panel" id={'section-'+key} key={key}><h2>{title}</h2>{(p[key]??[]).map((row:Row,i:number)=><details className="compact-record" key={i}><summary><span>ردیف {digits(i+1)}</span>{form.schema[key].slice(0,3).map((f:Row)=><span key={f.key}>{value(f,row)}</span>)}</summary><dl>{form.schema[key].map((f:Row)=><div key={f.key}><dt>{f.label}</dt><dd>{value(f,row)}</dd></div>)}</dl></details>)}{!p[key]?.length&&<p>اطلاعات ثبت نشده است.</p>}</section>)}
 </div>;
}
