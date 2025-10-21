import { Injectable, Logger } from '@nestjs/common';
import { SqliteKVDatabase } from '../../helpers/sdk/index';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { Readable } from 'stream';
import { createWriteStream } from 'fs';

// 内部接口定义
interface FileMetadata {
  id: string;
  originalName: string;
  fileName: string;
  filePath: string;
  mimeType: string;
  size: number;
  md5Hash: string;
  uploadedAt: Date;
  metaData?: Record<string, any>;
}

@Injectable()
export class FileUploadLocalService {
  private readonly logger = new Logger(FileUploadLocalService.name);
  private readonly uploadDir = 'uploads';
  private readonly uploads_metadata_db: SqliteKVDatabase;
  private readonly file_name_mapping_db: SqliteKVDatabase;
  constructor() {
    this.uploads_metadata_db = new SqliteKVDatabase(
      'db/file_metadata.db',
      'meta_data',
    );
    this.file_name_mapping_db = new SqliteKVDatabase(
      'db/file_name_mapping.db',
      'file_name_mapping',
    );
  }

  /**
   * 上传文件 - 简化版本，只返回id
   * @param file 文件缓冲区
   * @param originalName 原始文件名
   * @param metaData 文件元数据对象（可选）
   * @returns 文件ID
   */
  async uploadFile(
    file: Buffer,
    originalName: string,
    metaData?: Record<string, any>,
  ): Promise<string> {
    try {
      // 计算文件MD5哈希 (根据文件大小选择最优方法)
      const md5Hash = await this.calculateOptimalMD5(file);

      // 处理文件存储和元数据
      return await this.processFileUpload(
        originalName,
        metaData,
        md5Hash,
        file.length,
        async (filePath: string) => {
          await fs.writeFile(filePath, file);
        },
      );
    } catch (error) {
      this.logger.error(`Failed to upload file: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 流式上传文件 - 简化版本，只返回id
   * @param fileStream 文件流
   * @param originalName 原始文件名
   * @param metaData 文件元数据对象（可选）
   * @returns 文件ID
   */
  async uploadFileStream(
    fileStream: Readable,
    originalName: string,
    metaData?: Record<string, any>,
  ): Promise<string> {
    let tempFilePath: string | null = null;

    try {
      // 生成临时文件路径用于计算MD5
      const tempDir = path.join(this.uploadDir, '.temp');
      await this.ensureDirectoryExists(tempDir);
      const tempFileName = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      tempFilePath = path.join(tempDir, tempFileName);

      // 流式处理：边读取边写入边计算MD5
      const { md5Hash, fileSize } = await this.processStreamWithMD5(
        fileStream,
        tempFilePath,
      );

      // 处理文件存储和元数据
      const id = await this.processFileUpload(
        originalName,
        metaData,
        md5Hash,
        fileSize,
        async (finalFilePath: string) => {
          // 移动临时文件到最终位置
          await fs.rename(tempFilePath!, finalFilePath);
          tempFilePath = null; // 标记已移动
        },
      );

      return id;
    } catch (error) {
      // 清理临时文件
      if (tempFilePath) {
        try {
          await fs.unlink(tempFilePath);
        } catch (cleanupError) {
          this.logger.warn(
            `Failed to cleanup temp file: ${cleanupError.message}`,
          );
        }
      }

      this.logger.error(
        `Failed to upload file stream: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * 根据MD5检查文件是否存在
   * @param md5Hash MD5哈希值
   * @returns 文件是否存在
   */
  async isExist(md5Hash: string): Promise<boolean> {
    try {
      // 生成目录路径
      const dir1 = md5Hash.substring(0, 2);
      const dir2 = md5Hash.substring(2, 4);
      const targetDir = path.join(this.uploadDir, dir1, dir2);

      // 检查目录是否存在
      try {
        await fs.access(targetDir);
      } catch {
        // 目录不存在，文件肯定不存在
        return false;
      }

      // 读取目录中的所有文件
      const files = await fs.readdir(targetDir);

      // 检查是否有以该MD5开头的文件（支持文件扩展名）
      // 匹配模式: md5Hash + 可选的点和扩展名
      const exists = files.some((file) => {
        return file === md5Hash || file.startsWith(`${md5Hash}.`);
      });

      if (exists) {
        this.logger.log(`File with MD5 ${md5Hash} exists in ${targetDir}`);
      }
      return exists;
    } catch (error) {
      this.logger.error(`Failed to check if file exists: ${error.message}`);
      return false;
    }
  }
  async getFilePath(id: string): Promise<string | null> {
    const metadata = await this.getFileMetadata(id);
    if (!metadata) {
      return null;
    }

    // 如果不是切片文件，直接返回文件路径
    if (!metadata.metaData?.isSliced) return metadata.filePath;

    // 如果已经有组装后的文件路径，检查文件是否存在
    if (metadata.metaData.filePath) {
      const exists = await this.fileExists(metadata.metaData.filePath);
      if (exists) {
        return metadata.metaData.filePath;
      }
    }

    // 需要组装文件
    const chunks = metadata.metaData.chunks;
    if (!chunks || !Array.isArray(chunks) || chunks.length === 0) {
      this.logger.error(`No chunks found for sliced file ${id}`);
      return null;
    }

    // 获取所有 chunk 的路径
    const chunkPaths: string[] = [];
    for (const chunkId of chunks) {
      const chunkMetadata = await this.getFileMetadataByMD5(chunkId);
      if (!chunkMetadata) {
        this.logger.error(`Chunk ${chunkId} not found for file ${id}`);
        return null;
      }
      chunkPaths.push(chunkMetadata.filePath);
    }

    // 生成组装后文件的路径（根据 hash 命名）
    const assembledFileInfo = this.generateFileInfo(
      metadata.originalName,
      metadata.md5Hash,
    );
    const assembledFilePath = assembledFileInfo.filePath;

    // 检查组装后的文件是否已存在
    const exists = await this.fileExists(assembledFilePath);
    if (!exists) {
      // 需要组装文件
      try {
        // 确保目录存在
        await this.ensureDirectoryExists(path.dirname(assembledFilePath));

        // 按顺序读取并组装文件
        const writeStream = createWriteStream(assembledFilePath);

        for (const chunkPath of chunkPaths) {
          const chunkData = await this.readFile(chunkPath);
          writeStream.write(chunkData);
        }

        // 关闭写入流
        await new Promise<void>((resolve, reject) => {
          writeStream.end(() => resolve());
          writeStream.on('error', reject);
        });

        this.logger.log(`Assembled file saved to ${assembledFilePath}`);
      } catch (error) {
        this.logger.error(
          `Failed to assemble file: ${error.message}`,
          error.stack,
        );
        return null;
      }
    } else {
      this.logger.log(`Assembled file already exists at ${assembledFilePath}`);
    }

    // 更新 metadata.metaData.filePath
    metadata.metaData.filePath = assembledFilePath;
    await this.saveMetadata(id, metadata);

    return assembledFilePath;
  }

  /**
   * 根据ID获取文件元数据
   */
  async getFileMetadata(id: string): Promise<FileMetadata | null> {
    try {
      const metadata = await this.uploads_metadata_db.get(id);
      return metadata || null;
    } catch (error) {
      this.logger.error(`Failed to get file metadata: ${error.message}`);
      return null;
    }
  }

  /**
   * 根据MD5哈希获取文件信息 (使用getWithPrefix优化查询)
   */
  async getFileMetadataByMD5(md5Hash: string): Promise<FileMetadata | null> {
    try {
      const results = await this.uploads_metadata_db.getWithPrefix(
        md5Hash + '_',
        {
          limit: 1,
        },
      );

      if (results.length > 0) {
        return results[0].value;
      }

      return null;
    } catch (error) {
      this.logger.error(`Failed to get file by MD5: ${error.message}`);
      return null;
    }
  }

  /**
   * 读取文件内容
   */
  async readFile(filePath: string): Promise<Buffer> {
    try {
      const fullPath = path.isAbsolute(filePath)
        ? filePath
        : path.join(process.cwd(), filePath);
      return await fs.readFile(fullPath);
    } catch (error) {
      this.logger.error(`Failed to read file ${filePath}: ${error.message}`);
      throw error;
    }
  }

  /**
   * 删除文件（只删除元数据，如果没有其他引用才删除物理文件）
   */
  async deleteFile(id: string): Promise<boolean> {
    try {
      const metadata = await this.getFileMetadata(id);
      if (!metadata) {
        return false;
      }

      // 删除元数据
      await this.uploads_metadata_db.delete(id);

      // 检查是否还有其他引用这个文件
      const hasOtherReferences = await this.hasOtherReferences(
        metadata.md5Hash,
        id,
      );

      if (!hasOtherReferences) {
        // 没有其他引用，删除物理文件
        try {
          await fs.unlink(metadata.filePath);
          this.logger.log(`Physical file deleted: ${metadata.filePath}`);
        } catch (error) {
          this.logger.warn(`Failed to delete physical file: ${error.message}`);
        }
      }

      return true;
    } catch (error) {
      this.logger.error(`Failed to delete file: ${error.message}`);
      throw error;
    }
  }

  /**
   * 列出所有文件元数据
   */
  async listFiles(limit: number = 100): Promise<FileMetadata[]> {
    try {
      const records = await this.uploads_metadata_db.getWithPrefix('', {
        limit,
      });

      return records.map((record) => record.value) as FileMetadata[];
    } catch (error) {
      this.logger.error(`Failed to list files: ${error.message}`);
      throw error;
    }
  }

  /**
   * 计算文件MD5哈希 (优化大文件处理)
   */
  private calculateMD5(buffer: Buffer): string {
    const hash = crypto.createHash('md5');

    // 对于大文件，分块处理以减少内存压力
    const chunkSize = 64 * 1024; // 64KB 块大小

    if (buffer.length <= chunkSize) {
      // 小文件直接处理
      return hash.update(buffer).digest('hex');
    }

    // 大文件分块处理
    for (let i = 0; i < buffer.length; i += chunkSize) {
      const chunk = buffer.subarray(i, Math.min(i + chunkSize, buffer.length));
      hash.update(chunk);
    }

    return hash.digest('hex');
  }

  /**
   * 异步计算文件MD5哈希 (用于超大文件，避免阻塞事件循环)
   */
  private async calculateMD5Async(buffer: Buffer): Promise<string> {
    const hash = crypto.createHash('md5');
    const chunkSize = 64 * 1024; // 64KB 块大小

    if (buffer.length <= chunkSize) {
      return hash.update(buffer).digest('hex');
    }

    // 超大文件异步分块处理
    for (let i = 0; i < buffer.length; i += chunkSize) {
      const chunk = buffer.subarray(i, Math.min(i + chunkSize, buffer.length));
      hash.update(chunk);

      // 每处理一定数量的块后让出控制权，避免阻塞事件循环
      if (i % (chunkSize * 100) === 0) {
        await new Promise((resolve) => setImmediate(resolve));
      }
    }

    return hash.digest('hex');
  }

  /**
   * 基于流的MD5计算 (最适合超大文件)
   */
  private calculateMD5Stream(buffer: Buffer): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('md5');

      // 创建可读流
      const readableStream = new Readable({
        read() {}, // 空实现
      });

      // 分块推送数据
      const chunkSize = 64 * 1024; // 64KB
      let offset = 0;

      const pushChunk = () => {
        if (offset >= buffer.length) {
          readableStream.push(null); // 结束流
          return;
        }

        const chunk = buffer.subarray(
          offset,
          Math.min(offset + chunkSize, buffer.length),
        );
        offset += chunkSize;
        readableStream.push(chunk);

        // 异步推送下一块，避免阻塞
        setImmediate(pushChunk);
      };

      readableStream.on('data', (chunk) => {
        hash.update(chunk);
      });

      readableStream.on('end', () => {
        resolve(hash.digest('hex'));
      });

      readableStream.on('error', reject);

      // 开始推送数据
      pushChunk();
    });
  }

