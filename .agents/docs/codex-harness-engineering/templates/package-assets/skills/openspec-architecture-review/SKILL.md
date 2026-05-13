---
name: OpenSpec Architecture Review
description: OpenSpec 规格的架构深度评审与完善工作流，识别设计缺陷并提供改进建议
---

# OpenSpec Architecture Review - OpenSpec 架构评审

## 概述

这是一个完整的 OpenSpec 规格质量保障工作流，包含三个阶段：
1. **规格评审** (Spec Review): 检查规格文档的完整性、一致性和可执行性
2. **架构分析** (Architecture Analysis): 深度分析现有代码架构，识别设计缺陷
3. **规格完善** (Spec Enhancement): 根据发现的问题完善规格文档

适用于所有使用 OpenSpec 方法论的项目。

## 何时使用此技能

- ✅ OpenSpec 规格已完成初稿，准备进入 EXECUTION 阶段
- ✅ 规格已实施一段时间，需要质量复审
- ✅ 发现现有架构存在潜在问题，需要系统分析
- ✅ 需要提升规格质量，确保后续实施顺利
- ❌ 规格尚未完成基本内容（应先完成 proposal/design/tasks/spec）

## 工作流程

### Phase 1: 规格评审 (Spec Review)

**目标**: 检查规格文档的结构完整性、追溯关系和 EARS 合规性

#### 步骤 1.1: 准备评审

```bash
# 确认规格路径
SPEC_PATH="openspec/changes/<change-name>"

# 确认必须文件存在
ls $SPEC_PATH/proposal.md
ls $SPEC_PATH/design.md
ls $SPEC_PATH/tasks.md
ls $SPEC_PATH/specs/*/spec.md
```

#### 步骤 1.2: 执行规格评审

使用以下评审清单（基于 OpenSpec 标准）：

**结构完整性检查**:
- [ ] proposal.md 存在且包含 Impact、Implementation Estimate
- [ ] design.md 存在且包含 Decisions、Correctness Properties、Risks
- [ ] tasks.md 存在且任务有 Requirements 追溯
- [ ] spec.md 存在且包含 Requirements、Scenarios (EARS)、Properties

**追溯关系检查**:
- [ ] 每个 Decision 追溯到至少一个 Requirement
- [ ] 每个 Task 追溯到至少一个 Requirement
- [ ] 每个 Property 验证至少一个 Requirement
- [ ] Scenarios 表格包含"追溯 Requirements"列

**EARS 格式检查**:
- [ ] 所有 Scenarios 使用正确的 EARS 模式（State-driven, Event-driven, Ubiquitous, Unwanted）
- [ ] Scenarios 描述清晰，避免模糊词汇
- [ ] 验证点可测试、可观测

**设计质量检查**:
- [ ] Decisions 包含 Rationale 和 Solution
- [ ] Correctness Properties 使用全称量化
- [ ] Risks 包含缓解措施
- [ ] 接口定义完整（TypeScript/其他语言）

#### 步骤 1.3: 生成评审报告

创建评审报告包含：
1. **快速摘要**：问题统计表
2. **问题清单**：Critical/Warning/Info 三级分类
3. **追溯矩阵**：Requirement → Decision → Task → Property
4. **兼容性分析**：API 变更、行为变更、依赖变更
5. **改进建议**：必须修复 vs 建议修复
6. **评分**: 各维度评分（0-10 分）

**评分维度**:
- 结构完整性
- 需求可追溯性
- EARS 合规性
- 设计详细度
- 任务可执行性
- 兼容性考虑

**评审结论**:
- ✅ 通过 - 可直接进入 EXECUTION
- ⚠️ 条件通过 - 需修复关键问题后再评审
- ❌ 不通过 - 需重大返工

---

### Phase 2: 架构深度分析 (Architecture Analysis)

**目标**: 分析现有代码架构，识别设计缺陷、性能瓶颈和潜在风险

