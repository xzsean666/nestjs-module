# Common Modules

这个目录包含了六个独立的、可复用的公共模块：

## 1. Checkin Module (签到模块)

### 功能

- 用户每日签到
- 获取签到历史
- 签到统计
- 连续签到计算

### 使用方法

```typescript
import { Module } from '@nestjs/common';
import { CheckinModule } from '../common_modules/checkin';

@Module({
  imports: [CheckinModule],
  // ... 其他配置
})
export class YourModule {}
```

然后在你的服务或解析器中注入 `CheckinService`：

```typescript
import { CheckinService } from '../common_modules/checkin';

constructor(private readonly checkinService: CheckinService) {}
```

## 2. System Message Module (系统消息模块)

### 功能

- 创建个人消息、全局消息、广播消息
- 消息已读/未读状态管理
- 消息过期处理
- 按分类过滤消息

### 使用方法

```typescript
import { Module } from '@nestjs/common';
import { SystemMessageModule } from '../common_modules/system-message';

@Module({
  imports: [SystemMessageModule],
  // ... 其他配置
})
export class YourModule {}
```

## 3. User Meta Module (用户元数据模块)

### 功能

- 管理用户元数据
- 词汇学习记录管理
- 时间戳验证

### 使用方法

```typescript
import { Module } from '@nestjs/common';
import { UserMetaModule } from '../common_modules/user-meta';

@Module({
  imports: [UserMetaModule],
  // ... 其他配置
})
export class YourModule {}
```

## 4. Promote Code Module (促销码模块)

### 功能

- 优惠码验证和应用
- 支持百分比折扣、固定金额折扣、赠送月数
- 优惠码使用限制管理
- 优惠码统计

### 使用方法

```typescript
import { Module } from '@nestjs/common';
import { PromoteCodeModule } from '../common_modules/promote-code';

@Module({
  imports: [PromoteCodeModule],
  // ... 其他配置
})
export class YourModule {}
```

### 接口示例

```typescript
// 验证并应用优惠码
const result = await promoteCodeService.validateAndApplyPromoteCode(
  'WELCOME10',
  100, // 原价
  1, // 月数
  SubscriptionPlan.MONTHLY,
);

// 创建新优惠码（管理员功能）
const newCode = await promoteCodeService.createPromoteCode({
  code: 'SUMMER20',
  type: PromoteCodeType.PERCENTAGE,
  value: 20,
  description: '夏季优惠20%',
  isActive: true,
});
```

## 5. AI Cards Module (AI卡片生成模块)

### 功能

- AI生成学习卡片
- 支持多种词汇类型
- 用户兴趣标签个性化
- 卡片去重管理

### 使用方法

```typescript
import { Module } from '@nestjs/common';
import { AiCardsModule } from '../common_modules/ai-cards';

@Module({
  imports: [AiCardsModule],
  // ... 其他配置
})
export class YourModule {}
```

### 接口示例

```typescript
// 生成学习卡片
const result = await aiCardsService.generateStudyCards({
  userId: 'user123',
  words: ['apple', 'banana', 'orange'],
  interestTags: ['technology', 'science'],
  vocabularyType: VocabularyType.CET4,
});

// 获取用户的卡片
const userCards = await aiCardsService.getUserCards('user123');
```

## 6. Subscription Module (订阅模块)

### 功能

- 订阅创建和管理
- 支付集成（可选）
- 订阅到期提醒
- 订阅统计和报表
- 与促销码模块集成

### 使用方法

订阅模块支持两种使用方式：

#### 方式1：基础使用（仅订阅管理）

```typescript
import { Module } from '@nestjs/common';
import { SubscriptionModule } from '../common_modules/subscription';

@Module({
  imports: [
    SubscriptionModule.forRoot({
      pricing: {
        monthly_price: 29.9,
        quarterly_discount: 0.1,
        yearly_discount: 0.2,
      },
    }),
  ],
})
export class AppModule {}
```

