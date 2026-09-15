import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AccessRequestsController } from './access-requests.controller';
import { AccessRequestsService } from './access-requests.service';
@Module({ imports: [AuthModule], controllers: [AccessRequestsController], providers: [AccessRequestsService] })
export class AccessRequestsModule {}
