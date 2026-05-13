# Skills 使用指南

## Skill 已加载

当前项目的 skill package 位于：`.agents/skills/`

当前目录约定：

- `.agents/skills/`：active skill package
- `.agents/workflows/`：独立 workflow 文档
- `.agents/archive/workflows/skill-mirrors/`：已归档的 workflow 镜像副本

## 如何使用Skill

### 1. 自动识别
AI会根据任务需求自动判断并使用相关skill：
- 任务描述中包含skill相关的关键词
- AI判断某个skill适用于当前任务

### 2. 明确指定
您可以直接要求使用某个skill：
```
"使用 example-skill 来处理这个任务"
"按照 example-skill 的步骤执行"
"使用 harness-surface-sync 检查并同步 harness 流程"
"用 harness-surface-sync 扫一遍 testing-left-shift 文档和镜像"
"使用 auto-commit 检查当前改动、补齐同步并提交推送"
"用 auto-commit，如果没有 GitHub 仓库就用 gh 创建后再推送"
```

### 3. 浏览可用 Skills
查看所有可用的skills：
```
"显示所有可用的skills"
"列出项目中的skills"
```

## 当前可用的Skills

### Harness Surface Sync
- **位置**: `.agents/skills/harness-surface-sync/`
- **说明**: 一次性检查并同步 harness runtime、docs/testing、templates、workflows、config、package-assets 和 skills 镜像
- **适用场景**:
  - 规则、prompt、task 模板或 testing-left-shift 真相源刚改过
  - 需要继续扫旧流程表述并补齐镜像同步
  - 需要把新的 repo-local skill 一并打进 package-assets

### Auto Review and Commit
- **位置**: `.agents/skills/auto-commit/`
- **说明**: 一次性检查当前工作区、补齐必要同步、生成提交并推送；如果没有远程仓库，默认用 GitHub CLI 创建私有仓库
- **适用场景**:
  - 当前改动已经完成，准备收尾提交
  - 当前仓库有 `.agents` / `agent` / `templates` / `package-assets` 镜像，需要提交前补齐同步
  - 当前本地仓库还没有 `origin`，希望直接建 GitHub 仓库再推送

### AI Config Git Sync
- **位置**: `.agents/skills/ai-config-git-sync/`
- **说明**: 维护共享 AI workflow/config 到多个 Git 项目的同步链路，支持读状态、写配置、建同步分支、push 和开 PR
- **适用场景**:
  - 需要更新 `.ai-sync.yml`、`sync-targets.json` 或多项目同步脚本
  - 需要把 root AI 配置改动 fan-out 到多个项目仓库
  - 需要检查 drift、manifest、lock 或同步分支/PR 状态

### Example Skill
- **位置**: `.agents/skills/example-skill/`
- **说明**: 一个示例技能，展示如何创建和使用技能文件
- **包含**: 
  - SKILL.md: 主文档
  - scripts/: 辅助脚本
  - examples/: 使用示例
  - resources/: 配置模板

## Skill开发

创建新的skill：
1. 在 `.agents/skills/` 下创建新文件夹
2. 在文件夹中创建 `SKILL.md` 文件
3. 添加YAML frontmatter和详细说明
4. （可选）添加scripts、examples、resources等目录

## 系统级Skills

如果想让skill在所有项目中可用，可以复制到：
```
~/.gemini/antigravity/skills/
```

Windows路径：
```
C:\Users\<用户名>\.gemini\antigravity\skills\
```
