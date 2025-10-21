# 本地文件上传服务

基于NestJS的**极简高性能**本地文件上传服务，采用统一的MD5二级目录存储结构，支持文件去重和流式上传。

## 🎯 核心特性

- ✅ **极简API设计** - 只需3个参数：文件、文件名、上传者
- ✅ **统一存储策略** - 所有文件采用MD5二级目录结构存储
- ✅ **智能文件去重** - 基于MD5哈希自动检测和复用相同文件
- ✅ **流式上传支持** - 适合大文件上传，不占用过多内存
- ✅ **多种MD5计算策略** - 根据文件大小自动选择最优计算方法
- ✅ **完整的元数据管理** - SQLite数据库存储文件元信息

## 📂 统一存储结构

### MD5二级目录结构

所有文件统一采用基于MD5哈希值的二级目录结构：

```
uploads/
├── a7/                     # MD5前两位
│   ├── b8/                 # MD5第3-4位
│   │   ├── a7b8d9c4e3f8a1b2c5d6e7f8g9h0i1j2.jpg
│   │   └── a7b8f1e2d3c4b5a6987654321abcdef0.pdf
│   ├── c2/
│   │   └── a7c2e8f7a6b5c4d3e2f1a0b9c8d7e6f5.txt
│   └── ...
├── b3/
│   ├── d4/
│   │   └── b3d4c8e7f6a5b4c3d2e1f0a9b8c7d6e5.png
│   └── e9/
│       └── b3e9a7b8c6d5e4f3a2b1c0d9e8f7a6b5.mp4
└── .temp/                  # 临时文件目录
```

### 存储优势

1. **文件分布均匀** - 256个一级目录 × 256个二级目录 = 65,536个可能的存储位置
2. **零配置** - 无需任何配置，开箱即用
3. **快速文件定位** - 基于MD5哈希的确定性路径
4. **自动去重机制** - 相同内容文件自动存储在同一位置
5. **良好的可扩展性** - 理论上可存储无限量文件

## 🚀 极简使用方法

### 基本上传

```typescript
import { FileUploadLocalService } from './file-upload-local.service';

const fileUploadService = new FileUploadLocalService();

// 极简上传 - 只需3个参数
const fileBuffer = Buffer.from('file content');
const result = await fileUploadService.uploadFile(
  fileBuffer, // 文件内容
  'example.txt', // 原始文件名
  'user123', // 上传者（可选）
);

console.log(result);
// 输出:
// {
//   id: 'a7b8d9c4e3f8a1b2c5d6e7f8g9h0i1j2_1735123456789',
//   filePath: 'uploads/a7/b8/a7b8d9c4e3f8a1b2c5d6e7f8g9h0i1j2.txt',
//   fileName: 'a7b8d9c4e3f8a1b2c5d6e7f8g9h0i1j2.txt',
//   size: 12,
//   md5Hash: 'a7b8d9c4e3f8a1b2c5d6e7f8g9h0i1j2',
//   isExisting: false,
//   metadata: { ... }
// }
```

### 流式上传（大文件）

```typescript
import { createReadStream } from 'fs';

// 大文件流式上传
const fileStream = createReadStream('large-file.mp4');
const result = await fileUploadService.uploadFileStream(
  fileStream, // 文件流
  'large-file.mp4', // 原始文件名
  'user123', // 上传者（可选）
);
```

### 不需要上传者信息

```typescript
// 上传者参数是可选的
const result = await fileUploadService.uploadFile(
  buffer,
  'photo.jpg',
  // 不传uploadedBy参数
);
```

## 📊 性能优化

### MD5计算策略

服务会根据文件大小自动选择最优的MD5计算方法：

- **小文件 (≤10MB)**: 同步分块处理
- **大文件 (10MB-50MB)**: 异步分块处理，避免阻塞事件循环
- **超大文件 (>50MB)**: 流式处理，内存占用最小

### 文件去重机制

```typescript
// 上传相同内容的文件，第二次会自动复用
const file1 = await fileUploadService.uploadFile(buffer, 'file1.txt', 'user1');
const file2 = await fileUploadService.uploadFile(buffer, 'file2.txt', 'user2');

console.log(file1.isExisting); // false (首次上传)
console.log(file2.isExisting); // true (复用已存在文件)
console.log(file1.filePath === file2.filePath); // true (相同存储路径)
```

## 🔍 文件管理

### 查询文件

```typescript
// 根据ID获取文件元数据
const metadata = await fileUploadService.getFileMetadata('file-id');

// 根据MD5获取文件
const file = await fileUploadService.getFileByMD5('a7b8d9c4e3f8...');

// 读取文件内容
const content = await fileUploadService.readFile('uploads/a7/b8/file.txt');

// 列出所有文件
const files = await fileUploadService.listFiles(100);
```

### 删除文件

```typescript
// 安全删除：只有当没有其他引用时才删除物理文件
const deleted = await fileUploadService.deleteFile('file-id');
```

## 🗄️ 数据库结构

使用SQLite存储文件元数据：

```typescript
interface FileMetadata {
  id: string; // 格式: md5_timestamp
  originalName: string; // 原始文件名
  fileName: string; // 存储时的文件名 (MD5.ext)
  filePath: string; // 完整文件路径
  mimeType: string; // MIME类型
  size: number; // 文件大小（字节）
  md5Hash: string; // MD5哈希值
  uploadedAt: Date; // 上传时间
  uploadedBy?: string; // 上传者
}
```

## 📈 统计信息

在10,000个文件的模拟测试中：

- **目录分布**: 平均每个一级目录包含39个文件
- **查找效率**: O(1)时间复杂度定位文件
- **存储效率**: 自动去重节省存储空间
- **性能表现**: 即使在大量文件情况下仍保持高性能

## 🎯 设计理念

### 极简原则

- **零配置** - 无需任何配置文件或选项
- **统一策略** - 所有文件采用相同的存储结构
- **开箱即用** - 安装即可使用，无需额外设置

### 统一性

- **文件命名**: 统一使用MD5哈希值
- **目录结构**: 统一使用二级目录结构
- **存储位置**: 基于内容哈希的确定性位置

## 🔧 运行示例

```bash
# 运行存储结构演示
npx ts-node src/common_modules/file-upload-local/examples/storage-structure-example.ts
```

## 📝 注意事项

- 文件名始终为MD5哈希值+扩展名（如：`a7b8d9c4e3f8...jpg`）
- 文件路径始终为二级目录结构（如：`uploads/a7/b8/`）
- 确保有足够的磁盘空间存储文件
- 定期备份元数据数据库（`db/file_metadata.db`）
- 临时文件目录`.temp`可能包含未完成的上传，建议定期清理
- 文件删除采用安全策略，只有当没有其他引用时才删除物理文件

## 🎉 极简API总结

```typescript
// 仅需的API方法
class FileUploadLocalService {
  // Buffer上传
  async uploadFile(
    file: Buffer,
    originalName: string,
    uploadedBy?: string,
  ): Promise<FileUploadResult>;

  // 流式上传
  async uploadFileStream(
    stream: Readable,
    originalName: string,
    uploadedBy?: string,
  ): Promise<FileUploadResult>;

  // 文件管理
  async getFileMetadata(id: string): Promise<FileMetadata | null>;
  async getFileByMD5(md5Hash: string): Promise<FileMetadata | null>;
  async readFile(filePath: string): Promise<Buffer>;
  async deleteFile(id: string): Promise<boolean>;
  async listFiles(limit?: number): Promise<FileMetadata[]>;
}
```

**就是这么简单！** 🎉
