---

description: "Task list template for feature implementation"
---

# Tasks: [FEATURE NAME]

> ⚠️ **重要**: 每个任务必须严格按照对应的规格文档实现，完成后需检查一致性。任务需要有清晰可见的完成边界，不要把一个 story 压成单个巨型任务。

---

## 📚 文档引用索引

| 文档 | 用途 | 路径 |
|------|------|------|
| **spec.md** | 需求规格、用户故事、验收标准 | 当前目录 |
| **plan.md** | 技术设计、项目结构、服务划分 | 当前目录 |
| **data-model.md** | 数据库实体、表结构、字段映射 | 当前目录 |
| **contracts/openapi.yaml** | OpenAPI 3.0 接口契约定义 | 当前目录 |
| **quickstart.md** | 环境搭建、启动顺序、验证方法 | 当前目录 |
| **research.md** | 技术调研、选型依据 | 当前目录 |
| **acceptance-examples.md** | 需求验收示例和可观察 oracle | 当前目录 |
| **requirements-testability-review.md** | 每条需求是否可测、是否被 blocker 阻塞 | 当前目录 |
| **verify-matrix.md** | Requirement -> 测试层级 / 命令 / 证据映射 | 当前目录 |
| **test-strategy.md** | 基线命令、affected tests 和阻塞失败规则 | 当前目录 |
| **test-manifest.json** | 给 hook / analyze / verify 读取的测试机器镜像 | 当前目录 |

> **Note**: 并非所有项目都有上述全部文档，根据 FEATURE_DIR 实际内容填写。

---

## 🛠️ 技术栈速查

| 层级 | 技术 | 版本 |
|------|------|------|
| ... | ... | ... |

<!-- 根据 plan.md 提取技术栈信息填写此表 -->

---

## 集成型 Story 拆分参考

> 如果当前 feature 是 `integration` / `production`，或者故事依赖既定 OSS、外部系统、真实环境，请优先按下面的验收边界拆任务，而不是生成一个吞掉全部职责的大任务。

| 推荐切片 | 典型内容 | 何时单独成任务 |
|------|------|------|
| 环境 / blocker 证据 | `TBD-*`、RBAC、endpoint、dashboard、webhook、环境可用性 | 只要还存在真实接入前置条件，就应单独成任务 |
| contract projection / schema mapping | 字段映射、查询条件、响应结构、saved query / metadata 对齐 | 当外部接口与本地领域模型之间存在映射层 |
| real connector / read-write path | `lib/connectors/*`、adapter、重试、鉴权、错误包装 | 只要有真实下游接入，就应单独成任务 |
| bridge / policy / metadata | RBAC bridge、query policy、fields metadata、状态归一化 | 当中间层逻辑独立于 UI / API 时 |
| BFF / API / 页面消费 | 上层聚合、接口、页面、状态、空态、错误态 | 在真实 connector 已就位后再单独成任务 |
| 联调 transcript / 失败态证据 | smoke、integration、e2e、downstream、release note | 真实集成收尾时单独成任务 |

> 如果一个任务同时覆盖上表中 3 类以上职责，默认说明粒度过粗，需要继续拆分。

---

<!-- 
  ============================================================================
  IMPORTANT: The tasks below are SAMPLE TASKS for illustration purposes only.
  
  The /speckit.tasks command MUST replace these with actual tasks based on:
  - User stories from spec.md (with their priorities P1, P2, P3...)
  - Feature requirements from plan.md
  - Entities from data-model.md
  - Endpoints from contracts/
  
  Tasks MUST be organized by user story so each story can be:
  - Implemented independently
  - Tested independently
  - Delivered as an MVP increment
  
  DO NOT keep these sample tasks in the generated tasks.md file.
  ============================================================================
-->

## Phase 1: 项目初始化与基础设施 <!-- id: 10 -->

- [ ] **T001 创建项目结构** <!-- id: 11 -->
  - 📋 **规格参考**: plan.md → Project Structure
  - _Requirements: FR-XXX_
  - ✅ **验收标准**: 项目编译通过
  - 📁 **创建文件**: `path/to/file`
  - 🧪 **测试文件**: `TEST-GAP: 初始化任务无测试文件`
  - 🟢 **GREEN 命令**:
    - `git -c core.safecrlf=false diff --check`
  - 📌 **受影响测试**:
    - `TEST-GAP: 尚未生成项目测试命令`
  - 🔍 **自检命令**:
    - `git -c core.safecrlf=false diff --check`
  - 📝 **执行内容**:
    - 具体执行步骤 1
    - 具体执行步骤 2

- [ ] **T002 [P] 创建基础设施** <!-- id: 12 -->
  - 📋 **规格参考**: quickstart.md → 启动基础设施
  - _Requirements: FR-XXX_
  - ✅ **验收标准**: 基础设施启动成功
  - 📁 **创建文件**: `path/to/file`

---

## Phase 2: [User Story Title] — US1 [Description] (Priority: P1) 🎯 MVP <!-- id: 20 -->

