import {Body,Controller,Get,Post,Param,Req,Res,UseGuards,HttpCode,Module} from '@nestjs/common';
import type {FastifyReply} from 'fastify';
import {SessionGuard,type AuthenticatedRequest} from '../auth/session.guard';
import {CsrfGuard} from '../auth/csrf.guard';
import {AuthModule} from '../auth/auth.module';
import {GuidanceModule} from '../guidance/guidance.module';
import {FamilyImportService} from './family-import.service';
@Controller('family-import') @UseGuards(SessionGuard)
class FamilyImportController {
 constructor(private s:FamilyImportService){}
 @Get() dashboard(@Req() r:AuthenticatedRequest){return this.s.dashboard(r.user);}
 @Get('template') async template(@Req() r:AuthenticatedRequest,@Res() reply:FastifyReply){return reply.header('Content-Disposition','attachment; filename="family-import-v1.xlsx"').type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').send(await this.s.download(r.user));}
 @Post('groups/:id/upload') @HttpCode(200) @UseGuards(CsrfGuard) upload(@Param('id') id:string,@Body() b:unknown,@Req() r:AuthenticatedRequest){return this.s.upload(id,b,r.user);}
 @Get('batches/:id') preview(@Param('id') id:string,@Req() r:AuthenticatedRequest){return this.s.preview(id,r.user);}
 @Get('batches/:id/file') async file(@Param('id') id:string,@Req() r:AuthenticatedRequest,@Res() reply:FastifyReply){const f=await this.s.source(id,r.user);return reply.header('Content-Disposition',"attachment; filename*=UTF-8''"+encodeURIComponent(f.name)).type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').send(f.content);}
 @Post('batches/:id/rows/:rowId') @HttpCode(200) @UseGuards(CsrfGuard) resolve(@Param('id') id:string,@Param('rowId') row:string,@Body() b:unknown,@Req() r:AuthenticatedRequest){return this.s.resolve(id,row,b,r.user);}
 @Post('batches/:id/confirm') @HttpCode(200) @UseGuards(CsrfGuard) confirm(@Param('id') id:string,@Body() b:unknown,@Req() r:AuthenticatedRequest){return this.s.confirm(id,b,r.user);}
 @Post('batches/:id/rollback') @HttpCode(200) @UseGuards(CsrfGuard) rollback(@Param('id') id:string,@Body() b:unknown,@Req() r:AuthenticatedRequest){return this.s.rollback(id,b,r.user);}
 @Post('families/:id') @HttpCode(200) @UseGuards(CsrfGuard) state(@Param('id') id:string,@Body() b:unknown,@Req() r:AuthenticatedRequest){return this.s.familyState(id,b,r.user);}
}
@Module({imports:[AuthModule,GuidanceModule],controllers:[FamilyImportController],providers:[FamilyImportService]})
export class FamilyImportModule{}
