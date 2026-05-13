---
name: cicd
description: CI/CD 指南
---

# CI/CD 指南

## 触发条件
流水线、GitHub Actions、自动化部署、持续集成

## GitHub Actions 基础模板

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Lint
        run: npm run lint
      
      - name: Type check
        run: npm run type-check
      
      - name: Test
        run: npm run test -- --coverage
      
      - name: Build
        run: npm run build
```

## 部署流水线

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install and Build
        run: |
          npm ci
          npm run build
      
      - name: Deploy to Server
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /var/www/app
            git pull origin main
            npm ci --production
            pm2 restart app
```

## Docker 构建发布

```yaml
name: Docker Build

on:
  push:
    tags: ['v*']

jobs:
  build:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Login to Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Build and Push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: |
            ghcr.io/${{ github.repository }}:${{ github.ref_name }}
            ghcr.io/${{ github.repository }}:latest
```

## 缓存优化

```yaml
- name: Cache node modules
  uses: actions/cache@v4
  with:
    path: ~/.npm
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-node-
```

## 环境变量和密钥

```yaml
env:
  NODE_ENV: production
  API_URL: ${{ secrets.API_URL }}

# 在 Settings > Secrets and variables > Actions 中配置
```

## 条件执行

```yaml
- name: Deploy
  if: github.ref == 'refs/heads/main' && github.event_name == 'push'
  run: npm run deploy

- name: Skip CI
  if: contains(github.event.head_commit.message, '[skip ci]')
  run: echo "Skipping CI"
```

## 最佳实践
- 使用 `npm ci` 而非 `npm install`
- 缓存依赖加速构建
- 敏感信息使用 Secrets
- PR 和 main 分支使用不同流水线
- 部署前确保所有测试通过

