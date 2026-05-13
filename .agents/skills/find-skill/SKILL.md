---
name: find-skill
description: 搜索和安装 Agent Skills。使用 npx skills 生态系统，从 GitHub 发现并安装 SKILL.md 格式的 Agent Skills，兼容 Claude Code、Cursor、Copilot、Gemini CLI、Antigravity 等多个 AI 工具。
---

# Find & Install Agent Skills

## 概述

使用 `npx skills` CLI 工具从开放的 Agent Skills 生态系统中搜索、发现和安装技能包。技能会自动安装到项目对应的 `.agents/skills/` 或 `.claude/skills/` 目录下。

## 核心命令

### 1. 搜索技能

```bash
npx skills find <关键词>
```

示例：
```bash
npx skills find frontend
npx skills find security
npx skills find testing
npx skills find code-review
```

### 2. 安装技能

从 GitHub 仓库安装整个技能集合：
```bash
npx skills add <owner>/<repo>
```

安装仓库中的特定技能：
```bash
npx skills add <owner>/<repo> --skill <skill-name>
```

示例：
```bash
# 安装 Vercel 官方技能集合
npx skills add vercel-labs/agent-skills

# 安装社区技能集合
npx skills add VoltAgent/awesome-agent-skills

# 安装特定技能
npx skills add anthropics/claude-code --skill frontend-design
```

### 3. 更新已安装技能

```bash
npx skills update
```

### 4. 创建新技能

```bash
npx skills init <skill-name>
```

## 推荐技能仓库

| 仓库 | 说明 |
|:---|:---|
| `vercel-labs/agent-skills` | Vercel 官方技能集 |
| `VoltAgent/awesome-agent-skills` | 社区精选技能合集 |
| `anthropics/skills` | Anthropic 官方技能 |
| `davepoon/buildwithclaude` | Claude Skills Hub（2.5k⭐）|

## 兼容平台

- ✅ Claude Code
- ✅ Cursor
- ✅ GitHub Copilot
- ✅ Gemini CLI
- ✅ Antigravity IDE
- ✅ OpenCode / Codex

## 使用流程

1. **搜索**：`npx skills find <关键词>` 发现相关技能
2. **评估**：查看技能的 `SKILL.md` 内容，确认安全性
3. **安装**：`npx skills add <owner>/<repo>` 安装到项目
4. **使用**：AI Agent 会自动发现并读取已安装的 SKILL.md

## 在线目录

更多技能可在 [https://skills.sh](https://skills.sh) 浏览发现。

## 安全提醒

> ⚠️ Agent Skills 本质上是可执行指令，安装前务必审查内容，避免 Prompt 注入或恶意代码。
