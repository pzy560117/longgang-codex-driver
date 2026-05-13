# Demo 交付记录

**项目 / 功能：** `<feature-name>`
**任务 ID：** `DEMO-001`
**更新时间：** `YYYY-MM-DD`
**定位：** 可运行、可点击、可评审的前端 Demo；不是生产交付。

## 1. 启动方式

```powershell
# 安装依赖
<install-command>

# 启动 Demo
<dev-command>
```

**本地地址：** `<http://localhost:xxxx>`

## 2. 可点击主流程

| 流程 | 路径 / 页面 | 操作 | 预期结果 | 状态 |
| --- | --- | --- | --- | --- |
| P0 主流程 1 | `<route>` | `<click / input>` | `<result>` | `pass / fail / blocked` |
| P0 主流程 2 | `<route>` | `<click / input>` | `<result>` | `pass / fail / blocked` |
| P1 辅助流程 | `<route>` | `<click / input>` | `<result>` | `pass / fail / blocked` |

## 3. Mock 数据边界

| 数据 | 来源 | 覆盖场景 | 不覆盖内容 |
| --- | --- | --- | --- |
| `<products/users/orders>` | `<file / fixture / inline>` | `<normal / empty / error>` | `<real API / payment / auth>` |

## 4. 人工介入点

| 类别 | 当前 Demo 处理方式 | 后续正式验证要求 |
| --- | --- | --- |
| 登录 / 权限 | mock 用户或本地状态 | 接真实登录、权限、会话过期 |
| 支付 / 订单 | mock 支付结果 | 接真实支付、签名、回调、失败重试 |
| 推送 / 短信 | 页面提示或 mock 通知 | 接真实设备、权限、厂商通道 |
| 数据库 / 接口 | mock 数据 | 接真实 API、错误码、分页、并发 |
| 设备兼容 | 桌面和移动视口检查 | 真机、系统版本、浏览器兼容 |
| 安全合规 | 不处理真实隐私数据 | 隐私、授权、数据存储、日志脱敏 |

## 5. 验证记录

```powershell
<lint-command>
<typecheck-command>
<build-command>
<test-command>
```

| 检查项 | 结果 | 证据 |
| --- | --- | --- |
| 本地启动 | `pass / fail / blocked` | `<log / screenshot / trace>` |
| P0 流程点击 | `pass / fail / blocked` | `<path>` |
| 移动端视口 | `pass / fail / blocked` | `<screenshot>` |
| 空态 / 错误态 | `pass / fail / blocked` | `<path>` |

## 6. 已知问题

| ID | 问题 | 影响 | 下一步 |
| --- | --- | --- | --- |
| DEMO-GAP-001 | `<description>` | `<impact>` | `<task / doc / owner>` |

## 7. 进入正式实现前必须确认

- [ ] 用户或负责人已经体验 Demo。
- [ ] P0 主流程可以打开、点击并完成。
- [ ] Demo 暴露的问题已经回写到产品、设计、测试或任务队列。
- [ ] 真实接口、支付、推送、登录、设备兼容和安全合规边界已经列明。
- [ ] foundation / domain / verify 任务依赖 `DEMO-001`，不会跳过 Demo 直接进入生产级实现。
