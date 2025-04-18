import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { config } from '../config';
import { GqlExecutionContext } from '@nestjs/graphql';

@Injectable()
export class AdminAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = this.getRequest(context);
    const adminAuthCode = request.headers['x-admin-auth-code'];

    if (!adminAuthCode) {
      throw new UnauthorizedException('Admin authentication code is required');
    }

    if (adminAuthCode !== config.auth.ADMIN_AUTH_CODE) {
      throw new UnauthorizedException('Invalid admin authentication code');
    }
    return true;
  }

  private getRequest(context: ExecutionContext) {
    if (context.getType() === 'http') {
      return context.switchToHttp().getRequest();
    } else if (context.getType<'graphql'>() === 'graphql') {
      const gqlContext = GqlExecutionContext.create(context);
      return gqlContext.getContext().req;
    }
  }
}
