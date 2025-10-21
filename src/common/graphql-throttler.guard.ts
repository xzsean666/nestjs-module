import { ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Reflector } from '@nestjs/core';

@Injectable()
export class GraphQLThrottlerGuard extends ThrottlerGuard {
  constructor(
    private readonly _options: any,
    private readonly _storageService: any,
    private readonly _reflector: Reflector,
  ) {
    super(_options, _storageService, _reflector);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 检查是否跳过节流 - 使用从日志中找到的正确键
    const skipThrottle = this._reflector.getAllAndOverride<boolean>(
      'THROTTLER:SKIPdefault',
      [context.getHandler(), context.getClass()],
    );

    if (skipThrottle) {
      return true;
    }

    return super.canActivate(context);
  }

  protected getRequestResponse(context: ExecutionContext) {
    // 检查是否为GraphQL请求
    const gqlContext = GqlExecutionContext.create(context);
    const isGraphQL = gqlContext.getType() === 'graphql';

    if (isGraphQL) {
      // GraphQL请求 - 从上下文获取request对象
      const ctx = gqlContext.getContext();
      return { req: ctx.req, res: ctx.res || ctx.req.res };
    } else {
      // REST API请求 - 使用默认处理
      const http = context.switchToHttp();
      return { req: http.getRequest(), res: http.getResponse() };
    }
  }

  protected async getTracker(req: Record<string, any>): Promise<string> {
    // 从请求中提取客户端标识符（IP地址）
    return (
      req.ip ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      'unknown'
    );
  }
}
