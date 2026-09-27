import {AppError} from '../common/app-error';
import type {AuthUser} from './auth.types';
export const ACTIONS=['VIEW','CREATE','UPDATE','SUBMIT','APPROVE','RETURN_FOR_COMPLETION','DECIDE','VIEW_HISTORY'] as const;
export type Action=typeof ACTIONS[number];
const org=['SUPREME_GUIDE','EXECUTIVE_MANAGER','GROUP_LEADER','HELPER','COUNCIL_MEMBER'];
// Domain/action grants. Reserved approval actions have no new workflow in this slice.
export const GRANTS:Record<string,Record<string,readonly string[]>>={
 SUPREME_GUIDE:{LIVELIHOOD:['VIEW','VIEW_HISTORY'],VERIFICATION:['VIEW','CREATE','DECIDE'],GUIDANCE:ACTIONS,ACCESS:['VIEW','DECIDE','VIEW_HISTORY'],CASE:['VIEW','UPDATE','VIEW_HISTORY'],ASSESSMENT:['VIEW','VIEW_HISTORY'],ALERT:['VIEW'],MODEL:['VIEW'],REPORT:['VIEW'],WORKSPACE:['VIEW','UPDATE','CREATE','VIEW_HISTORY'],DASHBOARD:['VIEW']},
 EXECUTIVE_MANAGER:{LIVELIHOOD:['VIEW','APPROVE','RETURN_FOR_COMPLETION','VIEW_HISTORY'],CASE:['VIEW','UPDATE','VIEW_HISTORY'],ASSESSMENT:['VIEW','VIEW_HISTORY'],ALERT:['VIEW','UPDATE'],WORKSPACE:['VIEW','UPDATE','CREATE','VIEW_HISTORY'],VERIFICATION:['VIEW','CREATE'],DASHBOARD:['VIEW']},
 GROUP_LEADER:{LIVELIHOOD:['VIEW','CREATE','UPDATE','SUBMIT','VIEW_HISTORY'],CASE:['VIEW','UPDATE','VIEW_HISTORY'],ASSESSMENT:['VIEW','CREATE','UPDATE','SUBMIT','VIEW_HISTORY'],ALERT:['VIEW','UPDATE'],WORKSPACE:['VIEW','UPDATE','CREATE','VIEW_HISTORY'],DASHBOARD:['VIEW']},
 HELPER:{LIVELIHOOD:['VIEW','VIEW_HISTORY'],CASE:['VIEW','UPDATE','VIEW_HISTORY'],ASSESSMENT:['VIEW','VIEW_HISTORY'],ALERT:['VIEW'],WORKSPACE:['VIEW','UPDATE','CREATE','VIEW_HISTORY'],DASHBOARD:['VIEW']},
 COUNCIL_MEMBER:{WORKSPACE:['VIEW','UPDATE','CREATE','VIEW_HISTORY'],DASHBOARD:['VIEW']},
 TECH_ADMIN:{TECHNICAL:['VIEW','VIEW_HISTORY'],MODEL:['UPDATE'],DASHBOARD:['VIEW']},
};
export function can(u:AuthUser,domain:string,action:Action){return !!u.roles.length&&!!u.effectiveRole&&!!GRANTS[u.effectiveRole]?.[domain]?.includes(action);}
export function permissionFor(controller:string,handler:string,method:string):{domain:string;action:Action}|null{
 if(controller==='FamilyWorkspaceController')return {domain:'CASE',action:method==='GET'?'VIEW':'UPDATE'};
 if(controller==='HealthScreeningController')return {domain:'ASSESSMENT',action:method==='GET'?'VIEW':'UPDATE'};
 if(controller==='LivelihoodController')return {domain:'LIVELIHOOD',action:method==='GET'?'VIEW':handler==='approve'||handler==='begin'?'APPROVE':handler==='returnReview'?'RETURN_FOR_COMPLETION':handler==='submit'?'SUBMIT':'UPDATE'};
 if(controller==='AuthController')return handler==='guideHome'?{domain:'GUIDANCE',action:'VIEW'}:null;
 if(controller==='RoleWorkspaceController')return {domain:'DASHBOARD',action:'VIEW'};
 if(controller==='TechnicalController')return {domain:'TECHNICAL',action:handler==='audit'?'VIEW_HISTORY':'VIEW'};
 if(controller==='AccessRequestsController')return {domain:'ACCESS',action:method==='GET'?'VIEW':'DECIDE'};
 if(['GuidanceController','ReviewController','OversightController','MonitoringController'].includes(controller))return {domain:'GUIDANCE',action:method==='GET'?'VIEW':['export','report','sponsor'].includes(handler)?'VIEW':['assign','end','leader','deactivate','reactivate','transfer','intervene'].includes(handler)?'UPDATE':'CREATE'};
 if(controller==='RecipientController')return {domain:'WORKSPACE',action:method==='GET'?'VIEW':handler==='coordination'?'CREATE':'UPDATE'};
 if(controller==='VerificationController')return {domain:'VERIFICATION',action:method==='GET'?'VIEW':handler==='decide'?'DECIDE':'CREATE'};
 if(controller==='CasesController'&&handler==='resolve')return {domain:'ALERT',action:'VIEW'};
 if(controller==='CasesController')return {domain:handler==='alerts'||handler==='resolve'?'ALERT':'CASE',action:method==='GET'?'VIEW':'UPDATE'};
 if(controller==='SharedController')return {domain:handler==='transition'?'MODEL':['alerts','progress'].includes(handler)?'ALERT':['workspace','saveDraft','evidence','submit'].includes(handler)?'ASSESSMENT':'CASE',action:method==='GET'?'VIEW':handler==='submit'?'SUBMIT':'UPDATE'};
 throw new AppError(403,'PERMISSION_UNMAPPED','مجوز این عملیات هنوز تعریف نشده است.');
}
export function enforce(u:AuthUser,domain:string,action:Action){if(!can(u,domain,action))throw new AppError(403,'PERMISSION_DENIED','نقش فعال شما مجوز این عملیات را ندارد.');}
