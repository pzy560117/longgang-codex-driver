---
name: midscene-framework
description: Midscene Test Framework Development Guide
---

# Midscene Test Framework 开发指南

基于 Midscene.js 的 AI 驱动 Android 测试框架，具备语义学习和知识库管理能力。

## 项目技术栈

| 类别     | 技术               | 版本      |
| -------- | ------------------ | --------- |
| 运行时   | Node.js            | >=18.0.0  |
| 语言     | TypeScript         | ^5.3.0    |
| AI 测试  | @midscene/android  | ^1.0.2    |
| Web 测试 | @midscene/web      | ^1.0.2    |
| 单元测试 | Vitest             | ^1.0.0    |
| 属性测试 | fast-check         | ^3.15.0   |
| 配置解析 | yaml               | ^2.3.4    |
| 环境变量 | dotenv             | ^17.2.3   |

## 项目结构

```
.
├── src/                    # 源代码
│   ├── agent/              # Android Agent 封装
│   ├── config/             # 配置管理
│   ├── data/               # 测试数据加载
│   ├── execution-log/      # 执行日志收集
│   ├── fallback/           # AI 操作降级机制
│   ├── knowledge/          # 知识库管理
│   ├── learning-mode/      # 学习模式
│   ├── lifecycle/          # 知识库生命周期
│   ├── logger/             # 日志系统
│   ├── navigation/         # 状态导航模块
│   │   ├── StateNavigator.ts    # 主导航类
│   │   ├── StateDetector.ts     # 状态检测器
│   │   ├── TransitionManager.ts # 转换管理器
│   │   └── PathFinder.ts        # 路径查找器
│   ├── offline/            # 离线分析
│   ├── optimization/       # AI 操作优化模块
│   │   ├── SmartWaitManager.ts      # 智能等待（指数退避）
│   │   ├── PopupHandler.ts          # 弹窗处理（aiActionContext）
│   │   ├── AICallTracker.ts         # AI 调用追踪
│   │   ├── OperationOptimizer.ts    # 批量操作优化
│   │   └── ConfigurationManager.ts  # 配置管理
│   ├── page/               # Page Object 基类
│   ├── prompt/             # Prompt 学习
│   ├── reporter/           # 测试报告
│   ├── retry/              # 重试机制
│   ├── semantic/           # 语义分析
│   ├── timeout/            # 超时预设
│   ├── types/              # 类型定义
│   └── utils/              # 工具函数
├── config/                 # 配置文件（设备、环境、优化）
│   └── optimization.yaml   # 优化模块配置
├── tests/                  # 测试文件
│   └── e2e/                # E2E 测试
├── knowledge/              # 知识库 YAML 文件
├── test-data/              # 测试数据 YAML 文件
├── reports/                # 测试报告
└── logs/                   # 执行日志
```

## 核心模块

### 1. AndroidAgent - Android 设备操作

```typescript
import { AndroidAgent } from './agent/AndroidAgent';

// 创建 Agent（自动连接）
const agent = await AndroidAgent.create({
  deviceId: 'emulator-5554',
  appPackage: 'com.example.app',
  timeout: 10000,
  launchDelay: 3000,  // APP 启动等待时间
});

// AI 操作
await agent.aiTap('点击登录按钮');
await agent.aiInput('test@example.com', '邮箱输入框');
await agent.aiAssert('页面显示欢迎信息');
await agent.aiWaitFor('加载完成', 5000);

// 查询操作
const result = await agent.aiQuery<string>('获取当前用户名');

// 断开连接
await agent.disconnect();
```

### 2. FallbackExecutor - AI 操作降级机制

```typescript
import { FallbackExecutor, DEFAULT_FALLBACK_CONFIG } from './fallback';

const executor = new FallbackExecutor(aiActFunction, {
  ...DEFAULT_FALLBACK_CONFIG,
  maxRetries: 3,
  enablePromptTransform: true,
});

// 执行带降级的 AI 操作
const result = await executor.execute('tap', '点击提交按钮');

if (result.success) {
  console.log('操作成功', result.attemptCount);
} else {
  console.log('操作失败', result.error);
}
```

### 3. KnowledgeManager - 知识库管理

```typescript
import { KnowledgeManager } from './knowledge/KnowledgeManager';

const km = new KnowledgeManager();

// 加载知识库
await km.load('knowledge/app-knowledge.yaml');

// 查询页面 Prompt
const prompts = km.getPagePrompts('LoginPage');

// 更新页面知识
km.updatePageKnowledge('LoginPage', {
  descriptions: ['登录页面'],
  identifiers: ['login_button', 'email_input'],
});

// 保存知识库
await km.save('knowledge/app-knowledge.yaml');
```

