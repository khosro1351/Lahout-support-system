import {Body,Controller,Get,Post,Param,Req,UseGuards,HttpCode,Module} from '@nestjs/common';
import {SessionGuard,type AuthenticatedRequest} from '../auth/session.guard';
import {CsrfGuard} from '../auth/csrf.guard';
import {AuthModule} from '../auth/auth.module';
import {GuidanceModule} from '../guidance/guidance.module';
import {LivelihoodModule} from '../livelihood/livelihood.module';
import {HealthScreeningService} from './health-screening.service';
@Controller('health-screening') @UseGuards(SessionGuard)
class HealthScreeningController {
 constructor(private s:HealthScreeningService){}
 @Get('families/:id') workspace(@Param('id') id:string,@Req() r:AuthenticatedRequest){return this.s.workspace(id,r.user);}
 @Post('families/:id/members/:memberId') @HttpCode(200) @UseGuards(CsrfGuard)
 save(@Param('id') id:string,@Param('memberId') memberId:string,@Body() b:unknown,@Req() r:AuthenticatedRequest){return this.s.save(id,memberId,b,r.user);}
}
@Module({imports:[AuthModule,GuidanceModule,LivelihoodModule],controllers:[HealthScreeningController],providers:[HealthScreeningService]})
export class HealthScreeningModule{}
