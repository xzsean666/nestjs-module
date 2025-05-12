import { Module, Global } from '@nestjs/common';
import { DBService } from './db.service';
import { DBLocalService } from './db.local.service';
import { AdminAuthGuard } from './admin_auth';
// import { AuthGuard } from './auth.guard.service';
// import { OTPService } from './otp.service';
// import { SupabaseService } from './supabase.service';
// import { SubscriptionTokenService } from './subscription-token.service';

@Global()
@Module({
  providers: [
    DBService,
    DBLocalService,
    AdminAuthGuard,
    // AuthGuard,
    // {
    //   provide: 'AUTH_SERVICE',
    //   useClass: OTPService,
    // },
  ],
  exports: [
    DBService,
    DBLocalService,
    AdminAuthGuard,
    // AuthGuard,
    // 'AUTH_SERVICE',
  ],
})
export class GlobalModule { }
