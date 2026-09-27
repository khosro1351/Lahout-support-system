import {useEffect,useState} from 'react';
import {api} from '../api/client';
import {Field,useData} from '../pages/GuideWorkspace';
import {digits} from '../pages/vocabulary';
import {PersianDate} from './PersianDate';
import {PersianDateInput} from './PersianDateInput';
type Row=Record<string,any>;
const relations:Row={HEAD:'سرپرست',SPOUSE:'همسر',CHILD:'فرزند',PARENT:'والد',SIBLING:'خواهر/برادر',OTHER:'سایر'};
export function FamilyBaseView({family,members}:{family:Row;members:Row[]}){return <div className="family-base-view">
 <h2>اطلاعات پایه خانواده</h2><div className="family-summary">
 {Object.entries({neighborhood:'محله / محدوده سکونت',residenceType:'نوع سکونت فعلی',source:'منبع اطلاعات اولیه'}).map(([k,l])=><p key={k}><small>{l}</small>{family[k]||'ثبت نشده'}</p>)}
 <p><small>تاریخ تشکیل/انتقال پرونده</small><PersianDate value={family.formedOn}/></p></div>
 <h2>اعضای خانواده</h2>{members.map((m,i)=><section className="panel" key={m.id??i}><h3>{m.first_name} {m.last_name}</h3><div className="family-summary">
 <p><small>نسبت</small>{relations[m.relationship_code]??m.relationship_code}</p>
 <p><small>تاریخ تولد</small><PersianDate value={m.birth_date}/></p><p><small>شماره تماس</small><bdi>{m.mobile||'ثبت نشده'}</bdi></p><p><small>شناسه ملی</small><bdi>{m.national_id||'ثبت نشده'}</bdi></p>
 {Object.entries({age:'سن (اگر تاریخ تولد مشخص نیست)',education:'وضعیت تحصیل',health:'وضعیت جسمی مختصر',notes:'توضیح'}).map(([k,l])=><p key={k}><small>{l}</small>{m.profile_data?.[k]??'ثبت نشده'}</p>)}
 </div></section>)}</div>;}
export function FamilyBase({familyId,onSaved}:{familyId:string;onSaved:()=>void}){
 const {data:loaded,error,refresh}=useData('/family-workspace/families/'+familyId);
 const [saved,setSaved]=useState<Row|null>(null),data=saved??loaded;
 const [editing,setEditing]=useState(false),[basic,setBasic]=useState<Row>({}),[members,setMembers]=useState<Row[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[invalidDates,setInvalidDates]=useState<Record<string,boolean>>({});
 const dateValidity=(key:string,valid:boolean)=>setInvalidDates(v=>v[key]===!valid?v:{...v,[key]:!valid});
 useEffect(()=>{setEditing(false);setMessage('');setSaved(null);},[familyId]);
 function reset(){if(!data)return;setBasic({...data.family});setMembers(structuredClone(data.members));setInvalidDates({});setMessage('');}
 async function save(){if(!data)return;setBusy(true);setMessage('');try{const next=await api<Row>('/family-workspace/families/'+familyId,{method:'POST',body:JSON.stringify({version:data.family.version,family:basic,members})});setSaved(next);setEditing(false);setMessage('تغییرات پرونده ذخیره شد.');refresh();onSaved();}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
 return <section className="panel family-base" aria-label="اطلاعات جاری پرونده">{error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}{data&&<>
 {!editing?<><p className="quiet-state">حالت مشاهده پرونده · اطلاعات جاری خانواده و اعضا</p><FamilyBaseView family={data.family} members={data.members}/>{data.canEdit&&<button onClick={()=>{reset();setEditing(true);}}>ویرایش اطلاعات پرونده</button>}</>:<>
 <div className="family-edit-banner" role="status">حالت ویرایش پرونده</div>
 <><section className="panel"><h2>اطلاعات پایه خانواده</h2><fieldset disabled={busy}><div className="filter-grid">{[['neighborhood','محله / محدوده سکونت'],['residenceType','نوع سکونت فعلی'],['formedOn','تاریخ تشکیل/انتقال پرونده'],['source','منبع اطلاعات اولیه']].map(([key,label])=><Field key={key} label={label}>{key==='formedOn'?<PersianDateInput value={basic[key]??''} onChange={value=>setBasic(v=>({...v,[key]:value}))} onValidityChange={valid=>dateValidity(key,valid)}/>:<input value={basic[key]??''} onChange={e=>setBasic(v=>({...v,[key]:e.target.value}))}/>}</Field>)}</div></fieldset><p>گروه: {basic.groupName} · تعداد اعضا: {digits(members.length)}</p></section><section className="panel"><h2>اعضای خانواده</h2>{members.map((m:Row,i:number)=><fieldset key={m.id??i} className="lv-row" disabled={busy}><legend>عضو {digits(i+1)}</legend><div className="filter-grid">{[['first_name','نام'],['last_name','نام خانوادگی'],['national_id','شناسه ملی'],['mobile','شماره تماس'],['birth_date','تاریخ تولد']].map(([key,label])=><Field label={label+' عضو '+digits(i+1)} key={key}>{key==='birth_date'?<PersianDateInput value={m[key]?.slice(0,10)??''} onChange={value=>setMembers(v=>v.map((x,j)=>j===i?{...x,[key]:value}:x))} onValidityChange={valid=>dateValidity('birth-'+i,valid)}/>:<input value={m[key]??''} onChange={e=>setMembers(v=>v.map((x,j)=>j===i?{...x,[key]:e.target.value}:x))}/>}</Field>)}<Field label={'نسبت عضو '+digits(i+1)}><select value={m.relationship_code??''} onChange={e=>setMembers(v=>v.map((x,j)=>j===i?{...x,relationship_code:e.target.value}:x))}>{Object.entries({HEAD:'سرپرست',SPOUSE:'همسر',CHILD:'فرزند',PARENT:'والد',SIBLING:'خواهر/برادر',OTHER:'سایر'}).map(([k,l])=><option value={k} key={k}>{l}</option>)}</select></Field>{[['age','سن (اگر تاریخ تولد معلوم نیست)'],['education','وضعیت تحصیل'],['health','وضعیت سلامت مؤثر'],['notes','توضیح']].map(([key,label])=><Field label={label+' عضو '+digits(i+1)} key={key}><input type={key==='age'?'number':'text'} min={0} max={key==='age'?130:undefined} value={m.profile_data?.[key]??''} onChange={e=>setMembers(v=>v.map((x,j)=>j===i?{...x,profile_data:{...x.profile_data,[key]:key==='age'&&e.target.value!==''?Number(e.target.value):e.target.value}}:x))}/></Field>)}</div></fieldset>)}{<><button className="secondary" disabled={busy} onClick={()=>setMembers(v=>[...v,{first_name:'',last_name:'',relationship_code:'CHILD',profile_data:{}}])}>افزودن عضو</button><button disabled={busy||Object.values(invalidDates).some(Boolean)} onClick={()=>void save()}>ذخیره تغییرات</button></>}</section></>
 <button className="secondary" disabled={busy} onClick={()=>{reset();setEditing(false);}}>انصراف از ویرایش</button>
 </>}
 </>}</section>;
}
