# Allure Report Skill - 使用示例

## 示例 1: 快速查看最近一次测试的报告

```powershell
# 查看指定运行目录的报告
npx allure serve midscene_run/2026-01-23_14-13-21-8ufgvd3i/allure-results
```

## 示例 2: 使用辅助脚本

```powershell
# 使用提供的脚本
.\.agent\skills\allure-report\scripts\view-allure.ps1 -RunDir "2026-01-23_14-13-21-8ufgvd3i"

# 指定端口
.\.agent\skills\allure-report\scripts\view-allure.ps1 -RunDir "2026-01-23_14-13-21-8ufgvd3i" -Port 54617
```

## 示例 3: 生成静态报告用于分享

```powershell
# 生成静态报告到 allure-report 目录
npx allure generate midscene_run/2026-01-23_14-13-21-8ufgvd3i/allure-results -o allure-report --clean

# 打开静态报告
npx allure open allure-report

# 或直接在浏览器中打开
start allure-report/index.html
```

## 示例 4: 对比多次运行结果

```powershell
# 打开第一次运行（端口 54617）
npx allure serve midscene_run/2026-01-23_14-13-21-8ufgvd3i/allure-results --port 54617

# 在另一个终端打开第二次运行（端口 54618）
npx allure serve midscene_run/2026-01-23_15-20-10-xyz123ab/allure-results --port 54618
```

## 示例 5: 错误排查

```powershell
# ❌ 错误：使用全局目录（会混入历史数据）
npx allure serve allure-results

# ✅ 正确：指定运行目录
npx allure serve midscene_run/2026-01-23_14-13-21-8ufgvd3i/allure-results

# 检查运行目录是否存在
Test-Path midscene_run/2026-01-23_14-13-21-8ufgvd3i/allure-results

# 列出所有可用的运行目录
Get-ChildItem -Path midscene_run -Directory | Select-Object Name, CreationTime
```

## 验证报告正确性

打开报告后，检查：

1. **概览页面**：
   - 报告生成时间应匹配运行目录时间戳
   - 测试用例数量应符合预期

2. **套件页面**：
   - 套件名称正确（如 `blocked-features.suite.yaml`）
   - 测试用例名称准确

3. **环境信息**：
   - OS 平台、版本
   - Node.js 版本

## 常见工作流

### 每日测试报告查看

```powershell
# 1. 运行测试（会自动生成 allure-results）
npx vitest --config vitest.e2e.config.ts

# 2. 查看最新的运行目录
$latestRun = Get-ChildItem -Path midscene_run -Directory | Sort-Object CreationTime -Descending | Select-Object -First 1

# 3. 打开报告
npx allure serve "midscene_run/$($latestRun.Name)/allure-results"
```

### 归档重要报告

```powershell
# 生成静态报告并归档
$runDir = "2026-01-23_14-13-21-8ufgvd3i"
npx allure generate "midscene_run/$runDir/allure-results" -o "reports/archive/$runDir" --clean

# 压缩归档
Compress-Archive -Path "reports/archive/$runDir" -DestinationPath "reports/archive/$runDir.zip"
```