> **Note**: 此阶段仅在规格涉及现有代码修改时执行

#### 步骤 2.1: 理解现有架构

```bash
# 查看架构文档
cat src/<module>/CONTEXT.md

# 查看核心文件大纲
# 使用 view_file_outline 工具
```

关注以下方面：
- **组件职责**: 是否符合单一职责原则
- **模块依赖**: 是否存在循环依赖
- **接口设计**: 是否清晰、稳定
- **错误处理**: 是否完善
- **性能考虑**: 是否有明显瓶颈

#### 步骤 2.2: 识别架构问题

按严重程度分类问题：

**🔴 Critical 问题**（阻塞性）:
- 竞态条件
- 内存泄漏
- 安全漏洞
- 数据不一致
- 无限循环/死锁

**🟡 High 问题**（影响性能/可靠性）:
- 性能瓶颈
- 资源泄漏
- 缺少超时保护
- 缺少失败恢复
- 不稳定的 API

**🟠 Medium 问题**（可维护性/扩展性）:
- 职责过重
- 缺少抽象
- 代码重复
- 缺少文档
- 命名混淆

**🟢 Low 问题**（优化建议）:
- 性能优化机会
- 代码风格改进
- 更好的设计模式

#### 步骤 2.3: 分析方法

**静态分析**:
- 查看文件大小（>500 行警告，>1000 行严重）
- 查看函数复杂度（嵌套层级、分支数）
- 检查依赖关系（是否有循环）
- 检查类型定义（是否完整）

**动态分析**（如适用）:
- 运行现有测试，查看覆盖率
- 查看性能日志（如有）
- 模拟故障场景

**模式识别**:
- 是否存在反模式（God Class, Spaghetti Code 等）
- 是否缺少常见模式（Factory, Strategy 等）
- 并发控制是否正确
- 缓存策略是否合理

#### 步骤 2.4: 生成架构分析报告

报告包含：
1. **执行摘要**：问题统计、整体评分
2. **Critical 问题**：详细描述 + 根因 + 修复建议 + 代码示例
3. **High 问题**：同上
4. **Medium/Low 问题**：简要说明
5. **代码对齐分析**：Spec 设计 vs 现有实现的差异
6. **风险清单**：实施风险 + 缓解措施
7. **修复优先级**：Phase 1 (立即) → Phase 2 (短期) → Phase 3 (中期)

**评分维度**:
- 架构合理性
- 性能表现
- 可靠性
- 可观测性
- 可维护性

---

### Phase 3: 规格完善 (Spec Enhancement)

**目标**: 根据 Phase 1-2 的发现，完善规格文档

#### 步骤 3.1: 确定修复范围

根据分析报告，决定哪些问题纳入当前规格：

**必须修复** (纳入当前规格):
- Critical 问题（C1-Cn）
- 阻塞 EXECUTION 的 High 问题
- 影响核心功能的设计缺陷

**建议修复** (可选纳入):
- 非阻塞的 High 问题
- 主要的 Medium 问题

**延后修复** (不纳入):
- 优化建议（Low 问题）
- 次要的 Medium 问题
- 需要大规模重构的问题

#### 步骤 3.2: 完善 design.md

针对每个必须修复的问题，补充或修正 Design Decision：

**新增 Decision**:
```markdown
### D<N>: <问题解决方案名称>

**Rationale**: 
<说明为什么需要此设计>

**问题场景**:
<用代码示例说明问题>

**Solution**:
<详细解决方案，包含接口定义、算法描述、配置选项>

**接口定义**:
\`\`\`typescript
// 完整的 TypeScript 接口
\`\`\`

**预期收益**:
- <量化指标，如性能提升 X%>
```

**修正现有 Decision**:
- 标注修正原因（如"修正竞态条件"）
- 提供对比（错误 vs 正确）
- 更新接口定义

#### 步骤 3.3: 完善 spec.md

