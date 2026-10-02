import type {ReactNode} from 'react';
import {Link,Navigate,useLocation,useParams} from 'react-router-dom';
export function LegacyAssessmentGate({domain,children}:{domain:string;children:ReactNode}){
 const {id}=useParams(),location=useLocation(),adopted=true;
 const version=new URLSearchParams(location.search).get('version');
 const to='/workspace/families/'+id+'/assessment/'+domain+(version?'?version='+encodeURIComponent(version):'')+location.hash;
 if(adopted&&!new URLSearchParams(location.search).has('legacy'))return <Navigate to={to} replace/>;
 return <><p className="panel"><Link to={to}>ورود به ارزیابی جامع پنج حوزه</Link>{adopted&&' · اطلاعات زیر مرجع تاریخی است؛ اصلاح و تصمیم در ارزیابی جامع انجام می‌شود.'}</p>{children}</>;
}
