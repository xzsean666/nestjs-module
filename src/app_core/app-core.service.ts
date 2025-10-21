import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';

@Injectable()
export class AppCoreService {
  private logger = new Logger(AppCoreService.name);

  constructor() {}
}
