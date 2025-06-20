# 使用Node.js官方镜像
FROM node:24.2.0

# 更换镜像源为阿里云
# 1. 更换系统apt源为阿里云镜像
RUN if [ -f /etc/apt/sources.list ]; then \
        sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list && \
        sed -i 's/security.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list; \
    fi && \
    if [ -f /etc/apt/sources.list.d/debian.sources ]; then \
        sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources && \
        sed -i 's/security.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources; \
    fi

# 2. 配置npm使用中国镜像源
RUN npm config set registry https://registry.npmmirror.com

# 设置默认应用配置
ENV USE_PM2=true
ENV APP_MAIN_SCRIPT=dist/main.js
ENV NODE_ENV=production
ENV TIMEZONE=Asia/Shanghai
ENV BUILD_ENABLED=true
ENV CRON_ENABLED=false
ENV CRON_JOBS=""

# 安装必要的系统依赖
RUN apt-get update && apt-get install -y \
    python3 \
    build-essential \
    sqlite3 \
    libsqlite3-dev \
    cron \
    tzdata \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# 设置工作目录
WORKDIR /app

# 安装PM2和pnpm
RUN npm install -g pm2 pnpm

# 3. 配置pnpm使用中国镜像源
RUN pnpm config set registry https://registry.npmmirror.com

# 只复制依赖文件
COPY package.json pnpm-lock.yaml ./

# 安装依赖
RUN pnpm install

