import {Body,Controller,Get,Post,Param,Req,UseGuards,HttpCode,Module} from '@nestjs/common';
import {SessionGuard,type AuthenticatedRequest} from '../auth/session.guard';
import {CsrfGuard} from '../auth/csrf.guard';
import {AuthModule} from '../auth/auth.module';
import {GuidanceModule} from '../guidance/guidance.module';
import {LivelihoodModule} from '../livelihood/livelihood.module';
import {HealthWorkflowService} from './health-workflow.service';
import {HealthScreeningService} from './health-screening.service';
@Controller('health-screening') @UseGuards(SessionGuard)
class HealthScreeningController {
 constructor(private s:HealthScreeningService){}
 @Get('families/:id') workspace(@Param('id') id:string,@Req() r:AuthenticatedRequest){return this.s.workspace(id,r.user);}
 @Post('families/:id/members/:memberId') @HttpCode(200) @UseGuards(CsrfGuard)
 save(@Param('id') id:string,@Param('memberId') memberId:string,@Body() b:unknown,@Req() r:AuthenticatedRequest){return this.s.save(id,memberId,b,r.user);}
}
@Controller('health-assessment') @UseGuards(SessionGuard)
class HealthWorkflowController {
 constructor(private s:HealthWorkflowService){}
 @Get('queue') queue(@Req() r:AuthenticatedRequest){return this.s.queue(r.user);}
 @Get('families/:id') workspace(@Param('id') id:string,@Req() r:AuthenticatedRequest){return this.s.workspace(id,r.user);}
 @Post('families/:id/draft') @HttpCode(200) @UseGuards(CsrfGuard) draft(@Param('id') id:string,@Body() b:unknown,@Req() r:AuthenticatedRequest){return this.s.draft(id,b,r.user);}
 @Post('families/:id/members/:memberId') @HttpCode(200) @UseGuards(CsrfGuard) form(@Param('id') id:string,@Param('memberId') member:string,@Body() b:unknown,@Req() r:AuthenticatedRequest){return this.s.form(id,member,b,r.user);}
 @Post('families/:id/submit') @HttpCode(200) @UseGuards(CsrfGuard) submit(@Param('id') id:string,@Body() b:unknown,@Req() r:AuthenticatedRequest){return this.s.submit(id,b,r.user);}
 @Post('submissions/:id/approve') @HttpCode(200) @UseGuards(CsrfGuard) approve(@Param('id') id:string,@Body() b:unknown,@Req() r:AuthenticatedRequest){return this.s.decide(id,b,r.user,'APPROVED');}
 @Post('submissions/:id/return') @HttpCode(200) @UseGuards(CsrfGuard) back(@Param('id') id:string,@Body() b:unknown,@Req() r:AuthenticatedRequest){return this.s.decide(id,b,r.user,'RETURNED');}
}
@Module({imports:[AuthModule,GuidanceModule,LivelihoodModule],controllers:[HealthScreeningController,HealthWorkflowController],providers:[HealthScreeningService,HealthWorkflowService]})
export class HealthScreeningModule{}
