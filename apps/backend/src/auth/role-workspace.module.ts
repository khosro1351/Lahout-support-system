import {OversightModule} from '../oversight/oversight.module';
import {OversightService} from '../oversight/oversight.service';
import {AssessmentService} from '../oversight/assessment.service';
import {Controller,Get,Inject,Module,Req,UseGuards} from '@nestjs/common';
import {Pool} from 'pg';
import {PG_POOL} from '../database/database.constants';
import {SessionGuard,type AuthenticatedRequest} from './session.guard';
import {AuthModule} from './auth.module';
import {ReviewModule} from '../review/review.module';
import {ReviewService} from '../review/review.service';
import {GuidanceModule} from '../guidance/guidance.module';
import {GuidanceService} from '../guidance/guidance.service';
import {ROLE_LABELS,ROLE_HOME} from './role-context';
import {GRANTS,can} from './permissions';
@Controller('roles') @UseGuards(SessionGuard)
class RoleWorkspaceController {
 constructor(private oversight:OversightService,private assessment:AssessmentService,private review:ReviewService,private guidance:GuidanceService,@Inject(PG_POOL) private pool:Pool){}
 @Get('dashboard') async dashboard(@Req() r:AuthenticatedRequest){
  const u=r.user,groups=can(u,'CASE','VIEW')?(await this.review.groups({},u)).groups:[];
  const groupIds=groups.map(g=>g.group_id);
  const families=groupIds.length?(await this.oversight.families()).filter(f=>groupIds.includes(f.group_id)):[];
  const alerts=can(u,'ALERT','VIEW')?(await this.assessment.alerts({},u)).alerts:[];
  const tasks=can(u,'WORKSPACE','VIEW')?await this.guidance.items(u,{}):{items:[]};
  return {metrics:{incomplete:families.filter(f=>f.case_condition==='INCOMPLETE').length,review:families.filter(f=>f.review_required).length},role:u.effectiveRole,label:ROLE_LABELS[u.effectiveRole!],groups,families,alerts,tasks,permissions:GRANTS[u.effectiveRole!],deferred:['تأیید و بازگشت ارزیابی نسخه ۱٫۰۰','اعتبار و انقضای یک‌ساله ارزیابی نسخه ۱٫۰۰','گردش پذیرش و تصمیم شورای کانون','گردش کامل بازدید و مأموریت میدانی']};
 }
}
@Controller('technical') @UseGuards(SessionGuard)
class TechnicalController {
 constructor(@Inject(PG_POOL) private pool:Pool){}
 @Get('status') async status(){
  const checked=(await this.pool.query('SELECT now() AS checked_at')).rows[0];
  return {service:'UP',database:'CONNECTED',version:'0.1.0',environment:process.env.APP_ENV??'development',checkedAt:checked.checked_at,roles:Object.entries(ROLE_LABELS).filter(([code])=>code!=='TECH_ADMIN').map(([code,label])=>({code,label,home:ROLE_HOME[code]})),groups:(await this.pool.query("SELECT id,name FROM organization.groups WHERE status='ACTIVE' ORDER BY name")).rows,deferred:['پایش خودکار خطاهای فنی','نسخه پشتیبان و مصرف منابع']};
 }
 @Get('users') async users(){return {users:(await this.pool.query(`SELECT a.id,a.username,a.status,p.first_name||' '||p.last_name AS name,COALESCE((SELECT jsonb_agg(jsonb_build_object('code',r.role_code,'label',ro.label_fa,'scope',g.name)) FROM identity.role_assignments r JOIN identity.roles ro ON ro.code=r.role_code LEFT JOIN organization.groups g ON g.id=r.scope_id WHERE r.account_id=a.id AND r.valid_from<=now() AND (r.valid_to IS NULL OR r.valid_to>now())),'[]') AS roles FROM identity.accounts a JOIN identity.people p ON p.id=a.person_id ORDER BY a.username`)).rows,editable:false};}
 @Get('audit') async audit(){return {events:(await this.pool.query(`SELECT e.id,e.event_type,e.occurred_at,e.entity_type,e.effective_role,e.simulation,e.effective_scopes,a.username,p.first_name||' '||p.last_name AS actor_name FROM admin.audit_events e LEFT JOIN identity.accounts a ON a.id=e.actor_account_id LEFT JOIN identity.people p ON p.id=a.person_id ORDER BY e.occurred_at DESC,e.id LIMIT 100`)).rows};}
}
@Module({imports:[AuthModule,ReviewModule,GuidanceModule,OversightModule],controllers:[RoleWorkspaceController,TechnicalController]})
export class RoleWorkspaceModule{}
