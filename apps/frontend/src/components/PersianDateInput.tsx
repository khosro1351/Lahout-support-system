import {useEffect,useId,useRef,useState,type InputHTMLAttributes} from 'react';
import {formatPersianDate,parsePersianDate,toPersianDigits} from '../utils/persianDate';

type Props=Omit<InputHTMLAttributes<HTMLInputElement>,'value'|'onChange'|'type'> & {
 value:string;onChange:(value:string)=>void;onValidityChange?:(valid:boolean)=>void;
};
export function PersianDateInput({value,onChange,onValidityChange,id,...props}:Props){
 const generated=useId(),inputId=id??generated,ref=useRef<HTMLInputElement>(null);
 const [text,setText]=useState(value?formatPersianDate(value):'');
 const [invalid,setInvalid]=useState(false);
 useEffect(()=>{setText(value?formatPersianDate(value):'');setInvalid(false);ref.current?.setCustomValidity('');onValidityChange?.(true);},[value]);
 useEffect(()=>()=>onValidityChange?.(true),[]);
 return <span dir="rtl"><input ref={ref} {...props} id={inputId} type="text" inputMode="numeric" dir="ltr"
  style={{textAlign:'right'}} placeholder="۱۴۰۵/۰۷/۰۴" value={text} maxLength={10}
  aria-invalid={invalid} aria-describedby={invalid?inputId+'-error':props['aria-describedby']}
  onChange={e=>{
   const next=toPersianDigits(e.target.value),parsed=parsePersianDate(next);
   setText(next);setInvalid(parsed===null);onValidityChange?.(parsed!==null);
   e.target.setCustomValidity(parsed===null?'تاریخ شمسی معتبر با قالب سال/ماه/روز وارد کنید.':'');
   if(parsed!==null)onChange(parsed);
  }}/>
  {invalid&&<small id={inputId+'-error'} role="alert">تاریخ شمسی معتبر با قالب سال/ماه/روز وارد کنید.</small>}
 </span>;
}