#### 方式2：完整功能（集成其他服务）

```typescript
import { Module } from '@nestjs/common';
import { SubscriptionModule } from '../common_modules/subscription';
import { PromoteCodeService } from '../common_modules/promote-code';
import { SystemMessageService } from '../common_modules/system-message';

@Module({
  imports: [
    SubscriptionModule.forRoot(),
    // ... 其他模块
  ],
  providers: [
    {
      provide: 'PromoteCodeService',
      useClass: PromoteCodeService,
    },
    {
      provide: 'MessageService',
      useClass: SystemMessageService,
    },
    // 可选：支付服务
    {
      provide: 'PaymentService',
      useClass: YourPaymentService,
    },
  ],
})
export class AppModule {}
```

### 接口示例

```typescript
// 创建订阅
const subscription = await subscriptionService.createSubscription({
  user_id: 'user123',
  months_count: 3,
  plan: SubscriptionPlan.QUARTERLY,
  promote_code: 'WELCOME10',
});

// 检查用户是否订阅
const isSubscribed = await subscriptionService.isUserSubscribed('user123');

// 获取订阅统计
const stats = await subscriptionService.getSubscriptionStats();
```

### 定时任务服务

订阅模块还提供了定时任务服务，用于自动化管理：

```typescript
import { SubscriptionCronService } from '../common_modules/subscription/subscription-cron.service';

// 在你的定时任务模块中
@Cron('0 0 * * *') // 每天凌晨执行
async dailyCheck() {
  await this.subscriptionCronService.dailySubscriptionCheck();
}
```

## 依赖要求

所有这些模块都依赖于 `DBService`，因此在使用前请确保：

1. 已经在全局模块中导出了 `DBService`
2. 数据库表已经正确初始化

## 模块间的协作

这些模块设计为相对独立，但可以通过以下方式协作：

1. **订阅模块 + 促销码模块**：订阅创建时自动应用优惠码
2. **订阅模块 + 系统消息模块**：自动发送订阅到期提醒
3. **AI卡片模块 + 用户元数据模块**：根据用户兴趣生成个性化内容
4. **签到模块 + 系统消息模块**：签到成功后发送通知

## 完整示例

下面是一个在用户模块中使用所有公共模块的完整示例：

```typescript
// user.module.ts
import { Module } from '@nestjs/common';
import { UserResolver } from './user.resolver';
import { CheckinModule } from '../common_modules/checkin';
import { SystemMessageModule } from '../common_modules/system-message';
import { UserMetaModule } from '../common_modules/user-meta';
import { PromoteCodeModule } from '../common_modules/promote-code';
import { AiCardsModule } from '../common_modules/ai-cards';
import { SubscriptionModule } from '../common_modules/subscription';

@Module({
  imports: [
    CheckinModule,
    SystemMessageModule,
    UserMetaModule,
    PromoteCodeModule,
    AiCardsModule,
    SubscriptionModule.forFeature(),
  ],
  providers: [UserResolver],
})
export class UserModule {}
```

```typescript
// user.resolver.ts
import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AuthGuard, CurrentUser } from '../common/auth.guard.service';
import { CheckinService } from '../common_modules/checkin';
import { SystemMessageService } from '../common_modules/system-message';
import { UserMetaService } from '../common_modules/user-meta';
import { PromoteCodeService } from '../common_modules/promote-code';
import { AiCardsService } from '../common_modules/ai-cards';
import { SubscriptionService } from '../common_modules/subscription';

@Resolver('User')
@UseGuards(AuthGuard)
export class UserResolver {
  constructor(
    private readonly checkinService: CheckinService,
    private readonly systemMessageService: SystemMessageService,
    private readonly userMetaService: UserMetaService,
    private readonly promoteCodeService: PromoteCodeService,
    private readonly aiCardsService: AiCardsService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  // ... 你的解析器方法
}
```
