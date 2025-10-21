import { Resolver, Mutation, Args, Query } from '@nestjs/graphql';
import { AppCoreService } from './app-core.service';

// 导入 Throttler 相关装饰器

@Resolver()
export class AppCoreResolver {
  constructor(private readonly appCoreService: AppCoreService) {}
}
