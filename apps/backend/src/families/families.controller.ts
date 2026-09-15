import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { CsrfGuard } from '../auth/csrf.guard';
import { SessionGuard, type AuthenticatedRequest } from '../auth/session.guard';
import { FamiliesService, type CreateFamilyInput } from './families.service';

@Controller('families')
@UseGuards(SessionGuard)
export class FamiliesController {
  constructor(private readonly service: FamiliesService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.service.list(request.user);
  }

  @Get(':id')
  detail(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.service.getById(request.user, id);
  }

  @Post()
  @UseGuards(CsrfGuard)
  create(@Req() request: AuthenticatedRequest, @Body() body: CreateFamilyInput) {
    return this.service.create(request.user, body);
  }
}
