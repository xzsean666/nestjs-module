#!/bin/bash

# nest new . --skip-git
# 使用Yarn来安装依赖
yarn add typeorm pg dotenv axios
yarn add @nestjs/graphql @nestjs/apollo @apollo/server graphql
# 创建软链接
ln -s /home/sean/git/node-utils/src/utils src/utils

# 复制nestjs.sh
cp src/utils/sh/nestjs.sh .

# 给nestjs.sh添加可执行权限
chmod +x nestjs.sh

# 忽略src/sdk和src/utils目录
echo "src/sdk/" >> .gitignore
echo "src/utils/" >> .gitignore

# 添加"build:sdk"命令到package.json
npx json -I -f package.json -e 'this.scripts["build:sdk"] = "npx ts-node src/utils/scripts/copyDependencies.ts --input src/sdk/index.ts --output src/main"'


# 修改tsconfig.build.json文件
npx json -I -f tsconfig.build.json -e 'this.exclude.push("src/utils", "src/sdk")'