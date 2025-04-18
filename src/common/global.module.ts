import { Module, Global } from '@nestjs/common';
import { DBService } from './db.service';
import { DBLocalService } from './db.local.service';

import { JSONScalar } from './scalars/json.scalar';

import { AdminAuthGuard } from './admin_auth';
// import { SupabaseService } from './supabase.service';
// import { SubscriptionTokenService } from './subscription-token.service';

@Global()
@Module({
  providers: [DBService, JSONScalar, DBLocalService, AdminAuthGuard],
  exports: [DBService, JSONScalar, DBLocalService, AdminAuthGuard],
})
export class GlobalModule {}
