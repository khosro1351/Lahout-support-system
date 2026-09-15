import { Global, Module } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from './database.constants';
import { loadConfig } from '../common/config';

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      useFactory: () => new Pool({ connectionString: loadConfig().databaseUrl }),
    },
  ],
  exports: [PG_POOL],
})
export class DatabaseModule {}
