import { Body, Controller, Get, HttpCode, Param, Post, Query, Req, UseGuards, Module, Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { SessionGuard, type AuthenticatedRequest } from '../auth/session.guard';
import { GuideGuard } from '../auth/guide.guard';
import { CsrfGuard } from '../auth/csrf.guard';
import { AuthModule } from '../auth/auth.module';
import { AppError } from '../common/app-error';
import { GuidanceService } from './guidance.service';
@Injectable()
class WorkspaceGuard implements CanActivate {
 canActivate(context:ExecutionContext){const r=context.switchToHttp().getRequest<AuthenticatedRequest>();if(!r.user.roles.length)throw new AppError(403,'FORBIDDEN','مسئولیت فعالی برای این دسترسی ندارید.');return true;}
}
@Controller('guide')
@UseGuards(SessionGuard,GuideGuard)
export class GuidanceController {
 constructor(private readonly s:GuidanceService){}
 @Get('dashboard') dashboard(){return this.s.dashboard();}
 @Get('metadata') metadata(){return this.s.metadata();}
 @Get('people') people(@Query() q:Record<string,string>){return this.s.people(q);}
 @Get('people/:id') person(@Param('id') id:string){return this.s.person(id);}
 @Get('appointments') appointments(){return this.s.appointments();}
 @Get('groups') groups(){return this.s.groups();}
 @Get('groups/:id') group(@Param('id') id:string){return this.s.group(id);}
 @Get('alerts') alerts(){return this.s.alerts();}
 @Get('reports') reports(@Query() q:Record<string,string>){return this.s.reports(q);}
 @Get('families/:id') family(@Param('id') id:string){return this.s.family(id);}
 @Post('people/:id/assign') @HttpCode(200) @UseGuards(CsrfGuard) assign(@Param('id') id:string,@Body() b:unknown,@Req() r:AuthenticatedRequest){return this.s.assign(id,b,r.user);}
 @Post('people/:id/end-role') @HttpCode(200) @UseGuards(CsrfGuard) end(@Param('id') id:string,@Body() b:unknown,@Req() r:AuthenticatedRequest){return this.s.endRole(id,b,r.user);}
 @Post('groups') @HttpCode(200) @UseGuards(CsrfGuard) create(@Body() b:unknown,@Req() r:AuthenticatedRequest){return this.s.createGroup(b,r.user);}
 @Post('groups/:id/leader') @HttpCode(200) @UseGuards(CsrfGuard) leader(@Param('id') id:string,@Body() b:unknown,@Req() r:AuthenticatedRequest){return this.s.changeLeader(id,b,r.user);}
 @Post('groups/:id/dissolve') @HttpCode(200) @UseGuards(CsrfGuard) dissolve(@Param('id') id:string,@Body() b:unknown,@Req() r:AuthenticatedRequest){return this.s.dissolve(id,b,r.user);}
 @Post('items') @HttpCode(200) @UseGuards(CsrfGuard) item(@Body() b:unknown,@Req() r:AuthenticatedRequest){return this.s.createItem(b,r.user);}
 @Post('items/:id/action') @HttpCode(200) @UseGuards(CsrfGuard) action(@Param('id') id:string,@Body() b:unknown,@Req() r:AuthenticatedRequest){return this.s.action(id,b,r.user);}
 @Post('reports/sponsor') @HttpCode(200) @UseGuards(CsrfGuard) sponsor(@Body() b:unknown,@Req() r:AuthenticatedRequest){return this.s.sponsor(b,r.user);}
}
@Controller('workspace')
@UseGuards(SessionGuard,WorkspaceGuard)
export class RecipientController {
 constructor(private readonly s:GuidanceService){}
 @Get('items') items(@Query() q:Record<string,string>,@Req() r:AuthenticatedRequest){return this.s.items(r.user,q);}
 @Get('items/:id') detail(@Param('id') id:string,@Req() r:AuthenticatedRequest){return this.s.detail(id,r.user);}
 @Post('items/:id/seen') @HttpCode(200) @UseGuards(CsrfGuard) seen(@Param('id') id:string,@Req() r:AuthenticatedRequest){return this.s.seen(id,r.user);}
 @Post('items/:id/complete') @HttpCode(200) @UseGuards(CsrfGuard) complete(@Param('id') id:string,@Body() b:unknown,@Req() r:AuthenticatedRequest){return this.s.complete(id,b,r.user);}
 @Post('coordination') @HttpCode(200) @UseGuards(CsrfGuard) coordination(@Body() b:unknown,@Req() r:AuthenticatedRequest){return this.s.createItem(b,r.user,true);}
 @Get('notifications') notifications(@Req() r:AuthenticatedRequest){return this.s.notifications(r.user);}
 @Post('notifications/:id/seen') @HttpCode(200) @UseGuards(CsrfGuard) notification(@Param('id') id:string,@Req() r:AuthenticatedRequest){return this.s.notificationSeen(id,r.user);}
}
@Module({imports:[AuthModule],controllers:[GuidanceController,RecipientController],providers:[GuidanceService]})
export class GuidanceModule{}
