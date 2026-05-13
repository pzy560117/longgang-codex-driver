---
name: docker
description: Docker Skill
---

# Docker Skill

容器化最佳实践和 Docker 配置规范。

## Dockerfile 最佳实践

### 多阶段构建
```dockerfile
# 构建阶段
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

# 运行阶段
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# 非 root 用户运行
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 appuser

COPY --from=builder --chown=appuser:nodejs /app/dist ./dist
COPY --from=builder --chown=appuser:nodejs /app/node_modules ./node_modules

USER appuser
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

### 层缓存优化
```dockerfile
# ✅ 依赖文件先复制，利用缓存
COPY package*.json ./
RUN npm ci

# 源码后复制
COPY . .
RUN npm run build

# ❌ 避免这样写
COPY . .
RUN npm ci && npm run build
```

### 镜像精简
```dockerfile
# 使用 Alpine 基础镜像
FROM python:3.11-alpine

# 清理缓存
RUN pip install --no-cache-dir -r requirements.txt

# 合并 RUN 命令
RUN apk add --no-cache \
    gcc \
    musl-dev \
    && pip install --no-cache-dir -r requirements.txt \
    && apk del gcc musl-dev
```

## Docker Compose

### 开发环境配置
```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    volumes:
      - .:/app
      - /app/node_modules
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
    depends_on:
      - db
      - redis

  db:
    image: postgres:15-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"

volumes:
  postgres_data:
  redis_data:
```

### 生产环境配置
```yaml
version: '3.8'

services:
  app:
    image: myapp:${VERSION:-latest}
    restart: always
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

## 安全配置

### 非 root 用户
```dockerfile
# 创建专用用户
RUN groupadd -r appgroup && useradd -r -g appgroup appuser
USER appuser
```

### 只读文件系统
```yaml
services:
  app:
    read_only: true
    tmpfs:
      - /tmp
      - /var/run
```

### 敏感信息管理
```yaml
# 使用 secrets
services:
  app:
    secrets:
      - db_password
      - api_key

secrets:
  db_password:
    file: ./secrets/db_password.txt
  api_key:
    external: true
```

## .dockerignore
```
node_modules
npm-debug.log
.git
.gitignore
.env
.env.*
Dockerfile*
docker-compose*
README.md
.vscode
.idea
coverage
dist
build
*.log
```

## 常用命令

```bash
# 构建镜像
docker build -t myapp:v1.0 .

# 查看镜像层
docker history myapp:v1.0

# 清理未使用资源
docker system prune -a

# 查看容器日志
docker logs -f --tail 100 container_name

# 进入容器调试
docker exec -it container_name sh

# 导出镜像
docker save myapp:v1.0 | gzip > myapp-v1.0.tar.gz
```

