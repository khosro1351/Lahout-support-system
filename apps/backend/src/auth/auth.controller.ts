import { Body, Controller, Get, Post, Req, Res, UseGuards, HttpCode } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { AuthService } from './auth.service';
import { SessionGuard, type AuthenticatedRequest } from './session.guard';
import { CsrfGuard } from './csrf.guard';
import { AppError } from '../common/app-error';
import { loadConfig } from '../common/config';
import { GuideGuard } from './guide.guard';
import { checkLoginRate } from './login-throttle';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() body: any,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    checkLoginRate(request.ip);
    if (!body || typeof body.username !== 'string' || typeof body.password !== 'string' || !body.username.trim() || !body.password || body.username.length > 80 || body.password.length > 128) {
      throw new AppError(400, 'VALIDATION_ERROR', 'نام کاربری و رمز عبور الزامی است.');
    }
    const { token, user } = await this.authService.login(body.username.trim(), body.password, request.cookies?.lahout_session);
    const config = loadConfig();
    reply.setCookie('lahout_session', token, {
      httpOnly: true,
      secure: config.cookieSecure,
      sameSite: 'strict',
      path: '/',
      maxAge: config.sessionTtlHours * 60 * 60,
    });
    return { user, csrfToken: user.csrfToken, redirectTo: user.redirectTo };
  }

  @Post('select-role') @HttpCode(200) @UseGuards(SessionGuard,CsrfGuard)
  async selectRole(@Body() body:any,@Req() r:AuthenticatedRequest){return {user:await this.authService.selectRole(r.user,body)};}
  @Post('simulation') @HttpCode(200) @UseGuards(SessionGuard,CsrfGuard)
  async simulation(@Body() body:any,@Req() r:AuthenticatedRequest){return {user:await this.authService.simulate(r.user,body)};}
  @Post('simulation/stop') @HttpCode(200) @UseGuards(SessionGuard,CsrfGuard)
  async stopSimulation(@Req() r:AuthenticatedRequest){return {user:await this.authService.simulate(r.user,null,true)};}

  @Get('guide-home')
  @UseGuards(SessionGuard, GuideGuard)
  guideHome(@Req() request: AuthenticatedRequest) {
    return { displayName: request.user.displayName, roleCode: 'SUPREME_GUIDE' };
  }

  @Get('me')
  @UseGuards(SessionGuard)
  me(@Req() request: AuthenticatedRequest) {
    return { user: request.user, csrfToken: request.user.csrfToken };
  }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(SessionGuard, CsrfGuard)
  async logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    await this.authService.logout(request.user.sessionId, request.user.accountId);
    reply.clearCookie('lahout_session', { path: '/' });
    return { ok: true };
  }
}
