import {PersianDate} from './PersianDate';
import {digits} from '../pages/vocabulary';
type Row=Record<string,any>;
const sections={income:'درآمد و منابع',employment:'اشتغال و توان اقتصادی',expenses:'هزینه‌ها و تعهدات',evidence:'شواهد و توضیحات'};
export function LivelihoodSnapshot({snapshot}:{snapshot:Row}){
 const p=snapshot.payload,form=snapshot.formSchema;
 function value(field:Row,row:Row){
  const v=row[field.key];if(v===null||v===undefined||v==='')return 'ثبت نشده';if(v==='UNKNOWN')return 'نامشخص';
  if(field.type==='date')return <PersianDate value={v}/>;
  if(field.type==='member'){const m=snapshot.members.find((m:Row)=>m.id===v);return m?m.first_name+' '+m.last_name:'عضو ثبت‌شده در نسخه';}
  return typeof v==='number'?digits(v):String(v);
 }
 return <div className="assessment-readonly">
 {Object.entries(sections).map(([key,title])=><section className="panel" id={'section-'+key} key={key}><h2>{title}</h2>{(p[key]??[]).map((row:Row,i:number)=><section className="panel" key={i}><h3>ردیف {digits(i+1)}</h3><dl>{form.schema[key].map((f:Row)=><div key={f.key}><dt>{f.label}</dt><dd>{value(f,row)}</dd></div>)}</dl></section>)}{!p[key]?.length&&<p className="quiet-state">اطلاعات ثبت نشده است.</p>}</section>)}
 <section className="panel" id="section-summary"><h2>جمع‌بندی چهار شاخص معیشت</h2><dl>{snapshot.modelDefinition.indicators.map((i:Row)=><div key={i.key}><dt>{i.label}</dt><dd>{i.options.find((o:Row)=>o.code===p.summaries?.[i.key])?.label??'نامشخص'}</dd></div>)}
 <div><dt>فوریت موضوع معیشت</dt><dd>{{IMMEDIATE:'فوری',NECESSARY:'ضروری',IMPORTANT:'مهم',NON_URGENT:'غیرفوری'}[p.urgency as string]??'ثبت نشده'}</dd></div>
 <div><dt>نشانه‌های بحرانی ثبت‌شده</dt><dd>{p.critical?.length?p.critical.join('، '):'نشانه‌ای ثبت نشده است'}</dd></div>
 <div><dt>اقدام فوری آغازشده / شواهد نشانه بحرانی</dt><dd>{p.criticalAction||'ثبت نشده'}</dd></div>
 <div><dt>جمع‌بندی نهایی سرگروه</dt><dd>{p.notes||'ثبت نشده'}</dd></div></dl>
 <details><summary>کنترل‌های ثبت‌شده هنگام ارسال</summary><ul className="assessment-checks">{form.checks.map((c:string,i:number)=><li key={c}>{p.checks?.[i]?'✓':'—'} {c}</li>)}</ul></details></section>
 </div>;
}
