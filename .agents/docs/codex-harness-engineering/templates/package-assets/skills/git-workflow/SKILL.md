---
name: git-workflow
description: Git Workflow Skill
---

# Git Workflow Skill

Git 版本控制最佳实践和工作流规范。

## 分支策略

### Git Flow 模型
- **main/master**: 生产环境代码，始终可部署
- **develop**: 开发主分支，集成最新功能
- **feature/xxx**: 功能分支，从 develop 创建
- **hotfix/xxx**: 紧急修复，从 main 创建
- **release/xxx**: 发布准备分支

### 分支命名规范
```
feature/user-authentication
feature/JIRA-123-add-login
bugfix/fix-null-pointer
hotfix/security-patch-v1.2.1
release/v2.0.0
```

## Commit Message 规范

### Conventional Commits 格式
```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type 类型
| Type | 说明 |
|------|------|
| feat | 新功能 |
| fix | Bug 修复 |
| docs | 文档更新 |
| style | 代码格式（不影响逻辑） |
| refactor | 重构（非新功能、非修复） |
| perf | 性能优化 |
| test | 测试相关 |
| chore | 构建/工具变动 |
| ci | CI 配置变更 |

### 示例
```
feat(auth): 添加 OAuth2.0 登录支持

- 集成 Google OAuth
- 添加 token 刷新机制
- 更新用户模型

Closes #123
```

## 操作规范

### 合并策略
- **功能分支**: Squash merge 保持历史整洁
- **发布分支**: Merge commit 保留完整历史
- **Hotfix**: Cherry-pick 或直接 merge

### 禁止事项
- 不在 main/develop 上直接提交
- 不 force push 公共分支
- 不提交敏感信息（密钥、密码）
- 不提交大型二进制文件

### .gitignore 必备项
```
node_modules/
.env
.env.local
*.log
.DS_Store
dist/
build/
coverage/
.idea/
.vscode/settings.json
```

## 常用命令

```bash
# 交互式 rebase 整理提交
git rebase -i HEAD~3

# 暂存当前修改
git stash push -m "WIP: feature description"

# 查看文件修改历史
git log --follow -p -- <file>

# 撤销最近一次提交（保留修改）
git reset --soft HEAD~1

# 修改最近一次提交信息
git commit --amend -m "new message"
```