### 4. DataLoader - 测试数据加载

```typescript
import { DataLoader } from './data/DataLoader';

const loader = new DataLoader();

// 加载测试数据
const scenarios = await loader.loadScenarios('test-data/login/credentials.yaml');

// 遍历测试场景
for (const scenario of scenarios) {
  console.log(scenario.name, scenario.data);
}
```

### 5. BasePage - Page Object 基类

```typescript
import { BasePage } from './page/BasePage';

class LoginPage extends BasePage {
  async login(email: string, password: string) {
    await this.tap('邮箱输入框');
    await this.input(email, '邮箱输入框');
    await this.tap('密码输入框');
    await this.input(password, '密码输入框');
    await this.tap('登录按钮');
  }
}
```

### 6. LearningModeManager - 学习模式

```typescript
import { LearningModeManager } from './learning-mode';

const manager = new LearningModeManager({
  mode: 'active',
  autoSave: true,
});

// 记录操作结果
manager.recordOperation('tap', '点击按钮', true);

// 获取学习建议
const suggestions = manager.getSuggestions();
```

### 7. OfflineAnalyzer - 离线分析

```typescript
import { OfflineAnalyzer } from './offline';

const analyzer = new OfflineAnalyzer();

// 分析执行日志
const results = await analyzer.analyze('logs/execution/');

// 生成优化建议
const recommendations = analyzer.getRecommendations(results);
```

### 8. StateNavigator - 自适应状态导航

StateNavigator 是一个自适应状态导航模块，用于解决 E2E 测试中环境状态不一致的问题。它基于目标状态的导航策略，自动检测当前页面状态并执行必要操作到达目标页面。

#### 8.1 核心概念

- **PageState**: 页面状态枚举（splash, welcome_guide, login_page, login_input, main_page 等）
- **StateTransition**: 状态转换规则，定义从一个状态到另一个状态的操作
- **NavigationPath**: 导航路径，从当前状态到目标状态的转换序列

#### 8.2 通过 AndroidAgent 使用

```typescript
import { AndroidAgent } from './agent/AndroidAgent';

const agent = await AndroidAgent.create({
  deviceId: 'emulator-5554',
  appPackage: 'com.example.app',
});

// 获取 StateNavigator 实例
const navigator = agent.getStateNavigator('zh');  // 'zh' 或 'en'

// 检测当前页面状态
const stateResult = await agent.detectPageState();
console.log(`当前状态: ${stateResult.state}, 置信度: ${stateResult.confidence}`);

// 使用便捷方法导航
await agent.navigateToLogin();   // 导航到登录页
await agent.navigateToMain();    // 导航到主页
await agent.navigateToSettings(); // 导航到设置页

// 或使用 StateNavigator 直接导航
const success = await navigator.navigateTo('main_page');
if (!success) {
  console.log('导航失败');
}

// 确保到达目标状态（失败时抛出异常）
await navigator.ensureState('login_page');
```

#### 8.3 在 BasePage 中使用

```typescript
import { BasePage } from './page/BasePage';
import type { PageState } from './types/navigation';

class MyPage extends BasePage {
  async navigateTo(): Promise<void> {
    // 使用自适应导航到达目标状态
    await this.navigateToState('login_page');
  }
  
  async waitLoaded(): Promise<void> {
    await this.waitForState('登录页面已加载');
  }
}

// 创建 Page 时可以传入 Navigator 配置
const page = new MyPage(agent, logger, undefined, {
  language: 'zh',
  navigatorConfig: {
    maxAttempts: 10,
    checkInterval: 1000,
    verbose: true,
  },
});
```

#### 8.4 自定义转换规则

```typescript
import { StateNavigator, StateTransition } from './navigation';

const navigator = agent.getStateNavigator('zh');

// 注册自定义转换规则
navigator.registerTransition({
  from: 'login_page',
  to: 'register_page',
  action: async (agent, language) => {
    await agent.aiTap(language === 'zh' ? '注册按钮' : 'Register button');
  },
  description: '从登录页跳转到注册页',
  priority: 5,
});

// 支持多源状态
navigator.registerTransition({
  from: ['splash', 'welcome_guide'],  // 从闪屏或欢迎页
  to: 'login_page',
  action: async (agent, language) => {
    await agent.aiTap(language === 'zh' ? '跳过' : 'Skip');
  },
  description: '跳过引导页进入登录',
});
```

#### 8.5 配置选项

```typescript
interface NavigatorConfig {
  maxAttempts?: number;      // 最大尝试次数，默认 10
  checkInterval?: number;    // 检测间隔（毫秒），默认 1000
  detectTimeout?: number;    // 检测超时（毫秒），默认 5000
  verbose?: boolean;         // 详细日志，默认 true
  useSmartWait?: boolean;    // 使用智能等待，默认 true
  popupContext?: string;     // 弹窗处理上下文
}
```

