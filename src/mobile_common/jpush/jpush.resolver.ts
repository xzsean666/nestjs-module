import {
  Resolver,
  Mutation,
  Query,
  Args,
  Field,
  ObjectType,
  InputType,
} from '@nestjs/graphql';
import { Injectable, Logger } from '@nestjs/common';
import { JpushService, Platform, Audience } from './jpush.service';

// GraphQL 输入类型
@InputType()
export class PushToAllInput {
  @Field()
  alert: string;

  @Field(() => String, { defaultValue: 'all' })
  platform: Platform;

  @Field(() => String, { nullable: true })
  extras?: string; // JSON字符串
}

@InputType()
export class PushToAliasInput {
  @Field(() => [String])
  aliases: string[];

  @Field()
  alert: string;

  @Field(() => String, { defaultValue: 'all' })
  platform: Platform;

  @Field(() => String, { nullable: true })
  extras?: string; // JSON字符串
}

@InputType()
export class PushToTagsInput {
  @Field(() => [String])
  tags: string[];

  @Field()
  alert: string;

  @Field(() => String, { defaultValue: 'all' })
  platform: Platform;

  @Field(() => String, { nullable: true })
  extras?: string; // JSON字符串
}

@InputType()
export class PushCustomMessageInput {
  @Field(() => [String])
  aliases: string[];

  @Field()
  msgContent: string;

  @Field({ nullable: true })
  title?: string;

  @Field(() => String, { defaultValue: 'all' })
  platform: Platform;

  @Field(() => String, { nullable: true })
  extras?: string; // JSON字符串
}

@InputType()
export class PushRichNotificationAndroidInput {
  @Field(() => [String])
  aliases: string[];

  @Field()
  alert: string;

  @Field()
  title: string;

  @Field({ nullable: true })
  bigText?: string;

  @Field({ nullable: true })
  bigPicPath?: string;

  @Field(() => String, { nullable: true })
  extras?: string; // JSON字符串
}

@InputType()
export class PushNotificationIOSInput {
  @Field(() => [String])
  aliases: string[];

  @Field()
  alert: string;

  @Field({ nullable: true })
  badge?: number;

  @Field({ nullable: true })
  sound?: string;

  @Field(() => String, { nullable: true })
  extras?: string; // JSON字符串
}

@InputType()
export class BatchPushInput {
  @Field(() => [String])
  aliases: string[];

  @Field()
  alert: string;

  @Field(() => String, { defaultValue: 'all' })
  platform: Platform;

  @Field(() => Number, { defaultValue: 1000 })
  batchSize: number;

  @Field(() => String, { nullable: true })
  extras?: string; // JSON字符串
}

// GraphQL 输出类型
@ObjectType()
export class PushResponse {
  @Field()
  sendno: string;

  @Field()
  msgId: string;

  @Field()
  success: boolean;

  @Field({ nullable: true })
  message?: string;
}

@ObjectType()
export class BatchPushResponse {
  @Field(() => [PushResponse])
  results: PushResponse[];

  @Field()
  totalBatches: number;

  @Field()
  totalUsers: number;

  @Field()
  success: boolean;

  @Field({ nullable: true })
  message?: string;
}

@ObjectType()
export class PushStatistics {
  @Field()
  msgId: string;

  @Field(() => String)
  data: string; // JSON字符串，包含统计数据
}

@ObjectType()
export class PushMessageStatus {
  @Field()
  msgId: string;

  @Field(() => String)
  status: string; // JSON字符串，包含状态数据
}

@ObjectType()
export class ConfigValidationResult {
  @Field()
  isValid: boolean;

  @Field({ nullable: true })
  message?: string;
}

@Resolver()
@Injectable()
export class JpushResolver {
  private readonly logger = new Logger(JpushResolver.name);

  constructor(private readonly jpushService: JpushService) {}

  /**
   * 解析JSON字符串为对象
   */
  private parseExtras(extras?: string): Record<string, any> | undefined {
    if (!extras) return undefined;
    try {
      return JSON.parse(extras);
    } catch (error) {
      this.logger.warn(`Failed to parse extras JSON: ${extras}`);
      return undefined;
    }
  }

