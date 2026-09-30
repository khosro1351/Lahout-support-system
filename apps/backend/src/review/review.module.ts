import {DocumentsModule} from '../documents/documents.module';
import { Body,Controller,Get,Post,Param,Query,Req,Res,UseGuards,HttpCode,Module } from '@nestjs/common';
import type {FastifyReply} from 'fastify';
import {SessionGuard,type AuthenticatedRequest} from '../auth/session.guard';
import {GuideGuard} from '../auth/guide.guard';
import {CsrfGuard} from '../auth/csrf.guard';
import {AuthModule} from '../auth/auth.module';
import {GuidanceModule} from '../guidance/guidance.module';
import {GuidanceService} from '../guidance/guidance.service';
import {ReviewService} from './review.service';
import {MonitoringService} from './monitoring.service';
const attachment=(reply:FastifyReply,data:{name:string;media_type:string;content:Buffer})=>reply.header('Content-Disposition',"attachment; filename*=UTF-8''"+encodeURIComponent(data.name)).type(data.media_type).send(data.content);
@Controller('review') @UseGuards(SessionGuard,GuideGuard)
export class ReviewController {
 constructor(private readonly s:ReviewService,private readonly g:GuidanceService){}
 @Get('dashboard') dashboard(){return this.s.dashboard();}
 @Get('people') people(@Query() q:Record<string,string>){return this.s.people(q);}
 @Get('people/:id') person(@Param('id') id:string,@Req() r:AuthenticatedRequest){return this.s.person(id,r.user);}
 @Get('council') council(@Query() q:Record<string,string>){return this.s.council(q);}
 @Get('council/:id') councilDetail(@Param('id') id:string,@Req() r:AuthenticatedRequest){return this.s.councilDetail(id,r.user);}
 @Post('council/:id/intervention') @HttpCode(200) @UseGuards(CsrfGuard) intervene(@Param('id') id:string,@Body() b:unknown,@Req() r:AuthenticatedRequest){return this.s.councilIntervene(id,b,r.user);}
 @Get('council/:id/attachments/:attachmentId') async file(@Param('id') id:string,@Param('attachmentId') attachmentId:string,@Res() reply:FastifyReply){return attachment(reply,await this.s.attachment(id,attachmentId));}
 @Post('groups') @HttpCode(200) @UseGuards(CsrfGuard) create(@Body() b:unknown,@Req() r:AuthenticatedRequest){return this.g.createGroup(b,r.user);}
 @Post('groups/:id/deactivate') @HttpCode(200) @UseGuards(CsrfGuard) deactivate(@Param('id') id:string,@Body() b:unknown,@Req() r:AuthenticatedRequest){return this.s.deactivate(id,b,r.user);}
 @Post('groups/:id/reactivate') @HttpCode(200) @UseGuards(CsrfGuard) reactivate(@Param('id') id:string,@Body() b:unknown,@Req() r:AuthenticatedRequest){return this.s.reactivate(id,b,r.user);}
}
@Controller('verification') @UseGuards(SessionGuard)
export class VerificationController {
 constructor(private readonly s:ReviewService){}
 @Get('people') people(@Req() r:AuthenticatedRequest){return this.s.permissionPeople(r.user);}
 @Get('requests') list(@Req() r:AuthenticatedRequest){return this.s.permissions(r.user);}
 @Get('requests/:id') detail(@Param('id') id:string,@Req() r:AuthenticatedRequest){return this.s.permissionDetail(id,r.user);}
 @Post('requests') @HttpCode(200) @UseGuards(CsrfGuard) create(@Body() b:unknown,@Req() r:AuthenticatedRequest){return this.s.submitPermission(b,r.user);}
 @Post('requests/:id/seen') @HttpCode(200) @UseGuards(GuideGuard,CsrfGuard) seen(@Param('id') id:string,@Req() r:AuthenticatedRequest){return this.s.permissionSeen(id,r.user);}
 @Post('requests/:id/decision') @HttpCode(200) @UseGuards(GuideGuard,CsrfGuard) decide(@Param('id') id:string,@Body() b:unknown,@Req() r:AuthenticatedRequest){return this.s.decidePermission(id,b,r.user);}
}
@Controller('cases') @UseGuards(SessionGuard)
export class CasesController {
 constructor(private readonly s:ReviewService){}
 @Get('groups') groups(@Query() q:Record<string,string>,@Req() r:AuthenticatedRequest){return this.s.groups(q,r.user);}
 @Get('groups/:id') group(@Param('id') id:string,@Query() q:Record<string,string>,@Req() r:AuthenticatedRequest){return this.s.group(id,q,r.user);}
 @Get('families/:id') family(@Param('id') id:string,@Req() r:AuthenticatedRequest){return this.s.family(id,r.user);}
 @Get('families/:id/documents/:docId') async document(@Param('id') id:string,@Param('docId') docId:string,@Req() r:AuthenticatedRequest,@Res() reply:FastifyReply){return attachment(reply,await this.s.document(id,docId,r.user));}
 @Post('families/:id/transfer') @HttpCode(200) @UseGuards(GuideGuard,CsrfGuard) transfer(@Param('id') id:string,@Body() b:unknown,@Req() r:AuthenticatedRequest){return this.s.transfer(id,b,r.user);}
 @Get('alerts') alerts(@Query() q:Record<string,string>,@Req() r:AuthenticatedRequest){return this.s.alerts(q,r.user);}
 @Post('notes') @HttpCode(200) @UseGuards(CsrfGuard) note(@Body() b:unknown,@Req() r:AuthenticatedRequest){return this.s.note(b,r.user);}
 @Post('alerts/:id/resolve') @HttpCode(200) @UseGuards(CsrfGuard) resolve(@Param('id') id:string,@Body() b:unknown,@Req() r:AuthenticatedRequest){return this.s.resolve(id,b,r.user);}
}
@Controller('monitoring') @UseGuards(SessionGuard,GuideGuard)
export class MonitoringController {
 constructor(private readonly s:MonitoringService){}
 @Get('options') options(){return this.s.options();}
 @Get('catalog/:dataset') catalog(@Param('dataset') dataset:string){return this.s.catalog(dataset);}
 @Get('data/:dataset') data(@Param('dataset') dataset:string,@Query() q:Record<string,string>){return this.s.query(dataset,q);}
 @Post('export') @HttpCode(200) @UseGuards(CsrfGuard) async export(@Body() b:unknown,@Req() r:AuthenticatedRequest,@Res() reply:FastifyReply){const result=await this.s.export(b,r.user);if(result.format==='preview')return reply.send({html:result.html,fields:result.fields,rows:result.rows});return reply.header('Content-Disposition','attachment; filename="lahout-report.'+result.format+'"').type(result.format==='pdf'?'application/pdf':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').send(result.buffer);}
}
@Module({imports:[AuthModule,GuidanceModule,DocumentsModule],controllers:[ReviewController,VerificationController,CasesController,MonitoringController],providers:[ReviewService,MonitoringService],exports:[ReviewService]})
export class ReviewModule{}
