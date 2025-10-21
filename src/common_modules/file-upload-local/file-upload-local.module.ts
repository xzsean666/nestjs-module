import { Module } from '@nestjs/common';
import { FileUploadLocalService } from './file-upload-local.service';
import { FileUploadLocalController } from './file-upload-local.controller';

@Module({
  controllers: [FileUploadLocalController],
  providers: [FileUploadLocalService],
  exports: [FileUploadLocalService],
})
export class FileUploadLocalModule {}
