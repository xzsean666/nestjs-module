import { Module, Global } from '@nestjs/common';
import { DBService } from './db.service';

import { JSONScalar } from './scalars/json.scalar';
// import { SupabaseService } from './supabase.service';
// import { SubscriptionTokenService } from './subscription-token.service';

@Global()
@Module({
  providers: [DBService, JSONScalar],
  exports: [DBService, JSONScalar],
})
export class GlobalModule {}