# 创建启动脚本
RUN echo '#!/bin/bash' > /usr/local/bin/startup.sh && \
    echo 'set -e' >> /usr/local/bin/startup.sh && \
    echo '' >> /usr/local/bin/startup.sh && \
    echo 'echo "🚀 容器启动中..."' >> /usr/local/bin/startup.sh && \
    echo 'cd /app' >> /usr/local/bin/startup.sh && \
    echo '' >> /usr/local/bin/startup.sh && \
    echo '# 读取.env文件中的环境变量' >> /usr/local/bin/startup.sh && \
    echo 'if [ -f ".env" ]; then' >> /usr/local/bin/startup.sh && \
    echo '  echo "📄 读取 .env 文件..."' >> /usr/local/bin/startup.sh && \
    echo '  set -o allexport' >> /usr/local/bin/startup.sh && \
    echo '  source .env' >> /usr/local/bin/startup.sh && \
    echo '  set +o allexport' >> /usr/local/bin/startup.sh && \
    echo '  echo "✅ 环境变量已加载"' >> /usr/local/bin/startup.sh && \
    echo 'else' >> /usr/local/bin/startup.sh && \
    echo '  echo "⚠️  未找到 .env 文件，使用默认环境变量"' >> /usr/local/bin/startup.sh && \
    echo 'fi' >> /usr/local/bin/startup.sh && \
    echo '' >> /usr/local/bin/startup.sh && \
    echo '# 设置时区' >> /usr/local/bin/startup.sh && \
    echo 'if [ "$TIMEZONE" != "" ]; then' >> /usr/local/bin/startup.sh && \
    echo '  export TZ=$TIMEZONE' >> /usr/local/bin/startup.sh && \
    echo '  ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone' >> /usr/local/bin/startup.sh && \
    echo '  echo "✅ 时区设置为: $TIMEZONE"' >> /usr/local/bin/startup.sh && \
    echo 'fi' >> /usr/local/bin/startup.sh && \
    echo '' >> /usr/local/bin/startup.sh && \
    echo '# 检查是否启用Cron' >> /usr/local/bin/startup.sh && \
    echo 'if [ "$CRON_ENABLED" = "true" ]; then' >> /usr/local/bin/startup.sh && \
    echo '  echo "⏰ 配置定时任务..."' >> /usr/local/bin/startup.sh && \
    echo '  mkdir -p /var/log && touch /var/log/cron.log' >> /usr/local/bin/startup.sh && \
    echo '  echo "# 自动生成的定时任务" > /etc/crontab' >> /usr/local/bin/startup.sh && \
    echo '  if [ "$CRON_JOBS" != "" ]; then' >> /usr/local/bin/startup.sh && \
    echo '    echo "$CRON_JOBS" | tr ";" "\n" | while read -r job; do' >> /usr/local/bin/startup.sh && \
    echo '      if [ "$job" != "" ]; then' >> /usr/local/bin/startup.sh && \
    echo '        echo "$job" >> /etc/crontab' >> /usr/local/bin/startup.sh && \
    echo '        echo "  添加定时任务: $job"' >> /usr/local/bin/startup.sh && \
    echo '      fi' >> /usr/local/bin/startup.sh && \
    echo '    done' >> /usr/local/bin/startup.sh && \
    echo '  fi' >> /usr/local/bin/startup.sh && \
    echo '  cron' >> /usr/local/bin/startup.sh && \
    echo '  echo "✅ Cron服务已启动"' >> /usr/local/bin/startup.sh && \
    echo 'else' >> /usr/local/bin/startup.sh && \
    echo '  echo "⏭️  跳过Cron服务"' >> /usr/local/bin/startup.sh && \
    echo 'fi' >> /usr/local/bin/startup.sh && \
    echo '' >> /usr/local/bin/startup.sh && \
    echo '# 检查项目目录是否正确挂载' >> /usr/local/bin/startup.sh && \
    echo 'if [ ! -f "package.json" ]; then' >> /usr/local/bin/startup.sh && \
    echo '  echo "❌ 找不到package.json文件，请确保项目目录已正确挂载"' >> /usr/local/bin/startup.sh && \
    echo '  exit 1' >> /usr/local/bin/startup.sh && \
    echo 'fi' >> /usr/local/bin/startup.sh && \
    echo '' >> /usr/local/bin/startup.sh && \
 \
    echo '# 构建项目（如果需要）' >> /usr/local/bin/startup.sh && \
    echo 'if [ "$BUILD_ENABLED" = "true" ] || [ ! -f "$APP_MAIN_SCRIPT" ]; then' >> /usr/local/bin/startup.sh && \
    echo '  echo "🔨 构建项目..."' >> /usr/local/bin/startup.sh && \
    echo '  pnpm run build' >> /usr/local/bin/startup.sh && \
    echo 'fi' >> /usr/local/bin/startup.sh && \
    echo '' >> /usr/local/bin/startup.sh && \
    echo '# 启动应用' >> /usr/local/bin/startup.sh && \
    echo 'if [ "$USE_PM2" = "true" ] && [ -f "./pm2.sh" ]; then' >> /usr/local/bin/startup.sh && \
    echo '  echo "🚀 使用PM2启动应用..."' >> /usr/local/bin/startup.sh && \
    echo '  echo "当前环境变量："' >> /usr/local/bin/startup.sh && \
    echo '  echo "  PORT: ${PORT:-未设置}"' >> /usr/local/bin/startup.sh && \
    echo '  echo "  NODE_ENV: ${NODE_ENV:-未设置}"' >> /usr/local/bin/startup.sh && \
    echo '  echo "  PM2_INSTANCES: ${PM2_INSTANCES:-未设置}"' >> /usr/local/bin/startup.sh && \
    echo '  ./pm2.sh --start --path "$APP_MAIN_SCRIPT"' >> /usr/local/bin/startup.sh && \
    echo '  pm2 logs --raw' >> /usr/local/bin/startup.sh && \
    echo 'else' >> /usr/local/bin/startup.sh && \
    echo '  echo "🔄 直接启动应用..."' >> /usr/local/bin/startup.sh && \
    echo '  node "$APP_MAIN_SCRIPT"' >> /usr/local/bin/startup.sh && \
    echo 'fi' >> /usr/local/bin/startup.sh

# 设置启动脚本权限
RUN chmod +x /usr/local/bin/startup.sh

# 不在这里启动，让容器保持运行状态
CMD ["tail", "-f", "/dev/null"] 