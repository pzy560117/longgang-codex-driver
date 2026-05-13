---
name: Allure Report
description: 生成和查看 Allure 测试报告 - 从指定的测试运行目录生成准确的报告
---

# Allure Report - Allure 测试报告生成与查看

## 概述

本技能提供了生成和查看 Allure 测试报告的标准化方法。Allure 是一个灵活的多语言测试报告工具，可以生成美观的、交互式的测试报告，包含详细的测试历史、图表、时间线等功能。

## 何时使用此技能

- 用户想要查看特定测试运行的 Allure 报告
- 需要从 `midscene_run` 目录中的某次运行生成报告
- 需要确保报告数据与特定运行目录匹配（避免使用全局混合数据）
- 需要以可视化方式分析测试结果

## 关键原则

> [!IMPORTANT]
> **数据源准确性**：必须从指定的运行目录的 `allure-results` 生成报告，而不是使用全局目录。这样可以确保报告数据与具体的测试运行一一对应。

## 使用步骤

### 步骤 1: 识别测试运行目录

测试运行目录位于 `midscene_run/<timestamp>-<id>/` 下，例如：
```
midscene_run/2026-01-23_14-13-21-8ufgvd3i/
├── allure-results/    # Allure 原始结果文件
├── report/            # Midscene HTML 报告
├── log/              # 日志文件
└── screenshots/      # 截图文件
```

### 步骤 2: 生成并查看报告（推荐方式）

使用 `allure serve` 命令直接从指定目录启动服务：

```powershell
npx allure serve midscene_run/<运行目录>/allure-results
```

**示例**：
```powershell
npx allure serve midscene_run/2026-01-23_14-13-21-8ufgvd3i/allure-results
```

**优点**：
- ✅ 自动生成临时报告并打开浏览器
- ✅ 数据源准确，不会混入其他测试数据
- ✅ 无需手动清理生成的报告文件

### 步骤 3: 生成自定义品牌报告（推荐）

使用自定义品牌脚本生成带有公司 logo 和配色的报告：

```powershell
.\allure-custom\inject-custom.ps1 -RunDir "<运行目录名称>"
```

**示例**：
```powershell
.\allure-custom\inject-custom.ps1 -RunDir "2026-01-23_14-13-21-8ufgvd3i"
```

**特性**：
- ✅ 自动注入自定义蓝色 logo
- ✅ 应用蓝色主题配色 (#1B8AC8)
- ✅ 设置中文为默认语言
- ✅ 自动打开浏览器查看

### 步骤 4: 生成标准静态报告（可选）

如果需要生成标准的 Allure 报告（无自定义品牌）：

```powershell
npx allure generate midscene_run/<运行目录>/allure-results -o <输出目录> --clean
```

**示例**：
```powershell
# 生成到 allure-report 目录
npx allure generate midscene_run/2026-01-23_14-13-21-8ufgvd3i/allure-results -o allure-report --clean

# 打开静态报告
npx allure open allure-report
```

## 命令对比

| 命令 | 用途 | 数据源 | 适用场景 |
|------|------|--------|----------|
| `allure serve <dir>/allure-results` | 临时服务 | 指定目录 | ✅ **推荐**：快速查看单次运行 |
| `allure generate + allure open` | 静态报告 | 指定目录 | 保存报告供分享 |
| `allure serve allure-results` | 临时服务 | 全局目录 | ❌ **避免**：可能混入历史数据 |

## 报告内容说明

Allure 报告包含以下主要部分：

### 左侧导航栏
- 📊 **Overview** (概览): 测试统计、通过率、环境信息
- 📁 **Suites** (套件): 按测试套件分组的详细结果
- 📈 **Graphs** (图表): 各种可视化统计图表
- ⏱️ **Timeline** (时间线): 测试执行的时间分布
- 🎯 **Behaviors** (行为): 按标签/特性分组
- 📦 **Packages** (包): 按代码包结构查看

### 验证报告正确性

检查以下指标确保报告数据正确：
- ✅ 报告标题的日期/时间与运行目录匹配
- ✅ 测试用例数量与预期一致
- ✅ 套件名称正确（如 `blocked-features.suite.yaml`）

## 常见问题

**Q: 为什么报告显示的测试数量不对？**

A: 可能使用了全局 `allure-results` 目录，包含了历史测试数据。解决方法：
```powershell
# ❌ 错误：使用全局目录
npx allure serve allure-results

# ✅ 正确：指定运行目录
npx allure serve midscene_run/2026-01-23_14-13-21-8ufgvd3i/allure-results
```

**Q: 如何关闭 Allure 服务？**

A: 在命令行中按 `Ctrl+C`，或者：
```powershell
# Windows
taskkill /F /IM node.exe /FI "WINDOWTITLE eq allure*"
```

**Q: 报告左侧导航栏看不到怎么办？**

A: 
1. 点击浏览器左上角的汉堡菜单图标（☰）展开侧边栏
2. 扩大浏览器窗口宽度
3. 检查是否使用了正确的 `allure serve` 命令

**Q: 可以同时打开多个运行的报告吗？**

A: 可以，使用不同的端口：
```powershell
npx allure serve midscene_run/run1/allure-results --port 54617
npx allure serve midscene_run/run2/allure-results --port 54618
```

## 配置说明

Allure 配置在 `vitest.e2e.config.ts` 中：

```typescript
reporters: [
  'verbose',
  [
    'allure-vitest/reporter',
    {
      resultsDir: getAllureResultsDir(), // 结果输出目录
      environmentInfo: {                 // 环境信息
        os_platform: os.platform(),
        os_release: os.release(),
        node_version: process.version,
      },
    },
  ],
]
```

## 最佳实践

1. **始终从运行目录启动**：确保报告数据与测试运行对应
2. **使用 `allure serve`**：快速查看，无需清理临时文件
3. **验证数据正确性**：检查日期、测试数量、套件名称
4. **保存重要报告**：使用 `allure generate` 生成静态报告

## 示例脚本

创建便捷的报告查看脚本 `scripts/view-allure.ps1`：

```powershell
# view-allure.ps1
param(
    [Parameter(Mandatory=$true)]
    [string]$RunDir
)

$allureResultsPath = "midscene_run/$RunDir/allure-results"

if (-not (Test-Path $allureResultsPath)) {
    Write-Error "Allure results not found: $allureResultsPath"
    exit 1
}

Write-Host "📊 Opening Allure report for: $RunDir" -ForegroundColor Green
npx allure serve $allureResultsPath
```

使用示例：
```powershell
.\scripts\view-allure.ps1 -RunDir "2026-01-23_14-13-21-8ufgvd3i"
```

## 相关资源

- [Allure 官方文档](https://docs.qameta.io/allure/)
- [allure-vitest GitHub](https://github.com/allure-framework/allure-js/tree/master/packages/allure-vitest)
- 项目配置: `vitest.e2e.config.ts`
- 运行目录: `midscene_run/`

## 注意事项

> [!WARNING]
> - 不要使用全局 `allure-results` 目录查看报告，会导致数据混合
> - 确保 Allure 服务端口未被占用（默认随机分配）
> - 大型报告可能需要较长加载时间

> [!TIP]
> - 使用浏览器的开发者工具可以查看报告加载细节
> - 报告支持多种语言，可在设置中切换
> - 可以导出报告为 HTML 文件供离线查看

## 更新日志

- **2026-01-23**: 创建初始版本，基于项目实践经验
