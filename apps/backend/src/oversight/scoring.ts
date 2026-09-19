/** Pure, versioned scoring. No points are accepted from an assessment submitter. */
export type Model = { domainOrder?:string[]; domains:Record<string,{label:string;weight:number;indicatorOrder?:string[];indicators:Record<string,{label:string;max:number;responses:Record<string,{label:string;points:number}>}>}>; thresholds:{level:string;min:number}[]; criticalRules:{code:string;domain:string;label:string;severity:string;memberBased?:boolean}[]; responseTableApproved:boolean };
export type DomainInput = {applicable?:boolean; summaries?:Record<string,string>; facts?:Record<string,unknown>; evidence?:unknown[]; critical?:Record<string,boolean|null>; members?:{id:string;status?:string;eligible?:boolean;details?:Record<string,unknown>}[]};
export const domainBlueprint={
 livelihood:{label:'معیشت و اقتصاد',weight:30,indicators:{adequacy:{label:'کفایت درآمد برای نیازهای پایه',max:15},stability:{label:'ثبات درآمد',max:6},essential_costs:{label:'فشار هزینه‌های ضروری',max:5},debt:{label:'بدهی و تعهدات مؤثر',max:4}}},
 health:{label:'سلامت',weight:20,indicators:{impact:{label:'اثر سلامت بر زندگی خانواده',max:8},unmet_treatment:{label:'درمان و داروی تأمین‌نشده',max:5},cost:{label:'فشار مالی درمان',max:4},care:{label:'بار مراقبتی',max:3}}},
 housing:{label:'مسکن',weight:20,indicators:{stability:{label:'پایداری سکونت',max:7},quality:{label:'کیفیت و تناسب محل',max:8},cost:{label:'فشار مالی مسکن',max:5}}},
 vulnerability:{label:'آسیب‌پذیری ویژه',weight:15,indicators:{dependency:{label:'وابستگی و نیاز به حمایت ویژه',max:6},network:{label:'شبکه حمایت خانوادگی و اجتماعی',max:4},crisis:{label:'بحران‌ها و شرایط تشدیدکننده',max:5}}},
 education:{label:'آموزش',weight:15,indicators:{current:{label:'وضعیت فعلی و استمرار تحصیل',max:6},barriers:{label:'موانع و نیازهای آموزشی',max:5},future_risk:{label:'خطر آینده ترک تحصیل',max:4}}}
};
export const criticalRules:Model['criticalRules']=[
 ['HEALTH_MEDICINE','health','داروی حیاتی یا ضروری تأمین نشده','CRITICAL'],['HEALTH_URGENT','health','درمان فوری انجام نشده','CRITICAL'],['HEALTH_CARE','health','فرد وابسته بدون مراقبت ضروری','CRITICAL'],
 ['HOUSING_UNSAFE_HOME','housing','فاقد محل امن سکونت','CRITICAL'],['HOUSING_EVICTION','housing','تخلیه قریب‌الوقوع','CRITICAL'],['HOUSING_DANGER','housing','ناایمنی جدی محل','CRITICAL'],
 ['VULNERABILITY_CHILD','vulnerability','کودک بدون مراقبت مؤثر','CRITICAL'],['VULNERABILITY_VIOLENCE','vulnerability','خشونت فعال یا بحران فوری','CRITICAL'],
 ['EDUCATION_RISK','education','خطر نزدیک ترک تحصیل به دلیل فقر یا کار','VERY_IMPORTANT'],['EDUCATION_EXCLUDED','education','محرومیت کامل از تحصیل','VERY_IMPORTANT'],['LIVELIHOOD_BASIC','livelihood','فقدان فوری خوراک یا نیاز پایه حیاتی','CRITICAL']
].map(([code,domain,label,severity])=>({code,domain,label,severity}));
export function draftDefinition():Model{return {domainOrder:Object.keys(domainBlueprint),domains:Object.fromEntries(Object.entries(domainBlueprint).map(([k,d])=>[k,{...d,indicatorOrder:Object.keys(d.indicators),indicators:Object.fromEntries(Object.entries(d.indicators).map(([i,x])=>[i,{...x,responses:{NO_PROBLEM:{label:'بدون مشکل مؤثر',points:0}}}]))}])),thresholds:[{level:'A',min:75},{level:'B',min:55},{level:'C',min:30},{level:'D',min:0}],criticalRules,responseTableApproved:false};}
export function validateModel(model:Model){
 if(!model.responseTableApproved)throw new Error('جدول امتیاز پاسخ‌ها هنوز مصوب نیست.');
 if(Object.keys(model.domains).length!==5)throw new Error('پنج حوزه ارزیابی الزامی است.');
 for(const [key,b] of Object.entries(domainBlueprint)){const d=model.domains[key];if(!d||d.weight!==b.weight)throw new Error('وزن حوزه با مدل مصوب سازگار نیست.');let sum=0;for(const [i,indicator] of Object.entries(b.indicators)){const x=d.indicators[i];if(!x||x.max!==indicator.max||!Object.keys(x.responses).length)throw new Error('تعریف شاخص ناقص است.');for(const p of Object.values(x.responses))if(!Number.isFinite(p.points)||p.points<0||p.points>x.max)throw new Error('امتیاز پاسخ خارج از دامنه است.');sum+=x.max;}if(sum!==d.weight)throw new Error('وزن شاخص‌ها ناسازگار است.');}
 const thresholds=[...model.thresholds].sort((a,b)=>b.min-a.min);if(thresholds.length!==4||new Set(thresholds.map(t=>t.level)).size!==4||thresholds.some(t=>!['A','B','C','D'].includes(t.level)||!Number.isFinite(t.min)||t.min<0||t.min>100)||thresholds.at(-1)?.min!==0)throw new Error('آستانه‌های سطح نیاز معتبر نیستند.');
}
export function evaluate(model:Model,answers:Record<string,DomainInput>,memberIds:string[]){
 validateModel(model);let total=0,denominator=0;const missing:string[]=[],domains:Record<string,unknown>={},flags:{code:string;domain:string;label:string;severity:string;memberId?:string}[]=[];
 for(const [key,d] of Object.entries(model.domains)){
 const a=answers[key];if(!a){missing.push(d.label);domains[key]={label:d.label,state:'UNKNOWN',score:null,weight:d.weight};denominator+=d.weight;continue;}
 let na=false,healthy=false;const members=a.members??[];
 if(['health','education','vulnerability'].includes(key)){
 if(memberIds.some(id=>!members.some(m=>m.id===id))||members.some(m=>!memberIds.includes(m.id))||new Set(members.map(m=>m.id)).size!==members.length)missing.push(d.label+'؛ غربالگری تمام اعضا');
 if(key==='education'){na=members.length===memberIds.length&&members.length>0&&members.every(m=>m.eligible===false);if(members.some(m=>typeof m.eligible!=='boolean'))missing.push('مشمولیت تحصیل نامشخص');}
 if(key==='vulnerability'&&members.some(m=>!['NO_PROBLEM','AFFECTED'].includes(m.status??'')))missing.push('غربالگری وضعیت ویژه ناقص');
 if(key==='health'){healthy=members.length===memberIds.length&&members.length>0&&members.every(m=>m.status==='NO_PROBLEM');if(members.some(m=>!['NO_PROBLEM','AFFECTED'].includes(m.status??'')))missing.push('غربالگری سلامت ناقص');if(members.some(m=>m.status==='AFFECTED'&&!m.details))missing.push('جزئیات سلامت عضو ثبت نشده');}
 }
 if(a.applicable===false&&!na)missing.push(d.label+'؛ دلیل غیرقابل‌اعمال معتبر نیست');
 if(na){domains[key]={label:d.label,state:'NOT_APPLICABLE',score:null,weight:d.weight,breakdown:[]};continue;}
 denominator+=d.weight;let points=0,complete=true;const breakdown=[];
 for(const [i,x] of Object.entries(d.indicators).sort(([a],[b])=>(d.indicatorOrder?.indexOf(a)??0)-(d.indicatorOrder?.indexOf(b)??0))){
 const selection=healthy?'NO_PROBLEM':a.summaries?.[i];const response=selection?x.responses[selection]:undefined;
 // Education's future-risk score cannot repeat an already-current dropout.
 const effective=key==='education'&&i==='future_risk'&&members.filter(m=>m.eligible===true).length>0&&members.filter(m=>m.eligible===true).every(m=>m.details?.studyStatus==='ترک تحصیل'||m.details?.futureRisk==='ترک تحصیل فعلی')?x.responses.NO_PROBLEM:response;
 if(!effective){missing.push(d.label+'؛ '+x.label);complete=false;}
 else points+=effective.points;
 breakdown.push({label:x.label,selection:effective?.label??'نامشخص',points:effective?.points??null,max:x.max});
 }
 for(const rule of model.criticalRules.filter(r=>r.domain===key)){
 const detected=a.critical?.[rule.code];if(detected===true)flags.push(rule);else if(detected!==false){missing.push(rule.label+'؛ پاسخ الزامی نامشخص');complete=false;}
 }
 if(key==='vulnerability'&&a.facts?.sameImpactAsHealth===true){missing.push('تفکیک اثر آسیب‌پذیری از سلامت لازم است');complete=false;}
 total+=points;domains[key]={label:d.label,state:complete?'COMPLETE':'INCOMPLETE',score:complete?points:null,weight:d.weight,breakdown};
 }
 const complete=missing.length===0&&denominator>0,score=complete?Number((total/denominator*100).toFixed(8)):null;
 return {state:complete?'FINAL':'PROVISIONAL',score,level:score===null?null:[...model.thresholds].sort((a,b)=>b.min-a.min).find(t=>score>=t.min)?.level??null,applicableWeight:denominator,domains,criticalFlags:flags,missing:[...new Set(missing)]};
}
// Approved response table supplied by the user; codes are stable within model 1.0.
const responseTable:Record<string,Record<string,[string,number][]>>={
 livelihood:{adequacy:[['کافی',0],['نسبتاً کافی',5],['ناکافی',10],['به‌شدت ناکافی / ناتوانی در تأمین نیازهای پایه',15]],stability:[['باثبات',0],['نسبتاً باثبات',2],['ناپایدار',4],['فاقد درآمد ثابت',6]],essential_costs:[['بدون فشار غیرعادی',0],['فشار محدود',1],['فشار محسوس',3],['فشار شدید بر چند نیاز ضروری',5]],debt:[['ندارد / بی‌اثر',0],['قابل مدیریت',1],['مؤثر بر معیشت',2],['تهدیدکننده تأمین نیازهای پایه',4]]},
 health:{impact:[['بدون اثر مؤثر',0],['اثر محدود',2],['اثر محسوس',4],['اثر شدید',6],['اثر بسیار شدید / وابستگی جدی',8]],unmet_treatment:[['نیاز ضروری تأمین‌نشده وجود ندارد',0],['نیاز محدود',1],['بخشی از درمان یا دارو تأمین نشده یا چند نیاز محدود وجود دارد',3],['درمان یا داروی ضروری عملاً تأمین نشده',5]],cost:[['بدون فشار مؤثر',0],['محسوس ولی قابل مدیریت',1],['فشار جدی بر بودجه',2],['مختل‌کننده سایر نیازهای ضروری',4]],care:[['ندارد',0],['محدود / دوره‌ای',1],['مستمر و مصرف‌کننده بخشی از ظرفیت خانواده',2],['سنگین / دائمی و مختل‌کننده زندگی یا کار',3]]},
 housing:{stability:[['پایدار و بدون نگرانی',0],['فعلاً پایدار ولی همراه با نگرانی',2],['ناپایدار و احتمال جابه‌جایی',4],['در معرض تخلیه یا از دست دادن محل',6],['فاقد محل سکونت پایدار',7]],quality:[['مناسب و متناسب',0],['کاستی محدود ولی قابل قبول',2],['مشکلات محسوس در کیفیت یا فضا',4],['نامناسب و مؤثر بر زندگی',6],['بسیار نامناسب / ناایمن / شدیداً نامتناسب',8]],cost:[['فشار قابل توجه ندارد',0],['محدود و قابل مدیریت',1],['محسوس بر بودجه',3],['شدید و مختل‌کننده نیازهای ضروری',5]]},
 vulnerability:{dependency:[['وابستگی مؤثر وجود ندارد',0],['محدود و قابل مدیریت',2],['محسوس و نیازمند حمایت منظم',4],['شدید و مصرف‌کننده بخش عمده ظرفیت خانواده',6]],network:[['مؤثر و قابل اتکا',0],['محدود ولی موجود',1],['ضعیف / غیرقابل اتکا',2],['تقریباً فاقد حمایت مؤثر',4]],crisis:[['بحران فعال مؤثر وجود ندارد',0],['محدود / کنترل‌شده',1],['بحران محسوس و اثرگذار',3],['شدید یا چند بحران هم‌زمان',5]]},
 education:{current:[['وضعیت عادی و استمرار مناسب',0],['مشکل محدود',2],['اختلال محسوس در استمرار تحصیل',4],['ترک تحصیل یا اختلال شدید فعلی',6]],barriers:[['بدون مانع مؤثر',0],['نیاز محدود',1],['یک مانع مؤثر یا چند نیاز آموزشی',3],['موانع جدی و مختل‌کننده تحصیل',5]],future_risk:[['خطر وجود ندارد',0],['خطر محدود',1],['خطر محسوس',2],['خطر جدی و نزدیک',4]]}
};
export function approvedDefinition():Model{
 const model=draftDefinition();model.responseTableApproved=true;
 for(const [domain,indicators] of Object.entries(responseTable))for(const [key,options] of Object.entries(indicators))model.domains[domain].indicators[key].responses=Object.fromEntries(options.map(([label,points],i)=>[i===0?'NO_PROBLEM':'OPTION_'+i,{label,points}]));
 model.criticalRules.push(...[
 ['HOUSING_SERVICES','housing','فقدان طولانی خدمات حیاتی','CRITICAL'],['HOUSING_DEPENDENT','housing','خطر فوری محل برای کودک، سالمند یا فرد دارای محدودیت','CRITICAL'],
 ['VULNERABILITY_CARE','vulnerability','فرد کاملاً وابسته بدون مراقب','CRITICAL'],['VULNERABILITY_CRISIS','vulnerability','بحران شدید و فوری خانوادگی','CRITICAL'],['VULNERABILITY_HOME','vulnerability','خطر بی‌خانمانی فوری','CRITICAL'],
 ['EDUCATION_CHILD_LABOUR','education','کودک کار با اثر مستقیم بر تحصیل','VERY_IMPORTANT'],['EDUCATION_STOPPED','education','وضعیت متوقف‌کننده ادامه تحصیل','VERY_IMPORTANT']
 ].map(([code,domain,label,severity])=>({code,domain,label,severity})));
 return model;
}
