import { Module } from '@nestjs/common';
import { UserResolver } from './user.resolver';
import { UserService } from './user.service';
import { DBService } from '../common/db.service';
import { CheckinService } from './checkin.service';
import { SystemMessageService } from './systemMessage.service';

@Module({
  providers: [
    UserResolver,
    UserService,
    DBService,
    CheckinService,
    SystemMessageService,
  ],
  exports: [SystemMessageService],
})
export class UserModule {}
