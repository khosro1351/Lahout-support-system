import {DocumentsModule} from '../documents/documents.module';
import {Body,Controller,Get,Post,Param,Req,Res,UseGuards,HttpCode,Module} from '@nestjs/common';
import type {FastifyReply} from 'fastify';
import {SessionGuard,type AuthenticatedRequest} from '../auth/session.guard';
import {CsrfGuard} from '../auth/csrf.guard';
import {AuthModule} from '../auth/auth.module';
import {GuidanceModule} from '../guidance/guidance.module';
import {LivelihoodService} from './livelihood.service';
@Controller('livelihood') @UseGuards(SessionGuard)
class LivelihoodController {
 constructor(private s:LivelihoodService){}
 @Get('families') list(@Req() r:AuthenticatedRequest){return this.s.list(r.user);}
 @Get('submissions/:id') submission(@Param('id') id:string,@Req() r:AuthenticatedRequest){return this.s.submission(id,r.user);}
 @Get('queue') queue(@Req() r:AuthenticatedRequest){return this.s.queue(r.user);}
 @Get('families/:id') workspace(@Param('id') id:string,@Req() r:AuthenticatedRequest){return this.s.workspace(id,r.user);}
 @Post('families/:id/basic') @HttpCode(200) @UseGuards(CsrfGuard) basic(@Param('id') id:string,@Body() b:unknown,@Req() r:AuthenticatedRequest){return this.s.saveBasics(id,b,r.user);}
 @Post('families/:id/draft') @HttpCode(200) @UseGuards(CsrfGuard) save(@Param('id') id:string,@Body() b:unknown,@Req() r:AuthenticatedRequest){return this.s.save(id,b,r.user);}
 @Post('families/:id/submit') @HttpCode(200) @UseGuards(CsrfGuard) submit(@Param('id') id:string,@Body() b:unknown,@Req() r:AuthenticatedRequest){return this.s.submit(id,b,r.user);}
 @Get('families/:id/document-list') documents(@Param('id') id:string,@Req() r:AuthenticatedRequest){return this.s.documentList(id,r.user);}
 @Post('families/:id/document-versions') @HttpCode(200) @UseGuards(CsrfGuard) documentWrite(@Param('id') id:string,@Body() b:unknown,@Req() r:AuthenticatedRequest){return this.s.documentWrite(id,b,r.user);}
 @Get('families/:id/documents/:document/manifest') manifest(@Param('id') id:string,@Param('document') document:string,@Req() r:AuthenticatedRequest){return this.s.documentManifest(id,document,r.user);}
 @Post('families/:id/documents/:document/archive') @HttpCode(200) @UseGuards(CsrfGuard) archive(@Param('id') id:string,@Param('document') document:string,@Body() b:unknown,@Req() r:AuthenticatedRequest){return this.s.documentArchive(id,document,b,r.user);}
 @Get('families/:id/documents/:document/files/:file') async page(@Param('id') id:string,@Param('document') document:string,@Param('file') file:string,@Req() r:AuthenticatedRequest,@Res() reply:FastifyReply){const d=await this.s.document(id,document,r.user,file);return reply.header('Cache-Control','no-store').header('X-Content-Type-Options','nosniff').header('Content-Security-Policy',"sandbox").header('Content-Disposition',"inline; filename*=UTF-8''"+encodeURIComponent(d.name)).type(d.media_type).send(d.content);}
 @Post('families/:id/documents') @HttpCode(200) @UseGuards(CsrfGuard) upload(@Param('id') id:string,@Body() b:unknown,@Req() r:AuthenticatedRequest){return this.s.upload(id,b,r.user);}
 @Get('families/:id/documents/:document') async document(@Param('id') id:string,@Param('document') document:string,@Req() r:AuthenticatedRequest,@Res() reply:FastifyReply){const d=await this.s.document(id,document,r.user);return reply.header('Cache-Control','no-store').header('X-Content-Type-Options','nosniff').header('Content-Disposition',"inline; filename*=UTF-8''"+encodeURIComponent(d.name)).type(d.media_type).send(d.content);}
 @Post('submissions/:id/begin') @HttpCode(200) @UseGuards(CsrfGuard) begin(@Param('id') id:string,@Body() b:unknown,@Req() r:AuthenticatedRequest){return this.s.review(id,b,r.user,'begin');}
 @Post('submissions/:id/approve') @HttpCode(200) @UseGuards(CsrfGuard) approve(@Param('id') id:string,@Body() b:unknown,@Req() r:AuthenticatedRequest){return this.s.review(id,b,r.user,'approve');}
 @Post('submissions/:id/return') @HttpCode(200) @UseGuards(CsrfGuard) returnReview(@Param('id') id:string,@Body() b:unknown,@Req() r:AuthenticatedRequest){return this.s.review(id,b,r.user,'return');}
}
@Controller('family-workspace') @UseGuards(SessionGuard)
class FamilyWorkspaceController {
 constructor(private s:LivelihoodService){}
 @Get('families') list(@Req() r:AuthenticatedRequest){return this.s.list(r.user,true);}
 @Post('families/:id/lifecycle') @HttpCode(200) @UseGuards(CsrfGuard) lifecycle(@Param('id') id:string,@Body() b:unknown,@Req() r:AuthenticatedRequest){return this.s.lifecycle(id,b,r.user);}
 @Get('families/:id') workspace(@Param('id') id:string,@Req() r:AuthenticatedRequest){return this.s.familyWorkspace(id,r.user);}
 @Post('families/:id') @HttpCode(200) @UseGuards(CsrfGuard) save(@Param('id') id:string,@Body() b:unknown,@Req() r:AuthenticatedRequest){return this.s.saveBasics(id,b,r.user);}
}
@Module({imports:[AuthModule,GuidanceModule,DocumentsModule],controllers:[LivelihoodController,FamilyWorkspaceController],providers:[LivelihoodService],exports:[LivelihoodService]})
export class LivelihoodModule{}
