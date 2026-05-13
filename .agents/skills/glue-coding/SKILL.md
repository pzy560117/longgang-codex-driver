---
name: Glue Coding
description: 胶水编程开发方法 - 优先搜索 GitHub 完整项目并封装为接口，其次使用成熟库，快速实现功能。适用于开发新功能、集成第三方服务、构建 Bot/CLI/API 客户端等场景。当用户需要快速实现功能、集成多个库、或构建数据处理管道时使用此 skill。
---

# 胶水编程 (Glue Coding)

## 核心理念

胶水编程是一种通过组合和连接现有成熟项目/库来快速实现功能的开发方法，而非从零开始编写实现。核心原则：

- **优先搜索完整项目**：GitHub 上的完整项目已经组合好多个库、调优过、有最佳实践，比自己从零组装库更高效
- **三级搜索策略**：GitHub 项目 → 成熟库 → 最小自定义实现
- **最小化自定义代码**：胶水代码只做组合/调用/封装/适配
- **禁止重复造轮子**：不复制依赖代码到项目中
- **真实集成**：所有导入模块必须在运行期真实参与执行

## 工作流程

```
需求明确 → 寻找轮子（三级搜索） → 理解接口 → 描述连接 → 验证运行
```

---

## 第一步：需求明确

在开始寻找项目/库之前，必须明确：

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

## 第二步：寻找轮子（三级搜索策略）

### 搜索优先级

```
Level 1（最优先）: 搜索 GitHub 完整项目 → 找到能直接用的项目，封装为接口
  ↓ 没有合适的完整项目
Level 2: 搜索成熟库（pip/npm 包）→ 找到成熟库，封装 Adapter
  ↓ 没有合适的库
Level 3: 最小自定义实现（需提供调研证明）
```

> **核心思想**：别人封装好的完整项目，已经踩过坑、调过参、集成过多个库，比自己从零组装成熟库更可靠。

---

### Level 1: GitHub 项目调研（最优先）

#### 搜索策略

使用 GitHub MCP 工具系统化搜索：

| 策略 | MCP 工具 | 查询示例 |
|------|----------|----------|
| 主题搜索 | `search_repositories` | `"mahjong AI" stars:>100` |
| 关键词变体 | `search_repositories` | `"tile recognition OCR"` |
| 技术栈过滤 | `search_repositories` | `"mahjong bot" language:python` |
| 代码搜索 | `search_code` | `"class MahjongEngine"` |
| Awesome 列表 | `search_repositories` | `"awesome-mahjong"` |

#### 执行步骤

1. **生成搜索关键词**：根据需求生成 3-5 组关键词（含同义词、英文变体）
2. **多轮搜索**：对每组关键词调用 `search_repositories`，按 `stars` 降序
3. **代码搜索补充**：用 `search_code` 搜索特征性类名/函数名
4. **评分筛选**：按以下公式排名

```
composite_score = relevance × 0.4 + quality × 0.35 + activity × 0.25
```

| 维度 | 权重 | 计算规则 |
|------|------|----------|
| **relevance** | 0.4 | 根据描述/README 判断相关性：0.9+ 直接相关，0.7-0.89 高度相关 |
| **quality** | 0.35 | Stars、Forks、License、文档完整性的综合评分 |
| **activity** | 0.25 | 最近推送 <30天→0.9, 30-90天→0.7, 90-365天→0.4 |

5. **深度分析 Top 项目**：通过 MCP 远程读取代码（无需克隆）

| 分析维度 | MCP 工具 | 操作 |
|----------|----------|------|
| 目录结构 | `get_file_contents(path="/")` | 获取根目录 |
| README | `get_file_contents(path="README.md")` | 读取文档 |
| 依赖项 | `get_file_contents(path="requirements.txt")` | 读取依赖 |
| 核心代码 | `get_file_contents(path="src/...")` | 读取关键源文件 |
| 最近活动 | `list_commits(perPage=5)` | 查看提交 |

6. **封装友好度评估**（关键新增维度）：

| 评估项 | 通过标准 |
|--------|----------|
| API 清晰度 | 有明确的入口函数/类，参数和返回值有类型标注 |
| 依赖复杂度 | 依赖项 < 20 个，无系统级依赖冲突 |
| 许可证兼容 | MIT/Apache/BSD 等宽松许可证 |
| 可独立运行 | 可通过 pip install 或 git clone 直接使用 |
| 文档完整性 | 有 README + API 文档或 examples |

7. **选择最佳项目**：综合评分最高 + 封装友好度通过的项目

#### Level 1 输出格式

```markdown
## GitHub 项目调研结果

### 搜索关键词
- [关键词1], [关键词2], ...

### Top 项目排名
| # | 仓库 | ⭐ Stars | 语言 | 综合分 | 封装友好度 |
|---|------|---------|------|--------|-----------|
| 1 | owner/name | 2959 | Python | 0.91 | ✅ 通过 |

### 推荐项目
**owner/project_name** — 推荐理由
- 核心功能：...
- 入口接口：`ClassName.method()`
- 封装策略：...
```

---

### Level 2: 成熟库搜索

仅当 Level 1 未找到合适项目时执行。

#### 搜索策略

1. 分析需求涉及的技术领域
2. 推荐对应的 GitHub Topics 关键词
3. 评估候选库的质量指标：
   - Star 数量（>1000 优先）
   - 最近更新时间（<6个月）
   - Issue 活跃度
   - 文档完整性
   - 许可证兼容性

