import {Link,useLocation} from 'react-router-dom';
import type {ReactNode} from 'react';

export function AssessmentDomainTabs({familyId,badges={}}:{familyId:string;badges?:Partial<Record<'livelihood'|'health',ReactNode>>}){
 const {pathname}=useLocation();
 const active=pathname.startsWith('/workspace/health/')?'health':'livelihood';
 return <nav className="subnav" dir="rtl" aria-label="حوزه‌های ارزیابی">{([
  ['livelihood','معیشت و اقتصاد'],['health','سلامت و درمان'],
 ] as const).map(([domain,label])=><Link key={domain} to={'/workspace/'+domain+'/'+familyId} className={active===domain?'badge-info':undefined} aria-current={active===domain?'page':undefined}>{label}{badges[domain]&&<small className="badge-info">{badges[domain]}</small>}</Link>)}</nav>;
}
