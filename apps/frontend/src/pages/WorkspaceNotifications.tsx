import {useState} from 'react';
import {Link} from 'react-router-dom';
import {useAuth} from '../auth/AuthProvider';
import {api} from '../api/client';
import {Screen,useData,date,fa} from './GuideWorkspace';
import {digits} from './vocabulary';
type Row=Record<string,any>;
function notificationLink(n:Row,role:string){
 const guide=role==='SUPREME_GUIDE',cases=['SUPREME_GUIDE','EXECUTIVE_MANAGER','GROUP_LEADER','HELPER'].includes(role);
 if(n.link_type==='FAMILY'&&cases&&n.link_id)return (guide?'/guide':'/workspace')+'/families/'+n.link_id+(guide?'':'?returnTo='+encodeURIComponent(role==='GROUP_LEADER'?'/workspace':'/workspace/groups'));
 if(n.link_type==='GROUP'&&cases&&n.link_id)return role==='GROUP_LEADER'?'/leader/families':(guide?'/guide':'/workspace')+'/groups/'+n.link_id;
 if(guide&&n.link_id&&['COUNCIL','PERSON'].includes(n.link_type))return '/guide/'+(n.link_type==='COUNCIL'?'council-decisions':'people')+'/'+n.link_id;
 if(n.item_id)return '/workspace/items/'+n.item_id;
 return null;
}
export function NotificationsPage(){const {user}=useAuth(),{data,error,refresh}=useData('/workspace/notifications'),[unread,setUnread]=useState(false),[busy,setBusy]=useState(''),[actionError,setActionError]=useState('');const rows:Row[]=data?.notifications??[];
 async function seen(id:string){setBusy(id);setActionError('');try{await api('/workspace/notifications/'+id+'/seen',{method:'POST'});refresh();window.dispatchEvent(new Event('lahout-notifications-changed'));}catch(e){setActionError((e as Error).message);}finally{setBusy('');}}
 return <Screen title="اعلان‌ها" error={error||actionError} loading={!data&&!error}><div className="notification-tabs"><button className="secondary" aria-pressed={!unread} onClick={()=>setUnread(false)}>همه اعلان‌ها ({digits(rows.length)})</button><button className="secondary" aria-pressed={unread} onClick={()=>setUnread(true)}>خوانده‌نشده ({digits(rows.filter(n=>!n.seen_at).length)})</button></div>{rows.filter(n=>!unread||!n.seen_at).map(n=>{const link=notificationLink(n,user?.effectiveRole??'');return <article className={'data-row '+(n.seen_at?'notification-read':'notification-unread unread')} key={n.id}><div><strong>{n.message}</strong><small>{fa(n.category)} · {fa(n.visibility)} · {date(n.created_at)}</small><small>{n.seen_at?'خوانده‌شده · '+date(n.seen_at):'خوانده‌نشده'}</small></div>{link&&<Link to={link}>مشاهده مورد</Link>}{!n.seen_at&&<button className="secondary" disabled={!!busy} onClick={()=>void seen(n.id)}>خواندم</button>}</article>;})}{data&&!rows.some(n=>!unread||!n.seen_at)&&<p className="quiet-state">{unread?'اعلان خوانده‌نشده‌ای ندارید.':'اعلانی ثبت نشده است.'}</p>}</Screen>;
}