#### 常用 Topics

| 需求 | Topic |
|:---|:---|
| Telegram Bot | telegram-bot |
| 数据分析 | data-analysis |
| AI Agent | ai-agent |
| CLI 工具 | cli |
| Web 爬虫 | web-scraping |
| API 客户端 | api-client |

---

### Level 3: 最小自定义实现

仅当 Level 1 和 Level 2 均无法满足需求时，才允许自定义实现。

**必须提供调研证明**：
- GitHub 搜索记录（关键词 + 结果数量）
- 分析过的 Top 项目列表及不适用原因
- 搜索过的库列表及不适用原因

---

## 第三步：理解接口

### 针对 GitHub 项目

1. 通过 MCP 远程读取核心源文件
2. 识别入口类/函数
3. 梳理输入参数和输出格式
4. 运行 examples 验证

### 针对成熟库

1. 阅读官方文档
2. 让 AI 总结核心 API
3. 明确输入和输出

### 输出格式

```markdown
## 项目/库名称
xxx

## 来源
GitHub 项目 / PyPI 库

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
├── libs/
│   ├── external_projects/   # GitHub 项目（git submodule 或 pip install from git）
│   │   ├── project_a/
│   │   └── project_b/
│   └── packages/            # pip/npm 包（通过 requirements.txt 管理）
├── src/
│   ├── glue/
│   │   ├── project_adapters/  # 项目级适配器（封装 GitHub 项目）
│   │   ├── adapters/          # 库级适配器（封装 pip/npm 包）
│   │   └── connectors/        # 连接器（组合多个适配器）
│   └── core/                  # 最小业务逻辑
└── main.py
```

---

## 第五步：验证运行

### 验证清单

- [ ] 所有导入模块在运行期真实参与执行
- [ ] 无"只导入不用"的伪集成
- [ ] 无路径遮蔽或重名模块问题
- [ ] 功能与预期一致
- [ ] 错误处理正常
- [ ] GitHub 项目的许可证已确认兼容

### 调试流程

```
跑通 → 完成
  ↓
报错 → 复制完整错误 → 给 AI → 继续粘
```

---

## 约束检查清单

### 开发前

- [ ] 已完成 Level 1 GitHub 项目调研（记录搜索关键词和结果）
- [ ] Level 1 无合适项目时，已完成 Level 2 库搜索
- [ ] 确认选择的项目/库是生产级实现
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

## 示例：将 GitHub 项目封装为 Adapter

### 需求

需要一个麻将牌识别模块

### Level 1 调研结果

搜索到 `github.com/example/mahjong-tile-detector`（⭐ 3200，Python，MIT 许可证），已集成 YOLOv8 + 数据增强 + 预训练模型。

### 项目级 Adapter

```python
# src/glue/project_adapters/tile_detector_adapter.py

"""
麻将牌检测器适配器 - 封装 mahjong-tile-detector 项目

来源: github.com/example/mahjong-tile-detector
许可证: MIT
版本: v2.1.0 (commit: abc1234)
"""

from mahjong_tile_detector import TileDetector, TileResult
from src.core.models import Tile, DetectionResult
from loguru import logger


class TileDetectorAdapter:
    """
    封装 mahjong-tile-detector 项目，提供统一的牌检测接口

    将第三方项目的 TileResult 转换为本项目的 Tile 数据模型
    """

    def __init__(self, model_path: str = "default"):
        """
        初始化检测器

        Args:
            model_path: 模型路径，"default" 使用项目自带预训练模型
        """
        self._detector = TileDetector(model=model_path)
        logger.info(f"牌检测器初始化完成, model={model_path}")

    def detect(self, screenshot: bytes) -> DetectionResult:
        """
        检测截图中的麻将牌

        Args:
            screenshot: PNG 格式的截图字节数据

        Returns:
            检测结果，包含牌列表和置信度
        """
        raw_results: list[TileResult] = self._detector.predict(screenshot)
        tiles = [self._convert(r) for r in raw_results]
        logger.debug(f"检测到 {len(tiles)} 张牌: {tiles}")
        return DetectionResult(tiles=tiles, confidence=self._avg_conf(raw_results))

    def _convert(self, result: TileResult) -> Tile:
        """将第三方项目的 TileResult 转换为本项目的 Tile 模型"""
        return Tile(suit=result.suit, rank=result.rank, position=result.bbox)

    def _avg_conf(self, results: list[TileResult]) -> float:
        """计算平均置信度"""
        if not results:
            return 0.0
        return sum(r.confidence for r in results) / len(results)
```

### 对比效果

| 维度 | 自己从零组装库 | 封装 GitHub 项目 |
|------|--------------|----------------|
| 代码量 | ~500 行 | ~50 行 Adapter |
| 开发时间 | 1 周 | 2 小时 |
| 可靠性 | 需自己调参 | 项目已调优 |
| 预训练模型 | 需自己训练 | 项目自带 |

---

## 最佳实践

1. **项目优先于库**：完整的 GitHub 项目已经过实战验证，比组装原始库更可靠
2. **深度分析再封装**：不要只看 Star 数，必须读核心代码确认质量
3. **薄胶水层**：Adapter 只做接口转换，不加业务逻辑
4. **记录来源**：每个 Adapter 头部注明 GitHub 项目地址、许可证、版本/commit
5. **版本锁定**：对 GitHub 项目锁定到具体 commit hash 或 tag
6. **验证真实性**：确保所有导入的模块都在实际执行中被调用
