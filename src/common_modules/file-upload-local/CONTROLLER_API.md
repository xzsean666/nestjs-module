# File Upload Local Controller API 文档

## 概述

本 Controller 提供了文件上传、下载、删除、查询等 REST API 接口，适用于本地文件存储场景。

## API 端点

### 1. 上传文件

**端点**: `POST /file-upload/upload`

**请求格式**: `multipart/form-data`

**参数**:

- `file` (required): 上传的文件
- `metadata` (optional): 文件元数据，JSON 字符串格式

**示例请求**:

```bash
curl -X POST http://localhost:3000/file-upload/upload \
  -F "file=@/path/to/your/file.jpg" \
  -F "metadata={\"description\":\"测试文件\",\"category\":\"image\"}"
```

**响应示例**:

```json
{
  "success": true,
  "message": "File uploaded successfully",
  "data": {
    "id": "a7b8c9d0e1f2g3h4_1697123456789",
    "originalName": "file.jpg",
    "fileName": "a7b8c9d0e1f2g3h4.jpg",
    "size": 102400,
    "mimeType": "image/jpeg",
    "md5Hash": "a7b8c9d0e1f2g3h4",
    "uploadedAt": "2023-10-11T12:34:56.789Z"
  }
}
```

---

### 2. 获取文件元数据

**端点**: `GET /file-upload/:id/metadata`

**参数**:

- `id` (path): 文件 ID

**示例请求**:

```bash
curl http://localhost:3000/file-upload/a7b8c9d0e1f2g3h4_1697123456789/metadata
```

**响应示例**:

```json
{
  "success": true,
  "data": {
    "id": "a7b8c9d0e1f2g3h4_1697123456789",
    "originalName": "file.jpg",
    "fileName": "a7b8c9d0e1f2g3h4.jpg",
    "filePath": "uploads/a7/b8/a7b8c9d0e1f2g3h4.jpg",
    "mimeType": "image/jpeg",
    "size": 102400,
    "md5Hash": "a7b8c9d0e1f2g3h4",
    "uploadedAt": "2023-10-11T12:34:56.789Z"
  }
}
```

---

### 3. 下载/查看文件

**端点**: `GET /file-upload/:id`

**参数**:

- `id` (path): 文件 ID
- `download` (query, optional): 是否作为下载（true/1 表示下载，默认为预览）

**示例请求**:

预览文件:

```bash
curl http://localhost:3000/file-upload/a7b8c9d0e1f2g3h4_1697123456789
```

下载文件:

```bash
curl http://localhost:3000/file-upload/a7b8c9d0e1f2g3h4_1697123456789?download=true
```

**响应**: 返回文件流，浏览器会根据 `Content-Disposition` 头决定是预览还是下载。

---

### 4. 删除文件

**端点**: `DELETE /file-upload/:id`

**参数**:

- `id` (path): 文件 ID

**示例请求**:

```bash
curl -X DELETE http://localhost:3000/file-upload/a7b8c9d0e1f2g3h4_1697123456789
```

**响应示例**:

```json
{
  "success": true,
  "message": "File deleted successfully"
}
```

---

### 5. 列出所有文件

**端点**: `GET /file-upload/list/all`

**参数**:

- `limit` (query, optional): 返回数量限制，默认 100

**示例请求**:

```bash
curl http://localhost:3000/file-upload/list/all?limit=50
```

**响应示例**:

```json
{
  "success": true,
  "data": [
    {
      "id": "a7b8c9d0e1f2g3h4_1697123456789",
      "originalName": "file1.jpg",
      "fileName": "a7b8c9d0e1f2g3h4.jpg",
      "filePath": "uploads/a7/b8/a7b8c9d0e1f2g3h4.jpg",
      "mimeType": "image/jpeg",
      "size": 102400,
      "md5Hash": "a7b8c9d0e1f2g3h4",
      "uploadedAt": "2023-10-11T12:34:56.789Z"
    }
  ],
  "total": 1
}
```

---

### 6. 检查文件是否存在（根据 MD5）

**端点**: `GET /file-upload/exists/:md5`

**参数**:

- `md5` (path): 文件的 MD5 哈希值（32位）

**示例请求**:

```bash
curl http://localhost:3000/file-upload/exists/a7b8c9d0e1f2g3h4i5j6k7l8m9n0o1p2
```

**响应示例**:

```json
{
  "success": true,
  "data": {
    "exists": true,
    "md5": "a7b8c9d0e1f2g3h4i5j6k7l8m9n0o1p2"
  }
}
```

---

### 7. 根据 MD5 获取文件元数据

**端点**: `GET /file-upload/by-md5/:md5`

**参数**:

- `md5` (path): 文件的 MD5 哈希值（32位）

**示例请求**:

```bash
curl http://localhost:3000/file-upload/by-md5/a7b8c9d0e1f2g3h4i5j6k7l8m9n0o1p2
```

**响应示例**:

```json
{
  "success": true,
  "data": {
    "id": "a7b8c9d0e1f2g3h4_1697123456789",
    "originalName": "file.jpg",
    "fileName": "a7b8c9d0e1f2g3h4.jpg",
    "filePath": "uploads/a7/b8/a7b8c9d0e1f2g3h4.jpg",
    "mimeType": "image/jpeg",
    "size": 102400,
    "md5Hash": "a7b8c9d0e1f2g3h4i5j6k7l8m9n0o1p2",
    "uploadedAt": "2023-10-11T12:34:56.789Z"
  }
}
```

---

### 8. 根据原始文件名获取所有相关文件的元数据

