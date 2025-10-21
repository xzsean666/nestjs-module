import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
  Res,
  HttpStatus,
  HttpException,
  StreamableFile,
  Logger,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { FileUploadLocalService } from './file-upload-local.service';
import { FileMetadataDto } from './dto/file-upload.dto';
import { createReadStream } from 'fs';
import * as path from 'path';

// 定义文件类型接口
interface UploadedFileType {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

/**
 * 文件上传本地存储控制器
 * 提供文件上传、下载、删除、查询等 REST API 接口
 */
@Controller('file-upload')
export class FileUploadLocalController {
  private readonly logger = new Logger(FileUploadLocalController.name);

  constructor(
    private readonly fileUploadLocalService: FileUploadLocalService,
  ) {}

  /**
   * 上传文件
   * POST /file-upload/upload
   * @param file 上传的文件
   * @param metadata 文件元数据（可选，JSON字符串）
   * @returns 文件ID和相关信息
   */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: UploadedFileType,
    @Body('metadata') metadata?: string,
  ): Promise<{
    success: boolean;
    message: string;
    data: {
      id: string;
      originalName?: string;
      fileName?: string;
      size?: number;
      mimeType?: string;
      md5Hash?: string;
      uploadedAt?: Date;
    };
  }> {
    try {
      if (!file) {
        throw new HttpException('No file provided', HttpStatus.BAD_REQUEST);
      }

      // 解析元数据
      let metaDataObj: Record<string, any> | undefined;
      if (metadata) {
        try {
          metaDataObj = JSON.parse(metadata);
        } catch (error) {
          this.logger.warn(`Failed to parse metadata: ${error.message}`);
        }
      }

      // 上传文件
      const fileId = await this.fileUploadLocalService.uploadFile(
        file.buffer,
        file.originalname,
        metaDataObj,
      );

      // 获取文件元数据
      const fileMetadata =
        await this.fileUploadLocalService.getFileMetadata(fileId);

      return {
        success: true,
        message: 'File uploaded successfully',
        data: {
          id: fileId,
          originalName: fileMetadata?.originalName,
          fileName: fileMetadata?.fileName,
          size: fileMetadata?.size,
          mimeType: fileMetadata?.mimeType,
          md5Hash: fileMetadata?.md5Hash,
          uploadedAt: fileMetadata?.uploadedAt,
        },
      };
    } catch (error) {
      this.logger.error(`Upload failed: ${error.message}`, error.stack);
      throw new HttpException(
        error.message || 'File upload failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 获取文件元数据
   * GET /file-upload/:id/metadata
   * @param id 文件ID
   * @returns 文件元数据
   */
  @Get(':id/metadata')
  async getFileMetadata(@Param('id') id: string): Promise<{
    success: boolean;
    data: FileMetadataDto | null;
  }> {
    try {
      const metadata = await this.fileUploadLocalService.getFileMetadata(id);

      if (!metadata) {
        throw new HttpException('File not found', HttpStatus.NOT_FOUND);
      }

      return {
        success: true,
        data: metadata,
      };
    } catch (error) {
      this.logger.error(`Get metadata failed: ${error.message}`, error.stack);
      throw new HttpException(
        error.message || 'Failed to get file metadata',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 下载/读取文件
   * GET /file-upload/:id
   * @param id 文件ID
   * @param download 是否作为下载（默认false，直接显示）
   * @param res Express Response对象
   * @returns 文件流
   */
  @Get(':id')
  async getFile(
    @Param('id') id: string,
    @Query('download') download: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const filePath = await this.fileUploadLocalService.getFilePath(id);

      if (!filePath) {
        throw new HttpException('File not found', HttpStatus.NOT_FOUND);
      }

      const metadata = await this.fileUploadLocalService.getFileMetadata(id);

      if (!metadata) {
        throw new HttpException(
          'File metadata not found',
          HttpStatus.NOT_FOUND,
        );
      }

      // 设置响应头
      res.set({
        'Content-Type': metadata.mimeType,
        'Content-Length': metadata.size,
      });

      // 如果需要下载，设置 Content-Disposition
      if (download === 'true' || download === '1') {
        res.set({
          'Content-Disposition': `attachment; filename="${encodeURIComponent(metadata.originalName)}"`,
        });
      } else {
        res.set({
          'Content-Disposition': `inline; filename="${encodeURIComponent(metadata.originalName)}"`,
        });
      }

      // 创建文件流
      const fullPath = path.isAbsolute(filePath)
        ? filePath
        : path.join(process.cwd(), filePath);

      const fileStream = createReadStream(fullPath);

      return new StreamableFile(fileStream);
    } catch (error) {
      this.logger.error(`Get file failed: ${error.message}`, error.stack);
      throw new HttpException(
        error.message || 'Failed to get file',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 删除文件
   * DELETE /file-upload/:id
   * @param id 文件ID
   * @returns 删除结果
   */
  @Delete(':id')
  async deleteFile(@Param('id') id: string) {
    try {
      const result = await this.fileUploadLocalService.deleteFile(id);

      if (!result) {
        throw new HttpException('File not found', HttpStatus.NOT_FOUND);
      }

      return {
        success: true,
        message: 'File deleted successfully',
      };
    } catch (error) {
      this.logger.error(`Delete failed: ${error.message}`, error.stack);
      throw new HttpException(
        error.message || 'Failed to delete file',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 列出所有文件
   * GET /file-upload/list
   * @param limit 返回数量限制（默认100）
   * @returns 文件列表
   */
  @Get('list/all')
  async listFiles(@Query('limit') limit?: string): Promise<{
    success: boolean;
    data: FileMetadataDto[];
    total: number;
  }> {
    try {
      const limitNum = limit ? parseInt(limit, 10) : 100;

      if (isNaN(limitNum) || limitNum <= 0) {
        throw new HttpException(
          'Invalid limit parameter',
          HttpStatus.BAD_REQUEST,
        );
      }

      const files = await this.fileUploadLocalService.listFiles(limitNum);

      return {
        success: true,
        data: files,
        total: files.length,
      };
    } catch (error) {
      this.logger.error(`List files failed: ${error.message}`, error.stack);
      throw new HttpException(
        error.message || 'Failed to list files',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 检查文件是否存在（根据MD5）
   * GET /file-upload/exists/:md5
   * @param md5 文件MD5哈希值
   * @returns 是否存在
   */
  @Get('exists/:md5')
  async checkFileExists(@Param('md5') md5: string) {
    try {
      if (!md5 || md5.length !== 32) {
        throw new HttpException('Invalid MD5 hash', HttpStatus.BAD_REQUEST);
      }

      const exists = await this.fileUploadLocalService.isExist(md5);

      return {
        success: true,
        data: {
          exists,
          md5,
        },
      };
    } catch (error) {
      this.logger.error(`Check exists failed: ${error.message}`, error.stack);
      throw new HttpException(
        error.message || 'Failed to check file existence',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 根据MD5获取文件元数据
   * GET /file-upload/by-md5/:md5
   * @param md5 文件MD5哈希值
   * @returns 文件元数据
   */
  @Get('by-md5/:md5')
  async getFileByMD5(@Param('md5') md5: string): Promise<{
    success: boolean;
    data: FileMetadataDto | null;
  }> {
    try {
      if (!md5 || md5.length !== 32) {
        throw new HttpException('Invalid MD5 hash', HttpStatus.BAD_REQUEST);
      }

      const metadata =
        await this.fileUploadLocalService.getFileMetadataByMD5(md5);

      if (!metadata) {
        throw new HttpException('File not found', HttpStatus.NOT_FOUND);
      }

      return {
        success: true,
        data: metadata,
      };
    } catch (error) {
      this.logger.error(
        `Get file by MD5 failed: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        error.message || 'Failed to get file by MD5',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 根据原始文件名获取所有相关文件的元数据
   * GET /file-upload/by-name/:originalName
   * @param originalName 原始文件名（URL编码）
   * @returns 文件元数据数组
   */
  @Get('by-name/:originalName')
  async getFilesByOriginalName(
    @Param('originalName') originalName: string,
  ): Promise<{
    success: boolean;
    data: FileMetadataDto[];
    total: number;
  }> {
    try {
      // URL解码原始文件名
      const decodedName = decodeURIComponent(originalName);

      if (!decodedName) {
        throw new HttpException(
          'Original name cannot be empty',
          HttpStatus.BAD_REQUEST,
        );
      }

      const files =
        await this.fileUploadLocalService.getFilesByOriginalName(decodedName);

      return {
        success: true,
        data: files,
        total: files.length,
      };
    } catch (error) {
      this.logger.error(
        `Get files by original name failed: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        error.message || 'Failed to get files by original name',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
