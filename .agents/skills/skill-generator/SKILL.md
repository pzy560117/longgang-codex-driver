---
name: skill-generator
description: Skill 生成器工作流，根据现有 skills 和需求创建新的 skill 文档
---

# Skill 生成器工作流

> 用于创建新的 skill 文档，确保格式统一、内容完整

---

## 工作流概览

```
需求分析 → 分类定位 → 参考现有 → 生成文档 → 验证完整性
```

---

## 第一步：需求分析

### 必须明确的信息

1. **Skill 用途**：这个 skill 要解决什么问题？
2. **触发场景**：用户在什么情况下需要这个 skill？
3. **目标用户**：开发者、测试人员、DevOps？
4. **技术领域**：前端、后端、测试、工具？
5. **依赖关系**：是否依赖其他 skills？

### 需求收集模板

```markdown
## Skill 名称
[kebab-case 格式，如：api-testing-workflow]

## 用途
一句话描述这个 skill 的核心价值

## 触发条件
列出 3-5 个关键词或场景

## 目标用户
- [ ] 前端开发
- [ ] 后端开发
- [ ] 测试工程师
- [ ] DevOps
- [ ] 其他：______

## 技术领域
- [ ] 工作流与方法论
- [ ] 后端开发
- [ ] 前端开发
- [ ] DevOps
- [ ] 代码质量与测试
- [ ] 工具与文档
- [ ] 项目专用

## 依赖的 Skills
- [skill-name-1]
- [skill-name-2]
```

---

## 第二步：分类定位

### 目录分类规则

| 目录 | 适用场景 | 示例 |
|:---|:---|:---|
| workflow/ | 开发方法论、流程指南 | 胶水编程、项目计划 |
| backend/ | 后端技术栈、框架、工具 | Django、API设计 |
| frontend/ | 前端技术栈、UI框架 | Vue、TypeScript |
| devops/ | 部署、CI/CD、容器化 | Docker、GitHub Actions |
| quality/ | 测试、代码审查、性能 | 单元测试、重构 |
| tools/ | 文档处理、脚手架工具 | Excel、项目初始化 |
| project/ | 特定项目的专用指南 | Midscene Framework |

### 命名规范

- 使用 kebab-case：`api-testing-workflow.md`
- 名称要描述性强：`frontend-state-management.md` 优于 `state.md`
- 避免缩写：`typescript-best-practices.md` 优于 `ts-bp.md`

---

## 第三步：参考现有 Skills

### 查找相似 Skills

1. 在 `skills-index.md` 中搜索相关关键词
2. 读取 2-3 个相似的 skill 文档
3. 分析它们的结构和内容组织方式

### 提示词模板

```
请帮我分析以下 skills，找出与 [新 skill 需求] 最相似的 3 个：

[粘贴 skills-index.md 的相关部分]

然后读取这些 skills 的完整内容，总结它们的：
1. 文档结构
2. 内容组织方式
3. 示例代码风格
4. 可复用的模板部分
```

---

## 第四步：生成文档

### 标准文档结构

```markdown
---
inclusion: manual
description: [简短描述，用于 skills-index.md]
---

# [Skill 标题]

> [一句话概述]

---

## 工作流概览 / 核心概念

[可选：使用 mermaid 图或简单流程]

---

## 第一部分：[核心内容 1]

### 子章节 1.1

[内容]

### 子章节 1.2

[内容]

---

## 第二部分：[核心内容 2]

### 子章节 2.1

[内容]

---

## 示例 / 最佳实践

[实际代码示例或操作步骤]

---

## 常见问题 / 注意事项

[可选：FAQ 或 troubleshooting]

---

## 相关 Skills

[可选：链接到相关的其他 skills]
```

### 内容编写原则

1. **简洁明了**：每个章节聚焦一个主题
2. **实用导向**：提供可执行的步骤和代码
3. **结构清晰**：使用表格、列表、代码块
4. **示例丰富**：至少包含 1-2 个完整示例
5. **中文为主**：所有说明用中文，代码注释可用英文

### 代码示例规范

```markdown
### 示例：[场景描述]

\`\`\`typescript
// 简短注释说明代码用途
function example() {
  // 实现
}
\`\`\`

**说明**：
- 关键点 1
- 关键点 2
```

---

## 第五步：验证完整性

### 文档检查清单

- [ ] YAML front matter 完整（inclusion, description）
- [ ] 标题使用 H1（单个 #）
- [ ] 章节使用 H2（##）和 H3（###）
- [ ] 包含至少一个实际示例
- [ ] 代码块指定了语言类型
- [ ] 表格格式正确
- [ ] 没有拼写错误
- [ ] 链接有效（如果有）

### 索引更新清单

- [ ] 在 `skills-index.md` 中添加新 skill
- [ ] 触发条件描述清晰
- [ ] 文件路径正确
- [ ] 分类正确

---

## 索引更新模板

在 `skills-index.md` 对应分类的表格中添加：

```markdown
| [skill-name] | [触发条件1]、[触发条件2]、[触发条件3] | .kiro/steering/[category]/[skill-name].md |
```

---

## 完整示例：创建 API 测试 Skill

### 1. 需求分析

