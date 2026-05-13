# Prism Usage 模板

## 1. 目标

用 Prism 在真实后端完成前提供:

- mock server
- request/response contract 验证
- 异常态联调入口

## 2. 安装

```bash
npm install -D @stoplight/prism-cli
```

## 3. 启动 mock server

```bash
npx prism mock contracts/openapi.yaml -h 0.0.0.0
```

## 4. 启动 validation proxy

```bash
npx prism proxy contracts/openapi.yaml https://api.example.com
```

## 5. 推荐联调顺序

1. 先用 Prism mock 跑前端
2. 再生成 Orval client / mocks
3. 前端先围绕 generated client 写页面和测试
4. 最后切真实后端并跑 Prism proxy
