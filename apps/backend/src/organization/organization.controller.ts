import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { SessionGuard, type AuthenticatedRequest } from '../auth/session.guard';
import { OrganizationService } from './organization.service';

@Controller('groups')
@UseGuards(SessionGuard)
export class OrganizationController {
  constructor(private readonly service: OrganizationService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.service.listAccessibleGroups(request.user);
  }
}
