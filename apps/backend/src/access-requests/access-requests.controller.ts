import { Body, Controller, Get, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { SessionGuard, type AuthenticatedRequest } from '../auth/session.guard';
import { GuideGuard } from '../auth/guide.guard';
import { CsrfGuard } from '../auth/csrf.guard';
import { AccessRequestsService } from './access-requests.service';

@Controller('access-requests')
@UseGuards(SessionGuard, GuideGuard)
export class AccessRequestsController {
  constructor(private readonly service: AccessRequestsService) {}

  @Get()
  list() { return this.service.list(); }

  @Get(':id')
  detail(@Param('id') id: string) { return this.service.detail(id); }

  @Post(':id/decision')
  @HttpCode(200)
  @UseGuards(CsrfGuard)
  decide(@Param('id') id: string, @Body() body: unknown, @Req() request: AuthenticatedRequest) {
    return this.service.decide(id, body, request.user);
  }
}