**Goal**: [Brief description of what this story delivers]

**Independent Test**: [How to verify this story works on its own]

- [ ] **T003 [US1] 创建服务项目结构** <!-- id: 21 -->
  - 📋 **规格参考**: plan.md → Phase 2
  - _Requirements: FR-001~FR-005_
  - 📁 **创建文件**:
    - `src/main/java/.../Application.java`
    - `src/main/resources/application.yml`

- [ ] **T004 [US1] 创建数据库迁移** <!-- id: 22 -->
  - 📋 **规格参考**: data-model.md → Entity
  - _Requirements: FR-001_
  - 📁 **创建文件**: `src/main/resources/db/migration/V1__create_table.sql`
  - ✅ **字段检查**: id, name, ...

- [ ] **T005 [US1] 创建实体和 Mapper** <!-- id: 23 -->
  - 📋 **规格参考**: data-model.md → Entity, openapi.yaml → VO schema
  - _Requirements: FR-001~FR-004_
  - 📁 **创建文件**:
    - `entity/Entity.java`
    - `mapper/EntityMapper.java`
    - `dto/CreateDTO.java`
    - `vo/EntityVO.java`
  - ✅ **一致性检查**: VO 字段与 openapi.yaml schema 完全一致

- [ ] **T006 [US1] 实现 Service 业务逻辑** <!-- id: 24 -->
  - 📋 **规格参考**: spec.md → FR-001~FR-005
  - _Requirements: FR-001, FR-002, ..._
  - 📁 **创建文件**: `service/Service.java`
  - 📝 **方法清单**:
    - `method1()`: 描述
    - `method2()`: 描述

- [ ] **T007 [US1] 实现 Controller REST 接口** <!-- id: 25 -->
  - 📋 **规格参考**: openapi.yaml → /endpoint 系列接口
  - _Requirements: FR-001~FR-005_
  - 📁 **创建文件**: `controller/Controller.java`
  - ✅ **接口清单**:
    | 方法 | 路径 | 鉴权 |
    |------|------|------|
    | POST | `/endpoint` | ❌ |
    | GET | `/endpoint/{id}` | ✅ |

- [ ] **T008 [US1] 服务验证** <!-- id: 26 -->
  - _Validates: US1 Scenario 1-4_
  - ✅ **验证场景**:
    - 场景 1 描述 → 预期结果
    - 场景 2 描述 → 预期结果

**Checkpoint**: US1 功能完整可用

---

## Phase 3: [User Story Title] — US2 [Description] (Priority: P1/P2) <!-- id: 30 -->

**Goal**: [Brief description]

**Independent Test**: [How to verify]

- [ ] **T009 [US2] 创建服务项目结构** <!-- id: 31 -->
  ...

- [ ] **T010 [US2] 服务验证** <!-- id: 32 -->
  ...

**Checkpoint**: US2 功能完整可用

---

[Add more phases as needed, following the same pattern]

---

## Phase N: 联调验收与 Polish <!-- id: N0 -->

**Purpose**: 全流程验证、文档完善、性能安全检查

- [ ] **TXXX [P] 全流程 E2E 验证** <!-- id: N1 -->
  - _Validates: US1-USn 全场景, SC-001~SC-XXX_
  - ✅ **验证场景**: 完整用户流程

- [ ] **TXXX [P] 性能与安全检查** <!-- id: N2 -->
  - _Validates: NFR-001~NFR-XXX_
  - ✅ API p95 < 500ms
  - ✅ 密码加密存储
  - ✅ SQL 注入/XSS 防护

---

## Dependencies & Execution Order

### Phase 依赖

```
Phase 1 (基础设施) ──→ Phase 2 (US1)
                   ──→ Phase 3 (US2)
Phase 2 ─────────────→ Phase 4 (US3)
All ─────────────────→ Phase N (联调)
```

### User Story 依赖

| User Story | 依赖 | 所在 Phase |
|-----------|------|-----------
| US1 | Phase 1 基础设施 | Phase 2 |
| US2 | Phase 1 | Phase 3 |
| US3 | Phase 2 + Phase 3 | Phase 4 |

### 并行机会

- Phase 2 与 Phase 3 **可并行**（如无交叉依赖）
- 每个 Phase 内标注 [P] 的任务可并行执行

---

## Implementation Strategy

### MVP First（核心闭环优先）

1. Phase 1: 基础设施搭建
2. Phase 2: US1 → **验证**: 核心功能
3. **STOP**: P1 完成，可进行演示

### Incremental Delivery

4. Phase 3: US2 → P2 功能
5. Phase N: 全流程联调验收

---

## Notes

- **[P]** 标记的任务可与同 Phase 内其他 [P] 任务并行
- **[USn]** 标记关联到 spec.md 中的 User Story n
- 每个 Phase 完成后执行 Checkpoint 验证
- 每个任务使用 📋📁📝✅ 图标标注规格参考/文件/内容/验收标准
- HTML 注释 `<!-- id: XX -->` 用于任务追踪