**端点**: `GET /file-upload/by-name/:originalName`

**参数**:

- `originalName` (path): 原始文件名（需要 URL 编码）

**功能说明**:

该接口会返回所有具有相同原始文件名的文件的元数据。当同一个文件名被多次上传时（例如：多次上传 `test.jpg`，每次内容可能不同），系统会维护一个原始文件名到文件 ID 数组的映射关系。

**使用场景**:

- 查找特定文件名的所有历史版本
- 查看同名文件的所有上传记录
- 管理和清理重复上传的文件

**示例请求**:

```bash
# 对于文件名包含特殊字符的情况，需要 URL 编码
curl http://localhost:3000/file-upload/by-name/test.jpg

# 文件名包含中文或特殊字符
curl http://localhost:3000/file-upload/by-name/%E6%B5%8B%E8%AF%95%E6%96%87%E4%BB%B6.pdf
```

**响应示例**:

```json
{
  "success": true,
  "data": [
    {
      "id": "a7b8c9d0e1f2g3h4_1697123456789",
      "originalName": "test.jpg",
      "fileName": "a7b8c9d0e1f2g3h4.jpg",
      "filePath": "uploads/a7/b8/a7b8c9d0e1f2g3h4.jpg",
      "mimeType": "image/jpeg",
      "size": 102400,
      "md5Hash": "a7b8c9d0e1f2g3h4i5j6k7l8m9n0o1p2",
      "uploadedAt": "2023-10-11T12:34:56.789Z",
      "metaData": {
        "description": "第一次上传"
      }
    },
    {
      "id": "b8c9d0e1f2g3h4i5_1697123999999",
      "originalName": "test.jpg",
      "fileName": "b8c9d0e1f2g3h4i5.jpg",
      "filePath": "uploads/b8/c9/b8c9d0e1f2g3h4i5.jpg",
      "mimeType": "image/jpeg",
      "size": 204800,
      "md5Hash": "b8c9d0e1f2g3h4i5j6k7l8m9n0o1p2q3",
      "uploadedAt": "2023-10-11T13:45:00.000Z",
      "metaData": {
        "description": "第二次上传（修改后）"
      }
    }
  ],
  "total": 2
}
```

**空结果示例**（当没有找到该文件名的记录时）:

```json
{
  "success": true,
  "data": [],
  "total": 0
}
```

---

## 错误处理

所有接口在发生错误时会返回相应的 HTTP 状态码和错误信息：

**错误响应示例**:

```json
{
  "statusCode": 404,
  "message": "File not found"
}
```

**常见状态码**:

- `200` - 成功
- `400` - 请求参数错误
- `404` - 资源不存在
- `500` - 服务器内部错误

---

## 功能特性

1. **文件去重**: 基于 MD5 哈希值自动去重，相同文件只存储一次
2. **元数据管理**: 支持自定义文件元数据
3. **流式处理**: 支持大文件流式上传和下载
4. **安全存储**: 采用二级目录结构，避免单目录文件过多
5. **引用计数**: 删除文件时检查引用，避免误删
6. **文件名映射**: 自动维护原始文件名到文件 ID 的映射关系，支持按文件名查询所有历史版本

---

## 使用示例

### JavaScript/TypeScript (使用 axios)

```typescript
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';

// 上传文件
async function uploadFile() {
  const formData = new FormData();
  formData.append('file', fs.createReadStream('/path/to/file.jpg'));
  formData.append('metadata', JSON.stringify({ category: 'image' }));

  const response = await axios.post(
    'http://localhost:3000/file-upload/upload',
    formData,
    {
      headers: formData.getHeaders(),
    },
  );

  console.log('File ID:', response.data.data.id);
  return response.data.data.id;
}

// 下载文件
async function downloadFile(fileId: string) {
  const response = await axios.get(
    `http://localhost:3000/file-upload/${fileId}`,
    {
      responseType: 'stream',
    },
  );

  response.data.pipe(fs.createWriteStream('downloaded-file.jpg'));
}

// 根据原始文件名获取所有文件
async function getFilesByName(originalName: string) {
  const encodedName = encodeURIComponent(originalName);
  const response = await axios.get(
    `http://localhost:3000/file-upload/by-name/${encodedName}`,
  );

  console.log(`Found ${response.data.total} file(s):`, response.data.data);
  return response.data.data;
}
```

### Python (使用 requests)

```python
import requests

# 上传文件
def upload_file():
    files = {'file': open('/path/to/file.jpg', 'rb')}
    data = {'metadata': '{"category": "image"}'}

    response = requests.post('http://localhost:3000/file-upload/upload', files=files, data=data)
    file_id = response.json()['data']['id']
    print(f'File ID: {file_id}')
    return file_id

# 下载文件
def download_file(file_id):
    response = requests.get(f'http://localhost:3000/file-upload/{file_id}', stream=True)

    with open('downloaded-file.jpg', 'wb') as f:
        for chunk in response.iter_content(chunk_size=8192):
            f.write(chunk)

# 根据原始文件名获取所有文件
def get_files_by_name(original_name):
    from urllib.parse import quote
    encoded_name = quote(original_name, safe='')
    response = requests.get(f'http://localhost:3000/file-upload/by-name/{encoded_name}')

    data = response.json()
    print(f"Found {data['total']} file(s):", data['data'])
    return data['data']
```

---

## 注意事项

1. 确保 `uploads` 目录有正确的读写权限
2. 大文件上传建议调整 NestJS 的文件大小限制
3. 生产环境建议添加身份验证和授权机制
4. 建议定期清理未引用的文件以节省存储空间
