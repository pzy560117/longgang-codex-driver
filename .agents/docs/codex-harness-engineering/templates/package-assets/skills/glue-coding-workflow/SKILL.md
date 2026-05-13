---
name: glue-coding-workflow
description: 胶水编程完整工作流，通过 #glue-coding-workflow 引用
---

# 胶水编程工作流

> 当需要开发新功能时，优先使用此工作流

---

## 工作流概览

```
需求明确 → 寻找轮子 → 理解接口 → 描述连接 → 验证运行
```

---

## 第一步：需求明确

### 输出格式

```markdown
## 目标
一句话描述要实现什么

## 非目标
明确不做什么

## 输入
- 数据来源
- 数据格式

## 输出
- 期望结果
- 输出格式
```

---

## 第二步：寻找轮子

### 搜索策略

1. 让 AI 分析需求涉及的技术领域
2. 推荐对应的 GitHub Topics 关键词
3. 评估候选库的质量指标：
   - Star 数量（>1000 优先）
   - 最近更新时间（<6个月）
   - Issue 活跃度
   - 文档完整性
   - 许可证兼容性

### 常用 Topics

| 需求 | Topic |
|:---|:---|
| Telegram Bot | telegram-bot |
| 数据分析 | data-analysis |
| AI Agent | ai-agent |
| CLI 工具 | cli |
| Web 爬虫 | web-scraping |
| API 客户端 | api-client |

### 提示词模板

```
我需要实现 [你的需求]，请帮我：
1. 分析这个需求可能涉及哪些技术领域
2. 推荐对应的 GitHub Topics 关键词
3. 搜索并推荐 3-5 个成熟的开源库
4. 对比它们的优缺点
5. 给出最终推荐
```

---

## 第三步：理解接口

### 文档喂给 AI

1. 下载官方文档到本地
2. 让 AI 总结核心 API
3. 明确：输入是什么，输出是什么

### 输出格式

```markdown
## 库名称
xxx

## 核心功能
- 功能1：描述
- 功能2：描述

## 关键 API
### API 1
- 输入：参数类型和含义
- 输出：返回值类型和含义
- 示例：代码片段

### API 2
...
```

---

## 第四步：描述连接

### 连接描述模板

```markdown
## 数据流
A 的输出 → 转换逻辑 → B 的输入

## 胶水代码职责
1. 封装接口
2. 统一输入输出格式
3. 错误处理
4. 日志记录
```

### 代码组织

```
project/
├── libs/external/     # 第三方库（不可修改）
├── src/
│   ├── glue/          # 胶水代码
│   │   ├── adapters/  # 适配器
│   │   └── connectors/ # 连接器
│   └── core/          # 最小业务逻辑
└── main.py            # 入口
```

---

## 第五步：验证运行

### 验证清单

- [ ] 所有导入模块在运行期真实参与执行
- [ ] 无"只导入不用"的伪集成
- [ ] 无路径遮蔽或重名模块问题
- [ ] 功能与预期一致
- [ ] 错误处理正常

### 调试流程

```
跑通 → 完成
  ↓
报错 → 复制完整错误 → 给 AI → 继续粘
```

---

## 约束检查清单

### 开发前

- [ ] 确认没有现成的开源实现
- [ ] 确认选择的库是生产级实现
- [ ] 确认许可证兼容

### 开发中

- [ ] 未复制依赖库代码到项目
- [ ] 未对依赖库进行功能裁剪
- [ ] 未使用 Mock/Stub 替代真实实现
- [ ] 胶水代码只做组合/调用/封装/适配

### 开发后

- [ ] 所有模块真实参与执行
- [ ] 无未使用的导入
- [ ] 功能完整性验证通过

---

## 示例：Polymarket 数据分析 Bot

### 需求

实时获取 Polymarket 数据，分析后推送到 Telegram

### 轮子选择

```
轮子 1: polymarket-py (官方 SDK)
轮子 2: pandas (数据分析)
轮子 3: python-telegram-bot (消息推送)
```

### 胶水代码

```python
# glue/connectors/polymarket_to_telegram.py

from polymarket import Client as PolymarketClient
from telegram import Bot
import pandas as pd

class PolymarketTelegramConnector:
    """连接 Polymarket 数据到 Telegram 推送"""
    
    def __init__(self, pm_api_key: str, tg_token: str, chat_id: str):
        self.pm_client = PolymarketClient(api_key=pm_api_key)
        self.tg_bot = Bot(token=tg_token)
        self.chat_id = chat_id
    
    def fetch_and_analyze(self, market_id: str) -> pd.DataFrame:
        """获取数据并分析"""
        data = self.pm_client.get_market(market_id)
        df = pd.DataFrame(data)
        # 分析逻辑
        return df
    
    def send_report(self, df: pd.DataFrame) -> None:
        """发送报告到 Telegram"""
        message = self._format_report(df)
        self.tg_bot.send_message(chat_id=self.chat_id, text=message)
```

### 结果

- 胶水代码：50 行
- 开发时间：2 小时
- 传统做法：3000 行，2 周