#### 8.6 YAML 配置 (config/optimization.yaml)

```yaml
stateNavigator:
  enabled: true
  maxAttempts: 10
  checkInterval: 1000
  detectTimeout: 5000
  verbose: true
  useSmartWait: true
  defaultLanguage: zh
  popupContext: "如果出现权限弹窗、用户协议弹窗，点击同意。如果出现广告弹窗，点击关闭。"
```

### 9. 优化模块 - AI 操作优化

AndroidAgent 内置了多个优化模块，可显著提升测试效率和稳定性。

#### 9.1 SmartWaitManager - 智能等待

使用指数退避策略等待条件满足，避免固定等待时间的浪费。

```typescript
// 智能等待条件满足
const result = await agent.smartWaitFor(
  async () => {
    try {
      await agent.aiAssert('页面加载完成');
      return true;
    } catch {
      return false;
    }
  },
  '等待页面加载'
);

console.log(`等待耗时: ${result.duration}ms, 重试次数: ${result.retryCount}`);
```

#### 9.2 executeBatchOperations - 批量操作

将多个操作合并执行，利用 `freezePageContext` 减少截图次数。

```typescript
import type { Operation } from './types/optimization';

// 定义批量操作
const operations: Operation[] = [
  { type: 'tap', prompt: '用户名输入框' },
  { type: 'input', prompt: '用户名输入框', value: 'test@example.com' },
  { type: 'tap', prompt: '密码输入框' },
  { type: 'input', prompt: '密码输入框', value: 'password123' },
  { type: 'tap', prompt: '登录按钮' },
];

// 批量执行（自动冻结/解冻页面上下文）
const records = await agent.executeBatchOperations(operations);

// 查看执行记录
for (const record of records) {
  console.log(`${record.operation.type}: ${record.duration}ms, 成功: ${record.success}`);
}
```

#### 9.3 AICallTracker - AI 调用追踪

追踪和分析 AI 调用模式，识别优化机会。

```typescript
// 获取 AI 调用统计
const stats = agent.getAICallStats();
if (stats) {
  console.log(`总调用: ${stats.totalCalls}, 成功率: ${(stats.successRate * 100).toFixed(1)}%`);
  console.log(`平均耗时: ${stats.avgDuration.toFixed(0)}ms`);
}

// 检测重复调用模式
const duplicates = agent.detectDuplicateAICalls(3);
for (const dup of duplicates) {
  console.log(`重复调用: "${dup.prompt}" 连续 ${dup.count} 次`);
}

// 生成优化建议
const suggestions = agent.generateAICallSuggestions();
for (const suggestion of suggestions) {
  console.log(`建议: ${suggestion}`);
}

// 导出调用日志
const logsJson = agent.exportAICallLogs();
fs.writeFileSync('ai-calls.json', logsJson);
```

#### 9.4 PopupHandler - 弹窗处理

基于 `aiActionContext` 自动处理常见弹窗。

```typescript
// 获取 PopupHandler 实例
const popupHandler = agent.getPopupHandler();

// 注册自定义弹窗规则
popupHandler?.registerRule({
  id: 'custom-popup',
  type: 'custom',
  description: '自定义广告弹窗',
  action: '点击关闭按钮',
  priority: 10,
  enabled: true,
});

// 刷新 aiActionContext
agent.refreshAIActionContext();
```

#### 9.5 ConfigurationManager - 配置管理

通过 YAML 文件和环境变量管理优化配置。

```typescript
// 获取配置管理器
const configManager = agent.getConfigurationManager();

// 运行时修改配置
configManager?.set('smartWait.maxRetries', 15);
configManager?.set('operationOptimizer.enableBatchInput', true);

// 获取当前配置
const config = configManager?.getConfig();
console.log('当前配置:', config);
```

#### 9.6 优化配置文件 (config/optimization.yaml)

```yaml
optimization:
  smartWait:
    enabled: true
    initialDelay: 500
    maxDelay: 5000
    backoffFactor: 1.5
    stabilityCount: 3
    maxRetries: 10
    maxWaitTime: 30000
  
  midsceneCache:
    enabled: true
    id: 'default-cache'
    strategy: 'read-write'  # read-write | read-only | write-only
  
  popupHandler:
    enabled: true
    rules:
      - id: privacy-agreement
        type: privacy
        description: "隐私协议弹窗"
        action: "点击同意按钮"
        priority: 1
        enabled: true
  
  aiCallTracker:
    enabled: true
    duplicateThreshold: 3
    exportPath: "./logs/ai-calls.json"
  
  operationOptimizer:
    enableFreezeContext: true
    enablePopupPrecheck: true
    enableBatchInput: true
```

