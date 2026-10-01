import {useEffect,useState,type ReactNode} from 'react';
import {Link,Navigate,useLocation,useParams} from 'react-router-dom';
import {api} from '../api/client';
export function LegacyAssessmentGate({domain,children}:{domain:string;children:ReactNode}){
 const {id}=useParams(),location=useLocation(),[adopted,setAdopted]=useState<boolean|null>(null);
 useEffect(()=>{setAdopted(null);void api<any>('/shared/families/'+id+'/comprehensive').then(d=>setAdopted(!!d.draft||d.versions.length>0)).catch(()=>setAdopted(false));},[id]);
 if(adopted===null)return <p role="status">در حال دریافت ارزیابی…</p>;
 const to='/workspace/families/'+id+'/assessment/'+domain;
 if(adopted&&!new URLSearchParams(location.search).has('legacy'))return <Navigate to={to} replace/>;
 return <><p className="panel"><Link to={to}>ورود به ارزیابی جامع پنج حوزه</Link>{adopted&&' · اطلاعات زیر مرجع تاریخی است؛ اصلاح و تصمیم در ارزیابی جامع انجام می‌شود.'}</p>{children}</>;
}
