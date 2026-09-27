import {NavLink} from 'react-router-dom';
import type {ReactNode} from 'react';
export function AssessmentDomainTabs({familyId,badges={}}:{familyId:string;badges?:Partial<Record<'livelihood'|'health',ReactNode>>}){
 return <nav className="subnav domain-tabs family-navigation" dir="rtl" aria-label="حوزه‌های ارزیابی">
 <NavLink end to={'/workspace/families/'+familyId}>اطلاعات پایه</NavLink>
 {(['livelihood','health'] as const).map(domain=><NavLink key={domain} to={'/workspace/'+domain+'/'+familyId}>{domain==='livelihood'?'معیشت و اقتصاد':'سلامت و درمان'}{badges[domain]&&<small>{badges[domain]}</small>}</NavLink>)}
 {['مسکن','آسیب‌پذیری ویژه','آموزش'].map(label=><span key={label} aria-disabled="true">{label}<small>در آینده</small></span>)}
 </nav>;
}
