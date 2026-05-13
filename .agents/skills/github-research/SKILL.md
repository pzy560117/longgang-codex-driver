---
name: github-research
description: 系统化搜索、评估和深度分析 GitHub 仓库。全程使用 GitHub MCP 工具，无需安装 gh CLI。4 阶段流水线：搜索发现 → 评分筛选 → 深度分析 → 报告输出。
argument-hint: [research-topic]
---

# GitHub Research Skill（MCP 版）

## 触发条件

- "搜索 GitHub 上的 [主题] 项目"
- "分析 [领域] 的开源实现"
- "找 [算法/框架] 的 GitHub 仓库"
- 使用 `/github-research <topic>` 斜杠命令

## 概述

通过 GitHub MCP 工具系统化地发现、评估和深度分析 GitHub 仓库，生成结构化分析报告。

**无需任何外部工具** — 全程使用 `github-mcp-server` 提供的 MCP 工具 + Agent 自身分析能力。

**输出**: 分析报告写入 `docs/<topic-slug>/` 目录。

---

## 4 阶段流水线

```
Phase 1: 搜索发现  → 多关键词/多维度 GitHub 搜索，收集 30-100 个候选仓库
Phase 2: 评分筛选  → 按公式评分排名，选出 Top 10-20
Phase 3: 深度分析  → 通过 MCP 远程读取代码，逐仓库深度分析
Phase 4: 报告输出  → 生成最终分析报告（对比矩阵 + 推荐方案）
```

---

## Phase 1: 搜索发现

### 目标
从多个角度搜索 GitHub，收集 30-100 个候选仓库。

### 搜索策略矩阵

针对用户给定的主题，按以下策略组合搜索：

| 策略 | MCP 工具 | 查询示例 |
|------|----------|----------|
| 主题搜索 | `search_repositories` | `"auto research agent"` |
| 关键词变体 | `search_repositories` | `"automated research LLM"` |
| 技术栈过滤 | `search_repositories` | `"deep research" language:python` |
| 代码搜索 | `search_code` | `"class ResearchAgent"` |
| Awesome 列表 | `search_repositories` | `"awesome-research-agent"` |

### 执行步骤

1. **确定搜索关键词**：根据主题生成 3-5 组关键词（包含同义词/英文变体）
2. **执行多轮搜索**：对每组关键词调用 `search_repositories`，按 `stars` 降序排列
3. **代码搜索补充**：用 `search_code` 搜索特征性类名/函数名
4. **去重合并**：按 `owner/name` 去重，合并搜索结果
5. **初步记录**：将搜索结果记录为 Markdown 表格（名称、描述、Stars、语言、最后更新）

### 检查点
- 收集到 30-100 个不重复仓库
- 搜索关键词和策略已记录

---

## Phase 2: 评分筛选

### 目标
按评分公式排名，选出 Top 10-20 仓库进入深度分析。

### 评分公式

```
composite_score = relevance × 0.4 + quality × 0.35 + activity × 0.25
```

**各维度计算方法**：

| 维度 | 权重 | 计算规则 |
|------|------|----------|
| **relevance** (相关性) | 0.4 | Agent 根据描述/README 判断：0.9-1.0 直接相关，0.7-0.89 高度相关，0.5-0.69 部分相关，<0.5 弱相关 |
| **quality** (质量) | 0.35 | `normalize(log(stars+1)×0.3 + log(forks+1)×0.2 + has_license×0.15 + not_archived×0.2 + has_description×0.15)` |
| **activity** (活跃度) | 0.25 | 最近推送: <30天→0.9, 30-90天→0.7, 90-365天→0.4, >365天→0.1 |

### 执行步骤

1. **获取仓库详情**：对 Phase 1 中 Stars 排名前 40 的仓库，用 `get_file_contents` 读取 README 辅助判断相关性
2. **评分排名**：计算每个仓库的 composite_score
3. **选取 Top 10-20**：优先选择评分最高的仓库，同时确保类型多样性

### 筛选输出格式

```markdown
| # | 仓库 | ⭐ Stars | 语言 | 相关性 | 质量 | 活跃度 | 综合分 |
|---|------|---------|------|--------|------|--------|--------|
| 1 | owner/name | 2959 | Python | 0.95 | 0.88 | 0.90 | 0.91 |
```

### 检查点
- 评分表已生成
- 选出 10-20 个仓库进入 Phase 3

---

## Phase 3: 深度分析

### 目标
通过 MCP 远程读取仓库代码，对 Top 仓库进行深度技术分析。

### 分析方法（无需克隆）

使用以下 MCP 工具远程分析仓库：

| 分析维度 | MCP 工具 | 操作 |
|----------|----------|------|
| 目录结构 | `get_file_contents(path="/")` | 获取根目录文件列表 |
| README | `get_file_contents(path="README.md")` | 读取完整文档 |
| 依赖项 | `get_file_contents(path="requirements.txt")` | 读取依赖文件 |
| 核心代码 | `get_file_contents(path="src/...")` | 读取关键源文件 |
| 配置文件 | `get_file_contents(path="config/...")` | 读取配置 |
| 最近活动 | `list_commits(perPage=5)` | 查看最近提交 |

### 每仓库分析模板

```markdown
## {owner/name}

**概述**: {一句话描述}
**Stars**: {N} | **语言**: {lang} | **许可证**: {license} | **最后活跃**: {date}

### 架构
- 入口: `{file}` → 核心模块: `{modules}`
- 核心依赖: {key deps}

### 关键特性
- {feature 1}: 实现于 `{file}`
- {feature 2}: ...

### 代码质量
- 文档: {差/一般/好/优秀}
- 测试: {无/少量/中等/完善}
- 代码风格: {评价}

### 可复用性
- 提取难度: {易/中/难}
- 推荐组件: {可复用的部分}

### 局限性
- {limitation 1}
```

### 检查点
- 每个 Top 仓库都有深度分析结果
- 关键代码文件已实际阅读（不仅仅是 README）

---

## Phase 4: 报告输出

### 目标
生成最终分析报告，包含对比矩阵和推荐方案。

### 报告结构

```markdown
# {主题} GitHub 项目分析报告

## 1. 研究概述
- 搜索范围和方法
- 发现的项目总数

## 2. Top 项目排名
- 评分表格（从 Phase 2）

## 3. 深度分析
- 每个 Top 项目的详细分析（从 Phase 3）

## 4. 对比矩阵
| 维度 | 项目A | 项目B | 项目C | ... |
|------|-------|-------|-------|-----|

## 5. 技术趋势
- 常用技术栈
- 架构模式
- 发展方向

## 6. 推荐方案
- 最佳学习项目
- 最佳生产级项目
- 最佳创新项目

## 7. 总结
```

### 输出位置
- 报告文件: `docs/<topic-slug>/analysis_report.md`

### 检查点
- 最终报告已生成
- 对比矩阵完整
- 推荐方案明确

---

## 质量规范

1. **深度分析必须读代码** — 不能只看 README，必须通过 MCP 读取关键源文件
2. **去重** — 按 `owner/name` 去重
3. **增量保存** — 每阶段完成后立即写入文件
4. **中文输出** — 报告使用中文撰写
5. **评分透明** — 每个分数都有计算依据
