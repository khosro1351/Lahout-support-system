import {useEffect,useState} from 'react';
import {PersianDateInput} from './PersianDateInput';
import {toPersianDigits} from '../utils/persianDate';
/** Keep the existing local datetime contract; the form still converts it to ISO. */
export function PersianDateTimeInput({value,onChange,id}:{value:string;onChange:(value:string)=>void;id?:string}){
 const parts=(v:string)=>[v.slice(0,10),v.slice(11,13),v.slice(14,16)];
 const [selected,setSelected]=useState(()=>parts(value));
 useEffect(()=>setSelected(parts(value)),[value]);
 const required=selected.some(Boolean);
 function change(index:number,v:string){
  if(index===0&&!v){setSelected(['','','']);onChange('');return;}
  const next=selected.map((x,i)=>i===index?v:x);setSelected(next);
  if(next.every(Boolean))onChange(next[0]+'T'+next[1]+':'+next[2]);
 }
 return <div id={id} role="group" aria-labelledby={id?id+'-label':undefined} dir="rtl">
 <PersianDateInput value={selected[0]} onChange={v=>change(0,v)} required={required} aria-label="تاریخ مهلت"/>
 <div className="persian-date-parts">{[['ساعت',24],['دقیقه',60]].map(([label,count],i)=><label key={label}>{label}<select aria-label={String(label)} required={required} value={selected[i+1]} onChange={e=>change(i+1,e.target.value)}><option value="">انتخاب</option>{Array.from({length:Number(count)},(_,n)=><option key={n} value={String(n).padStart(2,'0')}>{toPersianDigits(String(n).padStart(2,'0'))}</option>)}</select></label>)}</div>
 <button type="button" className="secondary date-clear" onClick={()=>{setSelected(['','','']);onChange('');}}>پاک کردن مهلت</button>
 </div>;
}
