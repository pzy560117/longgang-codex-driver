# Templates README

当前模板集只保留单工作区、单 driver 的最小闭环。

## 主要目录

- `runtime/`: 项目根运行入口、driver、doctor、任务队列、运行策略、验证脚本
- `config/`: 全局与项目级配置示例
- `docs/`: 会复制到项目 `docs/harness/` 的文档模板，也包含 `project-agents-template.md` 这种按项目事实生成 `AGENTS.md` 的通用规则模板
- `testing/`: 测试左移模板，包含验收标准、验收示例、追溯矩阵、测试数据、回归计划、失败归因和 verify 矩阵
- `prompts/`: driver、review、visual、failure、repair 使用的提示词模板
- `trace/`: trace 与 schema 示例
- `package-assets/`: 会复制到目标项目 `.agents/` 的能力包与安装入口镜像

已移除：

- 额外执行工作区脚本
- 外部 worker 编排模板
- 控制面状态模板
