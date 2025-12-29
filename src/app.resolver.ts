import {
  Query,
  Resolver,
  ObjectType,
  Field,
  Args,
  Mutation,
} from '@nestjs/graphql';
import { DBService } from './common/db.service';
import { PGKVDatabase } from './common/db.service';
// import { SupabaseAuthGuard, CurrentUser } from './common/supabase.service';
import { UseGuards, Logger } from '@nestjs/common';

import { GraphQLJSON } from 'graphql-type-json';
import { cacheFn } from './common/cache.service';

import { AuthGuard, CurrentUser } from './auth/auth.guard.service';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { AlertMessageService } from './common/alert.message.service';

@ObjectType()
export class KeyValue {
  @Field()
  key: string;

  @Field(() => GraphQLJSON)
  value: any;
}

@ObjectType()
export class UploadFileResult {
  @Field()
  id: string;

  @Field()
  filename: string;
}

@Resolver(() => KeyValue)
export class AppResolver {
  private db: PGKVDatabase;
  private readonly logger = new Logger(AppResolver.name);
  constructor(
    private readonly dbService: DBService,
    private readonly alertMessageService: AlertMessageService,
    // private readonly fileUploadService: FileUploadLocalService,
  ) {
    this.db = dbService.getDBInstance('test');
  }
  // @Query(() => JSON, { nullable: true })
  // @UseGuards(SupabaseAuthGuard)
  // @cacheFn(1 * 60 * 60)
  // currentUser(@CurrentUser() user: User) {
  //   return user;
  // }
  @Query(() => String)
  testLogger() {
    this.logger.log('Test logger: info');
    this.logger.warn('Test logger: warn');
    this.logger.error('Test logger: error');
    this.logger.debug('Test logger: debug');
    return 'Logger test messages have been emitted (check your logs/Graylog)';
  }

  // 示例1: 跳过全局限流 - 对于健康检查或公共 API 不做限制
  @Query(() => String)
  @UseGuards()
  @SkipThrottle()
  test() {
    return 'Hello World6663';
  }

  @Query(() => String)
  @UseGuards()
  test2() {
    return 'Hello World222';
  }

  // 示例2: 自定义限流 - 管理员API，每30秒最多5次请求
  @Query(() => String)
  testadmin() {
    return 'Hello admin';
  }

  @Mutation(() => Boolean)
  sendAlert(
    @Args('message') message: string,
    @Args('alertLevel', { type: () => Number, defaultValue: 65 })
    alertLevel: number,
  ) {
    this.alertMessageService.sendAlertImmediate(message, alertLevel);
    return true;
  }

  // @Mutation(() => UploadFileResult)
  // @UseGuards(AuthGuard)
  // async uploadFile(
  //   @CurrentUser() user: any,
  //   @Args({ name: 'file', type: () => GraphQLUpload })
  //   fileUpload: FileUpload,
  // ): Promise<UploadFileResult> {
  //   try {
  //     const { filename } = fileUpload;
  //     const stream = fileUpload.createReadStream();

  //     // 将流转换为Buffer
  //     const buffer = await AppResolver.streamToBuffer(stream);

  //     // 上传文件，直接返回文件ID
  //     const id = await this.fileUploadService.uploadFile(
  //       buffer,
  //       filename,
  //       user.user_id,
  //     );

  //     return {
  //       id,
  //       filename,
  //     };
  //   } catch (error) {
  //     throw new Error(`File upload failed: ${error.message}`);
  //   }
  // }

  // private static streamToBuffer(stream: any): Promise<Buffer> {
  //   return new Promise((resolve, reject) => {
  //     const chunks: Buffer[] = [];
  //     stream.on('data', (chunk: Buffer) => chunks.push(chunk));
  //     stream.on('end', () => resolve(Buffer.concat(chunks)));
  //     stream.on('error', reject);
  //   });
  // }

  // @Query(() => GraphQLJSON)
  // async getFile(@Args('id') id: string): Promise<any> {
  //   const metadata = await this.fileUploadService.getFileMetadata(id);
  //   return metadata;
  // }

  // @Query(() => GraphQLJSON)
  // async downloadFile(@Args('id') id: string): Promise<any> {
  //   const file = await this.fileUploadService.getFileMetadata(id);
  //   return file;
  // }

  // @Mutation(() => Boolean)
  // async deleteFile(@Args('id') id: string): Promise<boolean> {
  //   return await this.fileUploadService.deleteFile(id);
  // }
}
