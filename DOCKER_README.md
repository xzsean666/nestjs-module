# Docker 部署指南

本项目已优化了Dockerfile，采用了体积挂载的方式来运行NestJS应用，避免在镜像构建时复制项目代码。

## 架构优化

### Dockerfile 优化特点

- ✅ 只安装系统依赖和Node.js依赖
- ✅ 不复制项目代码，通过volume挂载
- ✅ 创建智能启动脚本（startup.sh）
- ✅ 支持PM2进程管理
- ✅ 支持自动构建和依赖安装
- ✅ 使用bash脚本，功能更强大

### docker-compose.yml 优化特点

- ✅ 正确挂载当前目录到容器
- ✅ 排除node_modules避免冲突
- ✅ 挂载日志目录便于查看
- ✅ 环境变量配置灵活

## 快速开始

### 1. 创建环境变量文件

创建 `.env` 文件（复制以下内容并根据需要修改）：

```bash
# Docker 容器配置
PROJECT_NAME=nestjs-module

# 应用基本配置
PORT=3000
NODE_ENV=production

# PM2 配置
PM2_INSTANCES=1                    # PM2 实例数量 (数字或 'max' 表示使用所有 CPU 核心)
PM2_MAX_MEMORY=4096M              # 最大内存限制

# PM2 日志配置 (可选)
PM2_LOG_FILE=logs/app.log         # 合并日志文件路径
PM2_ERROR_FILE=logs/error.log     # 错误日志文件路径
PM2_OUT_FILE=logs/out.log         # 输出日志文件路径

# Docker 启动配置
USE_PM2=true                      # 是否使用PM2管理进程
BUILD_ENABLED=true                # 是否在启动时构建项目
APP_MAIN_SCRIPT=dist/main.js      # 主应用脚本路径

# 时区设置
TIMEZONE=Asia/Shanghai

# Cron 配置 (可选)
CRON_ENABLED=false                # 是否启用定时任务
CRON_JOBS=""                      # 定时任务配置，多个任务用分号分隔

# 数据库配置 (根据实际情况修改)
DATABASE_URL=postgresql://user:password@localhost:5432/mydb

# JWT 配置
JWT_SECRET=your-jwt-secret-here

# API 密钥
API_KEY=your-api-key-here

# Supabase 配置 (如果使用)
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

### 2. 构建和启动

```bash
# 构建镜像并启动容器
docker-compose up --build

# 后台运行
docker-compose up -d --build

# 查看日志
docker-compose logs -f app
```

### 3. 常用命令

```bash
# 停止容器
docker-compose down

# 重启容器
docker-compose restart

# 进入容器调试
docker-compose exec app bash

# 查看PM2状态
docker-compose exec app pm2 status

# 查看PM2日志
docker-compose exec app pm2 logs

# 重启PM2应用
docker-compose exec app pm2 restart all
```

## 启动流程

容器启动时，`startup.sh` 脚本会按以下顺序执行：

1. **设置时区** - 根据 `TIMEZONE` 环境变量
2. **配置Cron** - 如果 `CRON_ENABLED=true`
3. **检查项目文件** - 确保项目正确挂载
4. **安装依赖** - 如果需要，自动运行 `pnpm install`
5. **构建项目** - 如果 `BUILD_ENABLED=true`
6. **启动应用** - 使用PM2或直接启动

## 环境变量说明

### 基础配置

- `PROJECT_NAME`: Docker容器名称
- `PORT`: 应用监听端口
- `NODE_ENV`: Node.js运行环境

### PM2配置

- `USE_PM2`: 是否使用PM2管理进程
- `PM2_INSTANCES`: PM2实例数量
- `PM2_MAX_MEMORY`: 最大内存限制
- `PM2_LOG_FILE/PM2_ERROR_FILE/PM2_OUT_FILE`: 日志文件路径

### Docker特定配置

- `BUILD_ENABLED`: 是否在启动时构建
- `APP_MAIN_SCRIPT`: 主应用脚本路径
- `TIMEZONE`: 时区设置
- `CRON_ENABLED`: 是否启用定时任务
- `CRON_JOBS`: Cron任务配置

## 目录结构

```
nestjs-module/
├── Dockerfile              # 优化后的Docker镜像定义
├── docker-compose.yml      # Docker Compose配置
├── .env                    # 环境变量配置
├── logs/                   # 应用日志目录
├── pm2-logs/              # PM2日志目录
└── src/                   # 项目源码
```

## 故障排除

### 常见问题

1. **容器无法启动**

   ```bash
   # 检查环境变量
   docker-compose config

   # 查看构建日志
   docker-compose build --no-cache
   ```

2. **应用无法访问**

   ```bash
   # 检查端口映射
   docker-compose ps

   # 查看应用日志
   docker-compose logs app
   ```

3. **PM2无法启动**

   ```bash
   # 进入容器检查
   docker-compose exec app bash

   # 手动启动PM2
   docker-compose exec app ./pm2.sh --start --build
   ```

4. **依赖安装失败**
   ```bash
   # 清理并重新安装
   docker-compose exec app rm -rf node_modules
   docker-compose exec app pnpm install
   ```

### 调试模式

如果需要调试，可以在 `docker-compose.yml` 中取消注释调试命令：

```yaml
command: tail -f /dev/null # 保持容器运行用于调试
```

然后进入容器手动执行命令：

```bash
docker-compose exec app bash
cd /app
./pm2.sh --start --build
```

## 性能优化

1. **多核利用**: 设置 `PM2_INSTANCES=max` 使用所有CPU核心
2. **内存管理**: 调整 `PM2_MAX_MEMORY` 根据服务器配置
3. **日志管理**: 配置日志轮转避免磁盘满载
4. **缓存优化**: 利用Docker层缓存，依赖变化时才重新安装

## 安全建议

1. **环境变量**: 不要在代码中硬编码敏感信息
2. **用户权限**: 生产环境考虑使用非root用户
3. **网络模式**: 根据需要选择合适的网络模式
4. **日志安全**: 避免在日志中输出敏感信息