  /**
   * 向所有用户推送通知
   */
  @Mutation(() => PushResponse)
  async pushToAll(@Args('input') input: PushToAllInput): Promise<PushResponse> {
    try {
      const extras = this.parseExtras(input.extras);
      const result = await this.jpushService.pushToAll(
        input.alert,
        input.platform,
        extras,
      );

      return {
        sendno: result.sendno,
        msgId: result.msg_id,
        success: true,
        message: 'Push sent successfully to all users',
      };
    } catch (error) {
      this.logger.error(`Push to all failed: ${error.message}`);
      return {
        sendno: '',
        msgId: '',
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * 向指定别名推送通知
   */
  @Mutation(() => PushResponse)
  async pushToAlias(
    @Args('input') input: PushToAliasInput,
  ): Promise<PushResponse> {
    try {
      const extras = this.parseExtras(input.extras);
      const result = await this.jpushService.pushToAlias(
        input.aliases,
        input.alert,
        input.platform,
        extras,
      );

      return {
        sendno: result.sendno,
        msgId: result.msg_id,
        success: true,
        message: `Push sent successfully to ${input.aliases.length} users`,
      };
    } catch (error) {
      this.logger.error(`Push to alias failed: ${error.message}`);
      return {
        sendno: '',
        msgId: '',
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * 向指定标签推送通知
   */
  @Mutation(() => PushResponse)
  async pushToTags(
    @Args('input') input: PushToTagsInput,
  ): Promise<PushResponse> {
    try {
      const extras = this.parseExtras(input.extras);
      const result = await this.jpushService.pushToTags(
        input.tags,
        input.alert,
        input.platform,
        extras,
      );

      return {
        sendno: result.sendno,
        msgId: result.msg_id,
        success: true,
        message: `Push sent successfully to tags: ${input.tags.join(', ')}`,
      };
    } catch (error) {
      this.logger.error(`Push to tags failed: ${error.message}`);
      return {
        sendno: '',
        msgId: '',
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * 发送自定义消息
   */
  @Mutation(() => PushResponse)
  async pushCustomMessage(
    @Args('input') input: PushCustomMessageInput,
  ): Promise<PushResponse> {
    try {
      const extras = this.parseExtras(input.extras);
      const audience: Audience = { alias: input.aliases };
      const result = await this.jpushService.sendMessage(
        audience,
        input.msgContent,
        input.title,
        input.platform,
        extras,
      );

      return {
        sendno: result.sendno,
        msgId: result.msg_id,
        success: true,
        message: `Custom message sent successfully to ${input.aliases.length} users`,
      };
    } catch (error) {
      this.logger.error(`Send custom message failed: ${error.message}`);
      return {
        sendno: '',
        msgId: '',
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * 发送Android富媒体通知
   */
  @Mutation(() => PushResponse)
  async pushRichNotificationAndroid(
    @Args('input') input: PushRichNotificationAndroidInput,
  ): Promise<PushResponse> {
    try {
      const extras = this.parseExtras(input.extras);
      const audience: Audience = { alias: input.aliases };
      const result = await this.jpushService.pushRichNotificationAndroid(
        audience,
        input.alert,
        input.title,
        input.bigText,
        input.bigPicPath,
        extras,
      );

      return {
        sendno: result.sendno,
        msgId: result.msg_id,
        success: true,
        message: `Rich notification sent successfully to ${input.aliases.length} Android users`,
      };
    } catch (error) {
      this.logger.error(
        `Push rich notification Android failed: ${error.message}`,
      );
      return {
        sendno: '',
        msgId: '',
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * 发送iOS通知
   */
  @Mutation(() => PushResponse)
  async pushNotificationIOS(
    @Args('input') input: PushNotificationIOSInput,
  ): Promise<PushResponse> {
    try {
      const extras = this.parseExtras(input.extras);
      const audience: Audience = { alias: input.aliases };
      const result = await this.jpushService.pushNotificationIOS(
        audience,
        input.alert,
        input.badge,
        input.sound,
        extras,
      );

      return {
        sendno: result.sendno,
        msgId: result.msg_id,
        success: true,
        message: `iOS notification sent successfully to ${input.aliases.length} users`,
      };
    } catch (error) {
      this.logger.error(`Push notification iOS failed: ${error.message}`);
      return {
        sendno: '',
        msgId: '',
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * 批量推送
   */
  @Mutation(() => BatchPushResponse)
  async batchPush(
    @Args('input') input: BatchPushInput,
  ): Promise<BatchPushResponse> {
    try {
      const extras = this.parseExtras(input.extras);
      const results = await this.jpushService.batchPushToAliases(
        input.aliases,
        input.alert,
        input.platform,
        input.batchSize,
        extras,
      );

      const pushResponses = results.map((result) => ({
        sendno: result.sendno,
        msgId: result.msg_id,
        success: true,
        message: 'Batch sent successfully',
      }));

      return {
        results: pushResponses,
        totalBatches: results.length,
        totalUsers: input.aliases.length,
        success: true,
        message: `Batch push completed: ${results.length} batches, ${input.aliases.length} users`,
      };
    } catch (error) {
      this.logger.error(`Batch push failed: ${error.message}`);
      return {
        results: [],
        totalBatches: 0,
        totalUsers: input.aliases.length,
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * 验证推送配置
   */
  @Query(() => ConfigValidationResult)
  async validatePushConfig(): Promise<ConfigValidationResult> {
    try {
      const isValid = await this.jpushService.validateConfig();
      return {
        isValid,
        message: isValid
          ? 'Push configuration is valid'
          : 'Push configuration is invalid',
      };
    } catch (error) {
      this.logger.error(`Config validation failed: ${error.message}`);
      return {
        isValid: false,
        message: error.message,
      };
    }
  }

  /**
   * 获取推送统计信息
   */
  @Query(() => PushStatistics)
  async getPushStatistics(
    @Args('msgIds', { type: () => [String] }) msgIds: string[],
  ): Promise<PushStatistics> {
    try {
      const stats = await this.jpushService.getReportReceived(msgIds);
      return {
        msgId: msgIds.join(','),
        data: JSON.stringify(stats),
      };
    } catch (error) {
      this.logger.error(`Get push statistics failed: ${error.message}`);
      return {
        msgId: msgIds.join(','),
        data: JSON.stringify({ error: error.message }),
      };
    }
  }

  /**
   * 获取消息状态
   */
  @Query(() => PushMessageStatus)
  async getPushMessageStatus(
    @Args('msgId') msgId: string,
    @Args('registrationIds', { type: () => [String], nullable: true })
    registrationIds?: string[],
  ): Promise<PushMessageStatus> {
    try {
      const status = await this.jpushService.getMessageStatus(
        msgId,
        registrationIds,
      );
      return {
        msgId,
        status: JSON.stringify(status),
      };
    } catch (error) {
      this.logger.error(`Get message status failed: ${error.message}`);
      return {
        msgId,
        status: JSON.stringify({ error: error.message }),
      };
    }
  }
}
