import { Module, Global } from '@nestjs/common';
import { DBService } from './db.service';
import { SupabaseService } from './supabase.service';
import { JSONScalar } from './scalars/json.scalar';

@Global()
@Module({
  providers: [DBService, SupabaseService, JSONScalar],
  exports: [DBService, SupabaseService, JSONScalar],
})
export class GlobalModule {}
