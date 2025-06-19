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

@Injectable()
export class AuthGuard implements CanActivate {
  private jwtHelper: JWTHelper;
  constructor() {
    this.jwtHelper = new JWTHelper(config.auth.JWT_SECRET);
  }

  canActivate(context: ExecutionContext): boolean {
    const gqlContext = GqlExecutionContext.create(context);
    const { req } = gqlContext.getContext();

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