  /**
   * 确保目录存在
   */
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  /**
   * 获取MIME类型
   */
  private getMimeType(fileName: string): string {
    const ext = path.extname(fileName).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx':
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.txt': 'text/plain',
      '.csv': 'text/csv',
      '.json': 'application/json',
      '.xml': 'application/xml',
      '.zip': 'application/zip',
      '.rar': 'application/x-rar-compressed',
      '.apk': 'application/vnd.android.package-archive',
      '.mp4': 'video/mp4',
      '.avi': 'video/x-msvideo',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * 保存元数据到数据库
   */
  private async saveMetadata(
    id: string,
    metadata: FileMetadata,
  ): Promise<void> {
    await this.uploads_metadata_db.put(id, metadata);
  }

  /**
   * 检查是否有其他引用 (使用getWithPrefix优化查询)
   */
  private async hasOtherReferences(
    md5Hash: string,
    excludeId: string,
  ): Promise<boolean> {
    try {
      const results = await this.uploads_metadata_db.getWithPrefix(
        md5Hash + '_',
      );

      // 检查是否有除了当前ID之外的其他引用
      return results.some((result) => result.key !== excludeId);
    } catch (error) {
      this.logger.error(`Failed to check other references: ${error.message}`);
      return false;
    }
  }

  /**
   * 检查文件是否存在
   * @param filePath 文件路径
   * @returns 文件是否存在
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 根据文件大小选择最优的MD5计算方法
   * @param file 文件缓冲区
   * @returns MD5哈希值
   */
  private async calculateOptimalMD5(file: Buffer): Promise<string> {
    if (file.length > 50 * 1024 * 1024) {
      // 超大文件 (>50MB) 使用流式处理
      this.logger.log(
        `Large file MD5 calculated using stream: ${file.length} bytes`,
      );
      return await this.calculateMD5Stream(file);
    } else if (file.length > 10 * 1024 * 1024) {
      // 大文件 (>10MB) 使用异步分块处理
      this.logger.log(`Large file MD5 calculated async: ${file.length} bytes`);
      return await this.calculateMD5Async(file);
    } else {
      // 小文件直接同步处理
      return this.calculateMD5(file);
    }
  }

  /**
   * 流式处理文件并计算MD5
   * @param fileStream 文件流
   * @param tempFilePath 临时文件路径
   * @returns MD5哈希值和文件大小
   */
  private async processStreamWithMD5(
    fileStream: Readable,
    tempFilePath: string,
  ): Promise<{ md5Hash: string; fileSize: number }> {
    const hash = crypto.createHash('md5');
    let fileSize = 0;
    const writeStream = createWriteStream(tempFilePath);

    // 流式处理：边读取边写入边计算MD5
    fileStream.on('data', (chunk: Buffer) => {
      hash.update(chunk);
      fileSize += chunk.length;
      writeStream.write(chunk);
    });

    fileStream.on('end', () => {
      writeStream.end();
    });

    fileStream.on('error', (error) => {
      writeStream.destroy();
      throw error;
    });

    // 等待写入完成
    await new Promise<void>((resolve, reject) => {
      writeStream.on('finish', () => resolve());
      writeStream.on('error', reject);
    });

    const md5Hash = hash.digest('hex');
    this.logger.log(
      `Stream upload MD5 calculated: ${md5Hash}, size: ${fileSize} bytes`,
    );

    return { md5Hash, fileSize };
  }

  /**
   * 处理文件上传的核心逻辑（去重逻辑和元数据保存）
   * @param originalName 原始文件名
   * @param metaData 文件元数据对象
   * @param md5Hash MD5哈希值
   * @param fileSize 文件大小
   * @param saveFile 保存文件的回调函数
   * @returns 文件ID
   */
  private async processFileUpload(
    originalName: string,
    metaData: Record<string, any> | undefined,
    md5Hash: string,
    fileSize: number,
    saveFile: (filePath: string) => Promise<void>,
  ): Promise<string> {
    // 基于MD5生成文件信息和路径
    const fileInfo = this.generateFileInfo(originalName, md5Hash);
    const fileName = fileInfo.fileName;
    const filePath = fileInfo.filePath;

    // 检查文件是否已存在
    const existingFile = await this.getFileMetadataByMD5(md5Hash);
    let isExisting = false;

    if (existingFile && (await this.fileExists(existingFile.filePath))) {
      // 文件已存在且物理文件也存在，复用现有文件
      isExisting = true;
      this.logger.log(
        `File with MD5 ${md5Hash} already exists, reusing existing file at ${existingFile.filePath}`,
      );
    } else {
      // 文件不存在或物理文件丢失，需要保存新文件
      await this.ensureDirectoryExists(path.dirname(filePath));
      await saveFile(filePath);
      this.logger.log(`File saved to ${filePath}`);
    }

    // 生成md5_timestamp格式的唯一标识
    const timestamp = Date.now();
    const id = `${md5Hash}_${timestamp}`;

    const metadata: FileMetadata = {
      id,
      originalName,
      fileName: path.basename(fileName),
      filePath: isExisting ? existingFile!.filePath : filePath,
      mimeType: this.getMimeType(originalName),
      size: fileSize,
      md5Hash,
      uploadedAt: new Date(),
      ...(metaData && { metaData }),
    };

    // 保存元数据到数据库
    await this.saveMetadata(id, metadata);

    // 更新 file_name_mapping_db: originalName -> fileId[]
    await this.updateFileNameMapping(originalName, id);

    return id;
  }

  /**
   * 生成文件信息 (统一使用MD5二级目录结构)
   * @param originalName 原始文件名
   * @param md5Hash MD5哈希值
   * @returns 文件信息
   */
  private generateFileInfo(
    originalName: string,
    md5Hash: string,
  ): { fileName: string; filePath: string } {
    const ext = path.extname(originalName);

    // 统一使用MD5作为文件名
    const fileName = `${md5Hash}${ext}`;

    // 统一使用MD5二级目录结构
    // 格式: uploads/a7/b8/a7b8d9c4e3f8...
    const dir1 = md5Hash.substring(0, 2); // 前两个字符
    const dir2 = md5Hash.substring(2, 4); // 第三四个字符
    const relativePath = path.join(this.uploadDir, dir1, dir2, fileName);

    return {
      fileName,
      filePath: relativePath,
    };
  }

  /**
   * 更新文件名映射关系
   * @param originalName 原始文件名
   * @param fileId 文件ID
   */
  private async updateFileNameMapping(
    originalName: string,
    fileId: string,
  ): Promise<void> {
    try {
      // 获取当前 originalName 对应的 fileId 数组
      const existingFileIds =
        (await this.file_name_mapping_db.get<string[]>(originalName)) || [];

      // 添加新的 fileId 到数组中（避免重复）
      if (!existingFileIds.includes(fileId)) {
        existingFileIds.push(fileId);
      }

      // 保存更新后的数组
      await this.file_name_mapping_db.put(originalName, existingFileIds);

      this.logger.log(
        `Updated file name mapping for "${originalName}", now has ${existingFileIds.length} file(s)`,
      );
    } catch (error) {
      this.logger.error(`Failed to update file name mapping: ${error.message}`);
      throw error;
    }
  }

  /**
   * 根据原始文件名获取所有相关文件的元数据
   * @param originalName 原始文件名
   * @returns 文件元数据数组
   */
  async getFilesByOriginalName(originalName: string): Promise<FileMetadata[]> {
    try {
      // 从 file_name_mapping_db 获取所有相关的 fileId
      const fileIds =
        (await this.file_name_mapping_db.get<string[]>(originalName)) || [];

      if (fileIds.length === 0) {
        return [];
      }

      // 获取所有文件的元数据
      const metadataList: FileMetadata[] = [];
      for (const fileId of fileIds) {
        const metadata = await this.getFileMetadata(fileId);
        if (metadata) {
          metadataList.push(metadata);
        }
      }

      this.logger.log(
        `Found ${metadataList.length} file(s) for originalName: "${originalName}"`,
      );
      return metadataList;
    } catch (error) {
      this.logger.error(
        `Failed to get files by original name: ${error.message}`,
      );
      throw error;
    }
  }
}
