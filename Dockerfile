# 使用 Node.js 官方镜像作为基础镜像
FROM node:14
# 设置工作目录
WORKDIR /usr/src/app
# 复制 package.json 和 package-lock.json 文件
COPY package*.json ./
# 安装项目依赖
RUN npm install
# 复制项目源代码
COPY . .
# 编译 TypeScript 代码
RUN npm run build
# 设置环境变量
ENV NODE_ENV production
# 运行时使用的端口
EXPOSE 3000
# 运行编译后的 JavaScript 代码
CMD ["node", "dist/index.js"]