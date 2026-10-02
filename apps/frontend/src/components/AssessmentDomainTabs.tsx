import {NavLink} from 'react-router-dom';
import type {ReactNode} from 'react';
export function AssessmentDomainTabs({familyId,badges={}}:{familyId:string;badges?:Partial<Record<'livelihood'|'health',ReactNode>>}){
 return <nav className="subnav domain-tabs family-navigation" dir="rtl" aria-label="حوزه‌های ارزیابی">
 <NavLink end to={'/workspace/families/'+familyId}>اطلاعات پایه</NavLink>
 {(['livelihood','health'] as const).map(domain=><NavLink key={domain} to={'/workspace/families/'+familyId+'/assessment/'+domain}>{domain==='livelihood'?'معیشت و اقتصاد':'سلامت و درمان'}{badges[domain]&&<small>{badges[domain]}</small>}</NavLink>)}
 {Object.entries({housing:'مسکن',vulnerability:'آسیب‌پذیری ویژه',education:'آموزش',review:'مرور جامع'}).map(([domain,label])=><NavLink key={domain} to={'/workspace/families/'+familyId+'/assessment/'+domain}>{label}</NavLink>)}
 </nav>;
}