```markdown
## Skill 名称
api-testing-workflow

## 用途
指导开发者进行 RESTful API 的自动化测试

## 触发条件
API测试、接口测试、REST测试、自动化测试、集成测试

## 目标用户
- [x] 后端开发
- [x] 测试工程师

## 技术领域
- [x] 代码质量与测试

## 依赖的 Skills
- vitest
- api-design
```

### 2. 分类定位

- 目录：`quality/`
- 文件名：`api-testing-workflow.md`
- 完整路径：`.kiro/steering/quality/api-testing-workflow.md`

### 3. 参考现有

参考 `vitest.md` 和 `webapp-testing.md` 的结构

### 4. 生成文档

```markdown
---
inclusion: manual
description: API 自动化测试工作流，REST 接口测试最佳实践
---

# API 测试工作流

> 使用 Vitest + Supertest 进行 RESTful API 自动化测试

---

## 工作流概览

\`\`\`
设计测试用例 → 编写测试代码 → 运行测试 → 分析结果
\`\`\`

---

## 第一步：测试环境准备

### 安装依赖

\`\`\`bash
npm install -D vitest supertest @types/supertest
\`\`\`

### 配置 vitest.config.ts

\`\`\`typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
  },
});
\`\`\`

---

## 第二步：编写测试用例

### 基础 GET 请求测试

\`\`\`typescript
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app';

describe('GET /api/users', () => {
  it('应该返回用户列表', async () => {
    const response = await request(app)
      .get('/api/users')
      .expect(200);
    
    expect(response.body).toBeInstanceOf(Array);
    expect(response.body.length).toBeGreaterThan(0);
  });
});
\`\`\`

### POST 请求测试

\`\`\`typescript
describe('POST /api/users', () => {
  it('应该创建新用户', async () => {
    const newUser = {
      name: 'Test User',
      email: 'test@example.com',
    };
    
    const response = await request(app)
      .post('/api/users')
      .send(newUser)
      .expect(201);
    
    expect(response.body).toHaveProperty('id');
    expect(response.body.name).toBe(newUser.name);
  });
});
\`\`\`

---

## 第三步：测试最佳实践

### 测试组织

| 层级 | 用途 | 示例 |
|:---|:---|:---|
| describe | 分组相关测试 | `describe('User API', ...)` |
| it | 单个测试用例 | `it('should create user', ...)` |
| beforeEach | 测试前准备 | 清理数据库 |
| afterEach | 测试后清理 | 关闭连接 |

### 断言技巧

\`\`\`typescript
// 状态码
.expect(200)

// 响应头
.expect('Content-Type', /json/)

// 响应体结构
expect(response.body).toMatchObject({
  id: expect.any(Number),
  name: expect.any(String),
});
\`\`\`

---

## 常见问题

### 如何处理认证？

\`\`\`typescript
const token = 'your-jwt-token';

await request(app)
  .get('/api/protected')
  .set('Authorization', \`Bearer \${token}\`)
  .expect(200);
\`\`\`

### 如何测试错误情况？

\`\`\`typescript
it('应该返回 400 当数据无效', async () => {
  await request(app)
    .post('/api/users')
    .send({ name: '' })
    .expect(400);
});
\`\`\`

---

## 相关 Skills

- #vitest - 测试框架配置
- #api-design - API 设计规范
- #error-handling - 错误处理最佳实践
\`\`\`

### 5. 更新索引

在 `skills-index.md` 的 `quality/` 部分添加：

```markdown
| api-testing-workflow | API测试、接口测试、REST测试、自动化测试 | .kiro/steering/quality/api-testing-workflow.md |
```

---

## 快速生成提示词

```
我需要创建一个新的 skill 文档，请按照以下步骤帮我：

1. 需求分析
   - Skill 名称：[填写]
   - 用途：[填写]
   - 触发条件：[填写]
   - 目标用户：[填写]
   - 技术领域：[填写]

2. 分类定位
   - 确定应该放在哪个目录下
   - 确定文件名

3. 参考现有 skills
   - 在 skills-index.md 中找到 3 个相似的 skills
   - 读取它们的内容
   - 总结可复用的结构

4. 生成文档
   - 按照标准结构生成完整的 skill 文档
   - 包含至少 2 个实际示例
   - 确保格式符合规范

5. 更新索引
   - 在 skills-index.md 中添加新 skill 的条目
```

---

## 注意事项

1. **避免重复**：创建前先检查是否已有类似 skill
2. **保持更新**：技术栈变化时及时更新文档
3. **示例真实**：使用项目中实际的代码示例
4. **版本标注**：如果涉及特定版本，在文档中标明
5. **测试验证**：确保示例代码可以运行

---

## 维护指南

### 何时更新 Skill

- 技术栈升级（如 Vue 2 → Vue 3）
- 发现更好的实践方式
- 用户反馈内容不清晰
- 添加新的示例场景

### 更新流程

1. 在文档顶部添加更新日志
2. 修改相关内容
3. 更新 skills-index.md 中的描述（如需要）
4. 通知相关开发者

### 更新日志格式

```markdown
## 更新日志

- 2026-01-17: 添加 TypeScript 5.0 新特性示例
- 2025-12-01: 初始版本
```
