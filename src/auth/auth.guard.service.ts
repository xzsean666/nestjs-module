import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { JWTHelper } from 'src/helpers/sdk';
import { config } from 'src/config';

export const CurrentUser = createParamDecorator(
  (data: unknown, context: ExecutionContext) => {
    const ctx = GqlExecutionContext.create(context);
    return ctx.getContext().req.user;
  },
);

// REST API专用的CurrentUser装饰器
export const CurrentRestUser = createParamDecorator(
  (data: unknown, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest();
    return request.user;
  },
);

export const CheckAdmin = createParamDecorator(
  (data: unknown, context: ExecutionContext) => {
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;
    const adminAuthCode = request.headers['admin_auth_code'];

    if (!adminAuthCode || adminAuthCode !== config.auth.ADMIN_AUTH_CODE) {
      throw new UnauthorizedException('Unauthorized: Invalid Admin Auth Code');
    }
    return true;
  },
);

@Injectable()
export class AuthGuard implements CanActivate {
  private jwtHelper: JWTHelper;
  constructor() {
    this.jwtHelper = new JWTHelper(config.auth.JWT_SECRET);
  }

  canActivate(context: ExecutionContext): boolean {
    // 检查是否为GraphQL请求
    const gqlContext = GqlExecutionContext.create(context);
    const isGraphQL = gqlContext.getType() === 'graphql';

    let req: any;

    if (isGraphQL) {
      // GraphQL请求
      req = gqlContext.getContext().req;
    } else {
      // REST API请求
      req = context.switchToHttp().getRequest();
    }

    const token = this.extractTokenFromHeader(req);

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    try {
      const decoded = this.jwtHelper.verifyToken(token);
      req['user'] = decoded;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const authHeader = request.headers.authorization;
    const cleanHeader = authHeader?.replace(/"/g, '');
    const [type, token] = cleanHeader?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
