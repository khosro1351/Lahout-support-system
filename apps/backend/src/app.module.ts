import {HealthScreeningModule} from './health-screening/health-screening.module';
import {LivelihoodModule} from './livelihood/livelihood.module';
import {RoleWorkspaceModule} from './auth/role-workspace.module';
import {OversightModule} from './oversight/oversight.module';
import { ReviewModule } from './review/review.module';
import { GuidanceModule } from './guidance/guidance.module';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { OrganizationModule } from './organization/organization.module';
import { FamiliesModule } from './families/families.module';
import { HealthModule } from './health/health.module';
import { AccessRequestsModule } from './access-requests/access-requests.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AuthModule,
    HealthModule,
    AccessRequestsModule,
    GuidanceModule,
    ReviewModule,
    OversightModule,
    RoleWorkspaceModule,
    LivelihoodModule,
    HealthScreeningModule,
  ],
})
export class AppModule {}
