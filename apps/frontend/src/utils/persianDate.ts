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

export const toPersianDigits=(value:string)=>value.replace(/[0-9٠-٩]/g,c=>'۰۱۲۳۴۵۶۷۸۹'['٠١٢٣٤٥٦٧٨٩'.includes(c)?'٠١٢٣٤٥٦٧٨٩'.indexOf(c):Number(c)]);
const numericCalendar=new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn',{
 timeZone:'UTC',year:'numeric',month:'numeric',day:'numeric',
});
function calendarKey(day:number){
 const p=Object.fromEntries(numericCalendar.formatToParts(new Date(day*86400000)).map(x=>[x.type,x.value]));
 return Number(p.year)*10000+Number(p.month)*100+Number(p.day);
}
// Invert the same Intl Persian calendar by searching civil days; round-trip
// equality rejects overflow days and non-leap Esfand 30 without a second calendar.
export function parsePersianDate(value:string):string|null{
 const text=value.trim().replace(/[۰-۹٠-٩]/g,c=>String('۰۱۲۳۴۵۶۷۸۹'.includes(c)?'۰۱۲۳۴۵۶۷۸۹'.indexOf(c):'٠١٢٣٤٥٦٧٨٩'.indexOf(c)));
 if(!text)return '';
 const match=/^(\d{4})\/(\d{2})\/(\d{2})$/.exec(text);
 if(!match)return null;
 const [,y,m,d]=match,year=Number(y),month=Number(m),day=Number(d);
 if(year<1||month<1||month>12||day<1||day>31)return null;
 const target=year*10000+month*100+day;
 let low=Math.floor(Date.UTC(year+620,0,1)/86400000),high=Math.floor(Date.UTC(year+623,0,1)/86400000);
 while(low<=high){
  const middle=Math.floor((low+high)/2),key=calendarKey(middle);
  if(key===target){const iso=new Date(middle*86400000).toISOString().slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(iso)?iso:null;}
  if(key<target)low=middle+1;else high=middle-1;
 }
 return null;
}
export function persianMonthLength(year:number,month:number):number{
 if(!Number.isInteger(year)||!Number.isInteger(month)||year<1||month<1||month>12)return 0;
 for(const day of [31,30,29])if(parsePersianDate(String(year).padStart(4,'0')+'/'+String(month).padStart(2,'0')+'/'+day)!==null)return day;
 return 0;
}

/** Completed Persian-calendar years; no fallback to a stored manual age. */
export function ageFromBirthDate(birth:unknown,asOf:unknown=new Date()):string|null{
 if(!birth)return null;
 const split=(v:unknown)=>formatPersianDate(v).replace(/[۰-۹]/g,c=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).split('/').map(Number);
 const b=split(birth),now=split(asOf);
 if(b.length!==3||now.length!==3||[...b,...now].some(x=>!Number.isFinite(x)))return null;
 const age=now[0]-b[0]-(now[1]<b[1]||now[1]===b[1]&&now[2]<b[2]?1:0);
 return age<0?null:toPersianDigits(String(age))+' سال';
}
