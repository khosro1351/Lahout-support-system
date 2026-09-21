import {Body,Controller,Get,Post,Param,Query,Req,Res,UseGuards,HttpCode,Module} from '@nestjs/common';
import type {FastifyReply} from 'fastify';
import {SessionGuard,type AuthenticatedRequest} from '../auth/session.guard';
import {GuideGuard} from '../auth/guide.guard';
import {CsrfGuard} from '../auth/csrf.guard';
import {AuthModule} from '../auth/auth.module';
import {GuidanceModule} from '../guidance/guidance.module';
import {ReviewModule} from '../review/review.module';
import {OversightService} from './oversight.service';
import {AssessmentService} from './assessment.service';
@Controller('oversight') @UseGuards(SessionGuard,GuideGuard)
class OversightController {
 constructor(private s:OversightService,private a:AssessmentService){}
 @Get('families/:id') family(@Param('id') id:string,@Req() r:AuthenticatedRequest){return this.s.familyReadContext(id,r.user);}
 @Get('families') families(){return this.s.monitoringFamilies();}
 @Get('dashboard') dashboard(@Req() r:AuthenticatedRequest){return this.s.dashboard(r.user);}
 @Get('groups') groups(@Query() q:Record<string,string>,@Req() r:AuthenticatedRequest){return this.s.groups(q,r.user);}
 @Get('council') council(@Query() q:Record<string,string>){return this.s.council(q);}
 @Get('council/:id') detail(@Param('id') id:string,@Req() r:AuthenticatedRequest){return this.s.councilDetail(id,r.user);}
 @Get('reports/:section') report(@Param('section') section:string,@Query() q:Record<string,string>,@Req() r:AuthenticatedRequest){return this.s.report(section,q,r.user);}
 @Get('models') models(){return this.a.models();}
 @Post('reports/export') @HttpCode(200) @UseGuards(CsrfGuard) async export(@Body() b:unknown,@Req() r:AuthenticatedRequest,@Res() reply:FastifyReply){const data=await this.s.export(b,r.user);if(data.format==='preview')return reply.send({html:data.html});return reply.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').header('Content-Disposition','attachment; filename="lahout-management.xlsx"').send(data.buffer);}
}
@Controller('shared') @UseGuards(SessionGuard)
class SharedController {
 constructor(private s:OversightService,private a:AssessmentService){}
 @Get('groups/:id') group(@Param('id') id:string,@Query() q:Record<string,string>,@Req() r:AuthenticatedRequest){return this.s.group(id,q,r.user);}
 @Get('families/:id') family(@Param('id') id:string,@Req() r:AuthenticatedRequest){return this.s.family(id,r.user);}
 @Get('families/:id/assessments') workspace(@Param('id') id:string,@Req() r:AuthenticatedRequest){return this.a.workspace(id,r.user);}
 @Post('families/:id/draft') @HttpCode(200) @UseGuards(CsrfGuard) saveDraft(@Param('id') id:string,@Body() b:unknown,@Req() r:AuthenticatedRequest){return this.a.saveDraft(id,b,r.user);}
 @Post('families/:id/evidence') @HttpCode(200) @UseGuards(CsrfGuard) evidence(@Param('id') id:string,@Body() b:unknown,@Req() r:AuthenticatedRequest){return this.a.evidence(id,b,r.user);}
 @Get('alerts') alerts(@Query() q:Record<string,string>,@Req() r:AuthenticatedRequest){return this.a.alerts(q,r.user);}
 @Post('alerts/:id/progress') @HttpCode(200) @UseGuards(CsrfGuard) progress(@Param('id') id:string,@Body() b:unknown,@Req() r:AuthenticatedRequest){return this.a.progress(id,b,r.user);}
 @Post('families/:id/assessments') @HttpCode(200) @UseGuards(CsrfGuard) submit(@Param('id') id:string,@Body() b:unknown,@Req() r:AuthenticatedRequest){return this.a.submit(id,b,r.user);}
 @Post('models/:id/transition') @HttpCode(200) @UseGuards(CsrfGuard) transition(@Param('id') id:string,@Body() b:unknown,@Req() r:AuthenticatedRequest){return this.a.transition(id,b,r.user);}
}
@Module({imports:[AuthModule,GuidanceModule,ReviewModule],controllers:[OversightController,SharedController],providers:[OversightService,AssessmentService]})
export class OversightModule{}
