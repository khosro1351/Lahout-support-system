export const brandName='کانون مهربانی همیاران لاهوت';
export const roleLabels:Record<string,string>={SUPREME_GUIDE:'همیار شاهد',EXECUTIVE_MANAGER:'مدیر اجرایی',GROUP_LEADER:'سرگروه',HELPER:'همیار گروه',COUNCIL_MEMBER:'عضو شورای کانون',TECH_ADMIN:'پشتیبان فنی سامانه'};
export const roleHomes:Record<string,string>={SUPREME_GUIDE:'/guide',EXECUTIVE_MANAGER:'/executive',GROUP_LEADER:'/leader',HELPER:'/helper',COUNCIL_MEMBER:'/council',TECH_ADMIN:'/technical'};
export const displayName=(name:string|undefined)=>name?.includes('راهبر عالی')?'حساب همیار شاهد':name??'کاربر سامانه';
export function logicalParent(path:string,role:string){
 const home=roleHomes[role]??'/select-role';
 if(/^\/executive\/assessments\/[^/]+$/.test(path))return '/executive/assessments';
 if(path.startsWith('/technical/'))return home;
 if(/^\/workspace\/livelihood\/[^/]+$/.test(path))return '/workspace/livelihood';
 if(/^\/workspace\/families\/[^/]+\/assessments$/.test(path))return path.replace(/\/assessments$/,'');
 if(/^\/workspace\/families\/[^/]+$/.test(path))return role==='GROUP_LEADER'?'/leader/families':role==='SUPREME_GUIDE'?'/guide/families':'/workspace/groups';
 if(/^\/workspace\/groups\/[^/]+$/.test(path))return '/workspace/groups';
 if(/^\/workspace\/items\/[^/]+$/.test(path))return '/workspace';
 if(role==='SUPREME_GUIDE'){
  if(/^\/guide\/groups\/[^/]+\/(manage|attention)$/.test(path))return '/guide/groups';
  for(const list of ['people','groups','council-decisions','access-requests'])if(path.startsWith('/guide/'+list+'/'))return '/guide/'+list;
 }
 return home;
}
