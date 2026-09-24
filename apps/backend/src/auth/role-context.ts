import type {Pool,PoolClient} from 'pg';
import type {AuthUser,RoleAssignment} from './auth.types';
import {AppError} from '../common/app-error';
export const ROLE_LABELS:Record<string,string>={SUPREME_GUIDE:'همیار شاهد',EXECUTIVE_MANAGER:'مدیر اجرایی',GROUP_LEADER:'سرگروه',HELPER:'همیار گروه',COUNCIL_MEMBER:'عضو شورای کانون',TECH_ADMIN:'پشتیبان فنی سامانه'};
export const ROLE_HOME:Record<string,string>={SUPREME_GUIDE:'/guide',EXECUTIVE_MANAGER:'/executive',GROUP_LEADER:'/leader',HELPER:'/helper',COUNCIL_MEMBER:'/council',TECH_ADMIN:'/technical'};
export async function contextFor(db:Pool|PoolClient,account:string,session:string){
 const assignments=(await db.query(`SELECT r.role_code,r.scope_type,r.scope_id FROM identity.role_assignments r JOIN identity.accounts a ON a.id=r.account_id WHERE a.id=$1 AND a.status='ACTIVE' AND r.valid_from<=now() AND (r.valid_to IS NULL OR r.valid_to>now()) ORDER BY r.role_code,r.scope_type,r.scope_id`,[account])).rows;
 const availableRoles:RoleAssignment[]=assignments.map(r=>({roleCode:r.role_code,scopeType:r.scope_type,scopeId:r.scope_id}));
 const s=(await db.query('SELECT selected_role,simulation_role,simulation_group_id FROM identity.auth_sessions WHERE id=$1 AND account_id=$2 AND revoked_at IS NULL AND expires_at>now()',[session,account])).rows[0];
 if(!s)throw new AppError(401,'SESSION_INVALID','نشست شما معتبر نیست.');
 let effectiveRole:string|null=s.selected_role;
 let roles=availableRoles.filter(r=>r.roleCode===effectiveRole);
 if(!roles.length)effectiveRole=null;
 let simulation=false;
 if(s.simulation_role){
  const technical=roles.some(r=>r.roleCode==='TECH_ADMIN'&&r.scopeType==='ORGANIZATION'&&r.scopeId===null);
  const activeGroup=!s.simulation_group_id||!!(await db.query("SELECT 1 FROM organization.groups WHERE id=$1 AND status='ACTIVE'",[s.simulation_group_id])).rowCount;
  // Invalid simulation has no grants, but authentication stays available for exit/logout.
  if(technical){effectiveRole=s.simulation_role;simulation=true;roles=activeGroup?[{roleCode:s.simulation_role,scopeType:s.simulation_group_id?'GROUP':'ORGANIZATION',scopeId:s.simulation_group_id}]:[];}
  else {effectiveRole=null;roles=[];}

 }
 return {availableRoles,roles,effectiveRole,simulation,redirectTo:effectiveRole?ROLE_HOME[effectiveRole]??'/select-role':'/select-role'};
}
export async function recheckContext(db:Pool|PoolClient,u:AuthUser,guide=false){
 const context=await contextFor(db,u.accountId,u.sessionId);
 if(!context.roles.length||context.effectiveRole!==u.effectiveRole||context.simulation!==u.simulation||JSON.stringify(context.roles)!==JSON.stringify(u.roles)||(guide&&context.effectiveRole!=='SUPREME_GUIDE'))throw new AppError(403,'ROLE_CHANGED','نقش یا محدوده دسترسی تغییر کرده است؛ صفحه را تازه کنید.');
 return context.roles;
}
