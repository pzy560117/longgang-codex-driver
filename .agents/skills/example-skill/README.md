# Example Skill

这是一个示例skill，展示了完整的skill文件结构。

## 目录结构

```
example-skill/
├── SKILL.md              # 主要技能文档（必需）
├── README.md             # 本文件
├── scripts/              # 辅助脚本目录
│   └── helper.py         # 示例辅助脚本
├── examples/             # 使用示例
│   └── usage.md          # 使用示例文档
└── resources/            # 资源文件
    └── config.json       # 配置模板
```

## 使用方法

1. 查看 `SKILL.md` 了解技能详细说明
2. 参考 `examples/usage.md` 查看使用示例
3. 使用 `scripts/` 目录中的辅助工具
4. 根据 `resources/` 中的模板进行配置

## 快速开始

```bash
# 查看主要文档
cat SKILL.md

# 运行示例脚本
python scripts/helper.py

# 查看使用示例
cat examples/usage.md
```