## 测试规范

### 单元测试

```typescript
// src/module/Module.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { Module } from './Module';

describe('Module', () => {
  let module: Module;

  beforeEach(() => {
    module = new Module();
  });

  it('should do something', () => {
    expect(module.doSomething()).toBe(expected);
  });
});
```

### 属性测试

```typescript
// src/module/Module.property.test.ts
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { Module } from './Module';

describe('Module Properties', () => {
  // Property 1: 描述属性
  // Validates: Requirements X.Y
  it('should satisfy property', () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        const result = module.process(input);
        return result.length >= 0;
      }),
      { numRuns: 100 }
    );
  });
});
```

### E2E 测试

```typescript
// tests/e2e/feature.e2e.ts
import { describe, it, beforeAll, afterAll } from 'vitest';
import { AndroidAgent } from '../../src/agent/AndroidAgent';

describe('Feature E2E', () => {
  let agent: AndroidAgent;

  beforeAll(async () => {
    agent = await AndroidAgent.create({
      deviceId: process.env.DEVICE_ID || 'emulator-5554',
      appPackage: 'com.example.app',
    });
  });

  afterAll(async () => {
    await agent?.disconnect();
  });

  it('should complete user flow', async () => {
    await agent.aiTap('开始按钮');
    await agent.aiAssert('进入主页面');
  });
});
```

## 配置文件格式

### 设备配置 (config/devices.yaml)

```yaml
devices:
  - id: emulator-5554
    name: Android Emulator
    platform: android
    version: "13"
```

### 测试数据 (test-data/xxx/data.yaml)

```yaml
scenarios:
  - name: valid_login
    description: 有效登录测试
    data:
      email: test@example.com
      password: password123
    expected:
      success: true
```

### 知识库 (knowledge/xxx.yaml)

```yaml
version: "1.0.0"
lastUpdated: "2025-01-01T00:00:00Z"
pages:
  LoginPage:
    name: LoginPage
    descriptions:
      - 登录页面
    identifiers:
      - login_button
    prompts:
      - bestPrompt: "点击登录按钮"
        alternativePrompts:
          - "点击登录"
    assertions:
      - pattern: "显示欢迎信息"
        importance: critical
contextHints: []
```

## 常用命令

```bash
# 运行所有单元测试
npm test

# 运行 E2E 测试
npm run test:e2e

# 构建项目
npm run build

# 代码覆盖率
npm run test:coverage

# 监听模式测试
npm run test:watch
```

## 类型定义

项目所有类型定义位于 `src/types/` 目录：

| 文件              | 描述                   |
| ----------------- | ---------------------- |
| agent.ts          | AndroidAgent 配置类型  |
| config.ts         | 设备/环境配置类型      |
| data.ts           | 测试数据类型           |
| execution-log.ts  | 执行日志类型           |
| fallback.ts       | 降级机制类型           |
| knowledge.ts      | 知识库类型             |
| learning-mode.ts  | 学习模式类型           |
| lifecycle.ts      | 生命周期类型           |
| logger.ts         | 日志类型               |
| navigation.ts     | 状态导航类型           |
| offline.ts        | 离线分析类型           |
| page.ts           | Page Object 类型       |
| prompt.ts         | Prompt 学习类型        |
| reporter.ts       | 测试报告类型           |
| retry.ts          | 重试机制类型           |
| semantic.ts       | 语义分析类型           |
| timeout.ts        | 超时预设类型           |
| optimization.ts   | 优化模块类型           |

## 错误处理

| 错误类型              | 场景             | 处理方式                     |
| --------------------- | ---------------- | ---------------------------- |
| ConnectionError       | 设备连接失败     | 检查 ADB 连接、设备 ID       |
| AIOperationError      | AI 操作失败      | 检查 Prompt、增加重试        |
| DataLoadError         | 数据加载失败     | 检查文件路径、YAML 格式      |
| ConfigurationError    | 配置错误         | 检查配置文件格式             |
| FallbackError         | 降级操作失败     | 检查降级配置、Prompt 转换    |
| SmartWaitTimeoutError | 智能等待超时     | 增加 maxRetries 或 maxWaitTime |

## 环境变量

在 `.env` 文件中配置：

```env
# AI 模型配置
OPENAI_API_KEY=your_api_key
MIDSCENE_MODEL_NAME=gpt-4o

# 设备配置
DEVICE_ID=emulator-5554
APP_PACKAGE=com.example.app

# 日志配置
LOG_LEVEL=info
```