**补充 Requirements**:
```markdown
### R<N>: <需求类别>
- **R<N>.1**: <具体需求>
- **R<N>.2**: <具体需求>
```

**补充 Scenarios**:
在 Scenarios 表格中添加新行，确保包含"追溯 Requirements"列：
```markdown
| 模式 | 验收标准 (EARS) | 验证点 | 追溯 Requirements |
|------|----------------|--------|------------------|
| Event-driven | WHEN ... THE 系统 SHALL ... | ... | R<N>.<M> |
```

**补充 Correctness Properties**:
```markdown
### Property <N>: <属性名称>
<全称量化的属性描述>
*Validates: Requirements R<X>, R<Y>*
```

#### 步骤 3.4: 完善 tasks.md

**重组 Phase**:
根据优先级调整任务顺序：
```markdown
### Phase <N>: <阶段名> (P0/P1/P2)
- [ ] <N>.<M> <任务描述> (<估时>)
  - [ ] <子任务1>
  - [ ] <子任务2>
  - _Requirements: R<X>.<Y>_ (Critical/High)
```

**新增任务**:
- 为每个新增的 Decision 添加实现任务
- 标注优先级（Critical/High/Medium）
- 估算时间

**调整现有任务**:
- 明确模糊的任务描述
- 补充缺失的子任务
- 更新 Requirements 追溯

#### 步骤 3.5: 更新 Risks

在 design.md 的 Risks and Mitigation 章节：
```markdown
## Risks and Mitigation

### 架构风险 (Critical)
- **<风险名称>** ✅ 已修正/❌ 待修正:
  - **风险**: <描述>
  - **缓解**: 
    1. <措施1>
    2. <措施2>

### 性能风险
...

### 设计风险
...
```

#### 步骤 3.6: 生成完善总结报告

报告包含：
1. **完善概览**：修改统计表
2. **详细修改内容**：逐文件列出变更
3. **问题覆盖情况**：Critical/High/Medium 的覆盖率
4. **预期收益更新**：性能、稳定性、质量指标
5. **下一步行动**：立即修复 vs 后续优化

---

## 输出产物

### 必须产物

1. **规格评审报告** (`spec_review_<change-name>.md`)
   - 问题清单
   - 追溯矩阵
   - 兼容性分析
   - 评分和结论

2. **架构分析报告** (`architecture_analysis_<change-name>.md`) [可选]
   - Critical/High/Medium 问题详解
   - 代码对齐分析
   - 修复优先级建议

3. **完善总结报告** (`spec_enhancement_summary_<change-name>.md`)
   - 修改内容汇总
   - 问题覆盖情况
   - 下一步行动计划

### 更新的规格文档

- `proposal.md` - 更新 Impact、预期收益
- `design.md` - 新增/修正 Decisions、更新 Risks
- `spec.md` - 补充 Requirements、Scenarios、Properties
- `tasks.md` - 重组 Phase、新增任务

---

## 评审清单模板

### Phase 1: 规格评审清单

```markdown
## 结构完整性
- [ ] proposal.md: Impact, Implementation Estimate
- [ ] design.md: Decisions, Properties, Risks
- [ ] tasks.md: Phase 结构, Requirements 追溯
- [ ] spec.md: Requirements, Scenarios, Properties

## 追溯关系
- [ ] Decisions → Requirements
- [ ] Tasks → Requirements
- [ ] Properties → Requirements
- [ ] Scenarios → Requirements

## EARS 合规
- [ ] 所有 Scenarios 使用标准模式
- [ ] 无模糊词汇
- [ ] 验证点可测试

## 设计质量
- [ ] Decisions 有 Rationale
- [ ] 接口定义完整
- [ ] Properties 全称量化
- [ ] Risks 有缓解措施
```

### Phase 2: 架构分析清单

