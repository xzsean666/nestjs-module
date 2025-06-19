import { Module } from '@nestjs/common';
import { AuthResolver } from './auth.resolver';
import { AuthService } from './auth.service';
import { WeChatService } from './wechat.service';
import { GlobalModule } from '../common/global.module';
import { UserService } from './user.service';
import { AuthGuard } from './auth.guard.service';
import { SupabaseService } from './supabase.service';
@Module({
  imports: [GlobalModule],
  providers: [
    AuthResolver,
    AuthService,
    WeChatService,
    UserService,
    AuthGuard,
    SupabaseService,
  ],
  exports: [AuthGuard],
})
export class AuthModule {}
