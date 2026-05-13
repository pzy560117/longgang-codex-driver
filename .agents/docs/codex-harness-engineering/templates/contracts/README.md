# Contracts Templates Guide

本目录提供 contract-first 开发的最小模板组合。

## 推荐文件

- `openapi.yaml`: 前后端共享真相源的 OpenAPI 样例
- `orval.config.ts`: 生成 types / client / mocks 的 Orval 配置模板
- `prism-usage.md`: 本地 mock server 和 validation proxy 的 Prism 用法模板

## 推荐顺序

1. 先完善 `openapi.yaml`
2. 再配置 `orval.config.ts`
3. 生成 client / mocks
4. 用 `prism-usage.md` 跑本地 mock 与 contract 验证