```markdown
## Critical 问题检查
- [ ] 竞态条件
- [ ] 内存泄漏
- [ ] 死锁/无限循环
- [ ] 数据不一致
- [ ] 安全漏洞

## High 问题检查
- [ ] 性能瓶颈
- [ ] 缺少超时保护
- [ ] 缺少失败恢复
- [ ] API 不稳定
- [ ] 资源泄漏

## 代码质量
- [ ] 单一职责原则
- [ ] 接口清晰度
- [ ] 错误处理完整性
- [ ] 测试覆盖率
- [ ] 文档完整性
```

---

## 最佳实践

### 评审原则

1. **全面性优先**: 宁可多报告问题，也不遗漏关键缺陷
2. **量化优先**: 提供具体的评分和数据支撑
3. **可执行性优先**: 建议必须具体、可操作
4. **优先级明确**: Critical > High > Medium > Low

### 报告撰写

1. **结构化**: 使用表格、清单、代码块组织内容
2. **可视化**: 使用 Mermaid 图展示复杂关系
3. **代码示例**: 用代码对比说明问题和解决方案
4. **追溯清晰**: 使用文件链接、行号链接

### 问题分类标准

**Critical** (阻塞性):
- 影响正确性（产生错误结果）
- 影响稳定性（崩溃、死锁）
- 影响安全性（漏洞）

**High** (严重性):
- 影响性能（>50% 性能损失）
- 影响可靠性（频繁失败）
- 缺少关键保护（超时、降级）

**Medium** (改进性):
- 影响可维护性
- 影响扩展性
- 代码质量问题

**Low** (优化性):
- 性能微优化
- 代码风格改进

---

## 示例

### 示例 1: Critical 问题报告格式

```markdown
### C1: 缓存失效策略存在竞态条件

**问题描述**:
PageStateCache 的自动失效机制在 `executeTransition` **后**调用 `cache.clear()`...

**影响**:
- 并发导航场景下，状态检测可能返回错误结果
- 导致导航路径错误，甚至陷入循环

**根因**:
- 缓存失效时机晚于状态实际变化时机
- 缺少对并发场景的考虑

**建议修复** (Priority: P0):
\`\`\`typescript
// ❌ 错误
async executeTransition(t) {
  await t.action();
  cache.clear();  // 太晚
}

// ✅ 正确
async executeTransition(t) {
  cache.clear();  // 先清空
  await t.action();
}
\`\`\`

**涉及文件**:
- design.md: D1
- tasks.md: 需新增 2.1
```

### 示例 2: 架构分析评分

```markdown
## 整体评估

| 维度 | 评分 | 说明 |
|------|------|------|
| 架构合理性 | 7/10 | 组件化设计良好，但职责过重 |
| 性能表现 | 6/10 | 有明显瓶颈（图重建、状态检测） |
| 可靠性 | 6/10 | 缺少故障恢复和降级机制 |
| 可观测性 | 4/10 | 日志分散，缺少统一监控 |
| **综合评分** | **6.2/10** | **需要重点改进** |
```

---

## 注意事项

> [!IMPORTANT]
> 关键原则：
> - 评审应客观、基于事实
> - 所有建议必须可执行
> - Critical 问题必须修复后才能进入 EXECUTION
> - 不要过度设计，Medium/Low 问题可延后

> [!WARNING]
> 常见陷阱：
> - 过度关注代码风格，忽视架构问题
> - 问题分类过于主观
> - 建议过于抽象，缺少具体方案
> - 忽视兼容性影响

> [!TIP]
> 效率提升：
> - 使用模板加速报告生成
> - 复用历史评审的问题模式
> - 自动化追溯矩阵生成
> - 使用代码搜索工具快速定位问题

---

## 相关资源

- `/spec-review` workflow - 规格评审工作流
- `/openspec-proposal` workflow - OpenSpec 提案创建
- OpenSpec 方法论文档
- EARS 格式规范

---

## 更新日志

- **2026-01-26**: 创建初始版本，基于 optimize-navigation-system 评审实践
