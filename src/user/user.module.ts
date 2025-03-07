import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserResolver } from './user.resolver';
import { GlobalModule } from '../common/global.module';

@Module({
  imports: [GlobalModule],
  providers: [UserService, UserResolver],
  exports: [UserService],
})
export class UserModule {}
