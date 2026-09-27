import {useEffect,useId,useState,type InputHTMLAttributes} from 'react';
import {formatPersianDate,parsePersianDate,persianMonthLength,toPersianDigits} from '../utils/persianDate';
type Props=Omit<InputHTMLAttributes<HTMLInputElement>,'value'|'onChange'|'type'> & {value:string;onChange:(value:string)=>void;onValidityChange?:(valid:boolean)=>void;};
const months=['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
const latin=(v:string)=>v.replace(/[۰-۹]/g,c=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c)));
function parts(value:string){const a=value?latin(formatPersianDate(value)).split('/'):[];return {year:a[0]??'',month:a[1]??'',day:a[2]??''};}
export function PersianDateInput({value,onChange,onValidityChange,id,disabled,required,...props}:Props){
 const generated=useId(),inputId=id??generated,currentYear=Number(latin(formatPersianDate(new Date())).split('/')[0]);
 const [selected,setSelected]=useState(()=>parts(value)),[invalid,setInvalid]=useState(false);
 const [range,setRange]=useState({min:Math.max(1,currentYear-130),max:currentYear+5});
 useEffect(()=>{setSelected(parts(value));setInvalid(false);onValidityChange?.(true);},[value]);
 useEffect(()=>()=>onValidityChange?.(true),[]);
 const maxDay=selected.year&&selected.month?persianMonthLength(Number(selected.year),Number(selected.month)):0;
 const years=Array.from({length:range.max-range.min+1},(_,i)=>range.max-i);
 if(selected.year&&!years.includes(Number(selected.year)))years.push(Number(selected.year));
 function change(key:'year'|'month'|'day',v:string){
  if(v==='older'||v==='newer'){setRange(r=>({min:v==='older'?Math.max(1,r.min-100):r.min,max:v==='newer'?Math.min(9999,r.max+100):r.max}));return;}
  const next={...selected,[key]:v};
  if(key!=='day'&&next.day&&Number(next.day)>persianMonthLength(Number(next.year),Number(next.month)))next.day='';
  const empty=!next.year&&!next.month&&!next.day,parsed=empty?'':parsePersianDate(next.year+'/'+next.month+'/'+next.day);
  setSelected(next);setInvalid(parsed===null);onValidityChange?.(parsed!==null);if(parsed!==null)onChange(parsed);
 }
 return <div id={inputId} role="group" aria-invalid={invalid||undefined} dir="rtl" className="persian-date-input" aria-label={props['aria-label']} aria-labelledby={props['aria-label']?undefined:id?id+'-label':undefined}>
  <div className="persian-date-parts">
   <label>سال<select aria-label="سال" disabled={disabled} required={required||invalid} value={selected.year} onChange={e=>change('year',e.target.value)}>
    <option value="">سال</option>{range.max<9999&&<option value="newer">نمایش سال‌های بعدتر</option>}
    {years.map(y=><option value={String(y).padStart(4,'0')} key={y}>{toPersianDigits(String(y))}</option>)}
    {range.min>1&&<option value="older">نمایش سال‌های قبل‌تر</option>}
   </select></label>
   <label>ماه<select aria-label="ماه" disabled={disabled} required={required||invalid} value={selected.month} onChange={e=>change('month',e.target.value)}>
    <option value="">ماه</option>{months.map((m,i)=><option key={m} value={String(i+1).padStart(2,'0')}>{m}</option>)}
   </select></label>
   <label>روز<select aria-label="روز" disabled={disabled||!maxDay} required={required||invalid} value={selected.day} onChange={e=>change('day',e.target.value)}>
    <option value="">روز</option>{Array.from({length:maxDay},(_,i)=><option key={i} value={String(i+1).padStart(2,'0')}>{toPersianDigits(String(i+1).padStart(2,'0'))}</option>)}
   </select></label>
  </div>
  {!required&&<button type="button" className="secondary date-clear" disabled={disabled} onClick={()=>{setSelected(parts(''));setInvalid(false);onValidityChange?.(true);onChange('');}}>پاک کردن تاریخ</button>}
  {invalid&&<small role="status">روز، ماه و سال معتبر را کامل انتخاب کنید.</small>}
 </div>;
}
