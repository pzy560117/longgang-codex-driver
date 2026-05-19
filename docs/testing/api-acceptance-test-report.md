# API 自动验收测试报告

**结论**: PASS
**开始时间**: 2026-05-18T08:02:40.189Z
**结束时间**: 2026-05-18T08:02:41.387Z
**验证命令**: `node --import tsx --test --test-concurrency=1 tests/acceptance/api-manual-acceptance.test.mjs`

## 覆盖范围

| 场景 | 关联需求 | 验证点 |
| --- | --- | --- |
| 创建导出任务主流程 | FR-001 / FR-002 / FR-010 | 注册配置、创建 PENDING 任务、查询详情、历史分页、审计成功记录 |
| 幂等与冲突 | FR-001 / FR-013 | 相同 clientRequestId 重放返回原 taskId，参数变化返回 IDEMPOTENCY_CONFLICT |
| 取消任务 | FR-012 | PENDING 任务取消后详情状态为 CANCELED |
| 认证与负向创建 | FR-008 / FR-009 / FR-010 | 缺少 HMAC 签名、格式不支持、缺少必填参数、禁用配置均失败并保持错误脱敏 |

## 测试摘要

| 指标 | 数量 |
| --- | ---: |
| 测试套件 | 0 |
| 用例总数 | 2 |
| 通过 | 2 |
| 失败 | 0 |
| 取消 | 0 |
| 跳过 | 0 |

## 证据边界

- 该报告来自本机 Node test + Docker/local MySQL 环境，验证 HTTP API、MySQL 持久化和审计记录。
- 该报告不声明外部生产 MySQL、真实 OSS/S3 或外部网关 live evidence。
- 认证上下文通过测试进程内 HMAC secret 生成，不写入仓库。

## 原始输出

```text
✔ manual acceptance API flow creates, replays, lists, cancels, and audits tasks (354.0767ms)
✔ manual acceptance API rejects unsigned, unauthorized, and invalid create requests safely (148.1762ms)
ℹ tests 2
ℹ suites 0
ℹ pass 2
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1149.45

```
