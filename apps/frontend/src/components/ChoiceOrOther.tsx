import {useEffect,useState} from 'react';
/** Suggested vocabulary only: custom and legacy text round-trip unchanged. */
export function ChoiceOrOther({value,onChange,options,label,maxLength=2000}:{value:string;onChange:(value:string)=>void;options:readonly string[];label:string;maxLength?:number}){
 const [other,setOther]=useState(!!value&&!options.includes(value));
 useEffect(()=>{if(value&&options.includes(value))setOther(false);else if(value)setOther(true);},[value,options]);
 return <span className="choice-other"><select aria-label={label} value={other?'__other':value} onChange={e=>{const custom=e.target.value==='__other';setOther(custom);onChange(custom?'':e.target.value);}}><option value="">انتخاب کنید</option>{options.map(v=><option key={v} value={v}>{v}</option>)}<option value="__other">سایر</option></select>{other&&<input aria-label={'توضیح سایر — '+label} maxLength={maxLength} value={value} placeholder="توضیح خود را وارد کنید" onChange={e=>onChange(e.target.value)}/>}</span>;
}
