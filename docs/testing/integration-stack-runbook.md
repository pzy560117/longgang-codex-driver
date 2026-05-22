# Docker 集成栈运行手册

本文描述统一导出平台 Docker 集成栈的测试层级定位、运行入口和证据边界。它只回答“这套栈属于哪一层、从哪里启动、能证明什么、不能证明什么”，不补充新的业务事实。

## 1. 目的

- 明确 Docker 集成栈在测试体系中的位置。
- 说明各个运行入口对应的验证边界。
- 统一区分 `docker/mock` 证据、local rehearsal 证据和 live evidence。

## 2. 测试层级定位

Docker 集成栈用于承接本机或容器化环境下的集成验证，通常覆盖以下层级：

| 层级 | 关注点 | 典型入口 | 证据边界 |
| --- | --- | --- | --- |
| contract | OpenAPI、路由、参数和错误码一致性 | `npm run test:contract` | 只证明契约和映射，不证明外部真实依赖 |
| api | HTTP 接口与认证、审计、状态机联动 | `npm run test:api` | 只证明 API 行为，不自动升级为 live evidence |
| db | schema、migration、repository 持久化 | `npm run test:db` | 只证明本机或 Docker MySQL 可用 |
| worker | 调度、租约、重试、cleanup | `npm run test:worker` | 只证明 worker 入口和 DB 边界 |
| query | 查询执行、数据范围、脱敏和错误映射 | `npm run test:query` | 只证明受控数据源或测试替身边界 |
| file | 文件服务、对象存储协议链路、下载签名 | `npm run test:file` | 只证明 production-equivalent adapter 或 mock 边界 |
| sample | 端到端样板契约 | `npm run test:sample` | 只证明样板链路可执行，不替代 live evidence |
| docker/mock | 本机容器化综合验证 | `npm run test:docker-local` | 只证明本机 Docker MySQL / MinIO 受控链路 |

## 3. 运行入口

### 3.1 单项入口

按层级分别执行时，优先使用矩阵或任务中声明的最小相关命令：

```powershell
npm run test:contract
npm run test:api
npm run test:db
npm run test:worker
npm run test:query
npm run test:file
npm run test:sample
```

### 3.2 Docker 集成入口

当需要一次性跑通本机容器化集成链路时，使用：

```powershell
npm run test:docker-local
```

该入口通常由本机 Docker MySQL、Docker MinIO、受控种子数据和一组联动测试组成。实际执行内容以仓库脚本和测试命令为准。

## 4. 证据边界

- `docker/mock` 证据只能证明本机容器化环境下的集成链路。
- `local rehearsal` 证据只能证明本地演练路径可运行。
- `live evidence` 只能来自真实生产依赖接通后的受控验证。
- 任何 Docker 集成结果都不能自动升级为生产接入成功。
- 任何单项测试通过都不能替代完整的生产接入证据。

## 5. 使用规则

- 先按任务或矩阵确认需要哪一层验证，再选入口。
- 如果目标是生产接入，只能把 Docker 集成栈作为前置验证，不可当作最终结论。
- 如果某个依赖不可用，应记录 `BLOCKED - 需要人工介入`，不要用更低层的替身冒充通过。

## 6. 相关文档

- [验证矩阵](./verify-matrix.md)
- [生产部署教程](../operations/production-deployment-tutorial.md)
- [Docker 测试数据运行手册](./docker-test-data-runbook.md)

