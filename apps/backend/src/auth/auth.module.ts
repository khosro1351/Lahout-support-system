import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionGuard } from './session.guard';
import { CsrfGuard } from './csrf.guard';
import { GuideGuard } from './guide.guard';

@Module({
  controllers: [AuthController],
  providers: [AuthService, SessionGuard, CsrfGuard, GuideGuard],
  exports: [AuthService, SessionGuard, CsrfGuard, GuideGuard],
})
export class AuthModule {}
