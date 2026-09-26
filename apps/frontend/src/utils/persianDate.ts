// UI formatting only; stored dates remain unchanged.
const formatter=new Intl.DateTimeFormat('fa-IR-u-ca-persian-nu-arabext',{
 timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit',
 hour:'2-digit',minute:'2-digit',hourCycle:'h23',
});
export function formatPersianDate(value:unknown,withTime=false):string{
 if(value===null||value===undefined||value==='')return '—';
 const parsed=value instanceof Date?value:new Date(String(value));
 if(Number.isNaN(parsed.getTime()))return '—';
 const parts=Object.fromEntries(formatter.formatToParts(parsed).map(p=>[p.type,p.value]));
 const date=parts.year+'/'+parts.month+'/'+parts.day;
 return withTime?date+' - '+parts.hour+':'+parts.minute:date;
}
export const formatPersianDateTime=(value:unknown)=>formatPersianDate(value,true);
