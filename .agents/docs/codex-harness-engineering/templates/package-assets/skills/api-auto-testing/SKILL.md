---
name: api-auto-testing
description: API 接口自动化测试方法论。基于 Pytest + Requests + Allure 的 3 阶段流程（测试矩阵→用例实现→报告生成），覆盖认证、CRUD、权限、参数校验、业务流 5 大维度。适用于 RESTful API 后端接口测试。
---

# API 自动化测试 — 方法论与工作流

你是一位资深的后端测试工程师。你的任务是为 RESTful API 后端设计并实施全面的接口自动化测试。

## 核心理念

- **需求驱动**: 从接口文档/需求文档出发，确保每个接口都有对应测试
- **分层设计**: ApiClient 封装 → Fixtures 数据准备 → 测试用例 → Allure 报告
- **零 Mock**: 测试直接打真实后端，验证端到端行为
- **容错重试**: 对不稳定的后端环境内置指数退避重试
- **结构化报告**: Allure 集成，每个请求/响应自动记录

---

## 测试维度体系（5 维度）

每个接口至少覆盖以下维度：

| # | 维度 | 测试点 | 优先级 |
|---|------|--------|--------|
| A1 | 认证鉴权 | Token 有效/无效/过期/刷新、角色权限 | P0 |
| A2 | 正常流程 | 正确参数→成功响应、数据结构验证 | P0 |
| A3 | 参数校验 | 必填缺失/格式错误/边界值/类型错误 | P1 |
| A4 | 业务约束 | 重复操作/状态流转/关联数据/并发 | P1 |
| A5 | 权限隔离 | 跨角色访问/跨用户数据/越权操作 | P0 |

---

## 🔑 3 阶段工作流程

```
阶段1: 生成测试矩阵 (api_test_matrix.md)
         ↓ 用户确认
阶段2: 实现测试用例 + 运行
         ↓
阶段3: 生成 Allure 报告 + 结果分析
```

### 阶段 1: 测试矩阵生成

**输入**: 接口文档 / 需求规格  
**输出**: `reports/api/api_test_matrix.md`

#### 1.1 接口清单提取

从需求文档/Swagger/Controller 源码提取所有接口：

```markdown
## 接口清单

| API-ID | 方法 | 路径 | 功能 | 所属模块 | 角色 |
|--------|------|------|------|----------|------|
| API-001 | POST | /auth/register | 用户注册 | 认证 | 匿名 |
| API-002 | POST | /auth/login | 用户登录 | 认证 | 匿名 |
| API-010 | GET | /scripts | 剧本列表 | 剧本 | admin |
```

#### 1.2 测试矩阵

为每个接口标注需要覆盖的维度和用例数：

```markdown
## 测试矩阵

| API-ID | 接口 | A1 认证 | A2 正常 | A3 校验 | A4 业务 | A5 权限 | TC总数 |
|--------|------|---------|---------|---------|---------|---------|--------|
| API-001 | 注册 | - | 1 | 3 | 1 | - | 5 |
| API-002 | 登录 | - | 1 | - | - | - | 3 |
| API-010 | 剧本列表 | 1 | 1 | - | - | 1 | 3 |
```

#### 1.3 用例清单

```markdown
## 用例清单

### 认证模块

| TC-ID | API-ID | 维度 | 标题 | 标记 |
|-------|--------|------|------|------|
| TC-A-001 | API-001 | A2 | 正常注册 | smoke |
| TC-A-002 | API-001 | A3 | 手机号格式错误 | |
| TC-A-003 | API-001 | A3 | 密码太短 | |
| TC-A-004 | API-001 | A4 | 重复注册 | |
```

### 阶段 2: 测试用例实现

#### 2.1 项目结构

```
tests/
├── conftest.py          ← 全局 fixtures: 3 角色 client
├── utils/
│   ├── config.py        ← 环境配置（URL/账号/错误码）
│   ├── api_client.py    ← HTTP 封装 + Allure 集成
│   └── helpers.py       ← 数据生成器
├── api/
│   ├── conftest.py      ← API fixtures: 测试数据创建
│   ├── test_auth.py     ← 认证模块测试
│   ├── test_scripts.py  ← 剧本模块测试
│   └── ...
└── pytest.ini           ← markers + 插件配置
```

#### 2.2 ApiClient 设计原则

```python
class ApiClient:
    """
    核心设计:
    1. 自动拼接 BASE_URL + API_PREFIX + path
    2. 自动携带 JWT Token (Authorization header)
    3. 每个请求/响应自动记录到 Allure
    4. login() 方法内置指数退避重试（应对 502/500）
    5. 提供 login_as(role) 快捷登录
    """
```

**重试策略**（应对后端不稳定）：

```python
def login(self, phone, password, retries=3):
    for attempt in range(retries):
        resp = self.post("/auth/login", json={...})
        if resp.status_code == 200:
            break
        time.sleep(2 ** attempt)  # 指数退避: 1s, 2s, 4s
```

#### 2.3 Fixtures 设计原则

| 层级 | scope | 用途 | 示例 |
|------|-------|------|------|
| 全局 | session | 角色 client 复用 | `admin_client`, `user_client` |
| 模块 | session | 前置数据（剧本/DM/场次） | `test_script_id`, `test_dm_id` |
| 用例 | function | 独立匿名 client | `anon_client` |

**Fixture 依赖链**（自动解决前置数据）：

```
admin_client ← test_script_id ← test_session_id ← test_booking用例
                test_dm_id ←─────┘
```

#### 2.4 断言工具函数

```python
# 成功响应断言
assert_success(resp, message="xxx")
# → 验证 status_code=200 且 code=SUCCESS_CODE

# 错误响应断言
assert_error(resp, expected_code=ErrorCode.UNAUTHORIZED)
# → 验证业务错误码匹配

# 分页数据断言
assert_page_data(data, check_items=True)
# → 验证 total/items/page 结构
```

#### 2.5 用例编写规范

```python
@allure.epic("模块名")        # 一级分组
@pytest.mark.api             # 标记: 接口测试
@pytest.mark.auth            # 标记: 所属模块
class TestLogin:
    """API-002 用户登录"""

    @allure.story("正常登录")  # 二级分组
    @pytest.mark.smoke        # 标记: 冒烟测试
    def test_login_success(self, anon_client):
        """正确的手机号和密码应登录成功"""
        resp = anon_client.post("/auth/login", json={...})
        data = assert_success(resp, "登录应成功")
        assert "token" in data["data"]

    @allure.story("参数校验 - 手机号格式")
    @pytest.mark.parametrize("bad_phone", ["", "123", "abc"])
    def test_login_invalid_phone(self, anon_client, bad_phone):
        """手机号格式错误应被拒绝"""
        ...
```

**编写规则**：

1. **类名** = `Test{操作}` 对应一个 API
2. **方法名** = `test_{场景}` 语义清晰
3. **docstring** = 一句话描述预期行为
4. **Allure 标注** = `@allure.epic` + `@allure.story` + `@pytest.mark`
5. **parametrize** 覆盖多组参数校验场景
6. **断言使用封装函数**，不直接写 `assert resp.status_code == 200`

#### 2.6 运行命令

```bash
# 全量运行 + Allure 结果
pytest tests/api -v --alluredir=reports/allure-results-api

# 仅冒烟测试
pytest tests/api -m smoke --alluredir=reports/allure-results-api

# 仅某模块
pytest tests/api/test_auth.py -v

# 生成并打开 Allure 报告
npx -y allure-commandline generate reports/allure-results-api -o reports/allure-report-api --clean
npx -y allure-commandline open reports/allure-report-api
```

### 阶段 3: 报告与分析

#### 3.1 Allure 报告展示

配置 `@allure.epic` / `@allure.story` 后，Allure 报告自动按模块分组：

```
Behaviors 视图:
├── 认证服务
│   ├── 正常注册 (PASS)
│   ├── 手机号重复注册 (PASS)
│   ├── 正常登录 (PASS)
│   └── 密码错误 (PASS)
├── 剧本管理
│   ├── 剧本列表 (PASS)
│   └── 创建剧本 (BROKEN)  ← 后端 500
└── 预约服务
    ├── 创建预约 (PASS)
    └── 取消预约 (FAIL)
```

#### 3.2 结果分类

| Allure 状态 | 含义 | 处理方式 |
|-------------|------|----------|
| ✅ PASSED | 测试通过 | — |
| ❌ FAILED | 断言失败（前端/测试 Bug） | 修复测试或提 Bug |
| 💥 BROKEN | 异常（后端 500/超时） | 协调后端修复 |
| ⏭ SKIPPED | 跳过（前置条件不满足） | 检查 fixture 链 |

#### 3.3 通过率分析模板

```markdown
## 接口测试结果

| 模块 | TC 数 | PASS | FAIL | BROKEN | 通过率 |
|------|-------|------|------|--------|--------|
| 认证 | 15 | 14 | 0 | 1 | 93% |
| 剧本 | 12 | 10 | 1 | 1 | 83% |
| 合计 | 92 | 78 | 5 | 9 | 85% |

### BROKEN 分析（后端问题）
| TC | 接口 | 错误 | 建议 |
|----|------|------|------|
| TC-xx | POST /scripts | 502 Bad Gateway | 后端服务重启 |

### FAIL 分析（测试/业务 Bug）
| TC | 接口 | 期望 | 实际 |
|----|------|------|------|
| TC-xx | PUT /auth/me | name 更新 | 返回旧 name |
```

---

## 测试数据策略

| 数据类型 | 策略 | 示例 |
|----------|------|------|
| 预置账号 | config.py 固定配置 | admin/staff/user 三角色 |
| 测试数据 | helpers.py 随机生成 | `random_phone()`, `random_script_data()` |
| 前置数据 | session-scope fixture 创建 | `test_script_id` → 全局复用 |
| 时间数据 | 动态生成未来时间 | `future_datetime_pair(days=7)` |

## 容错与稳定性

| 问题 | 解决方案 |
|------|----------|
| 后端 502/500 | login() 内置 3 次指数退避重试 |
| Token 过期 | session-scope fixture 全局复用，减少登录次数 |
| 测试数据冲突 | 随机后缀 `random_string(4)` 确保唯一性 |
| 前置数据失败 | fixture 断言 `assert_success()` 提前暴露 |
| CI 环境差异 | config.py 集中管理 URL，支持环境变量覆盖 |

## Marker 标记体系

```ini
# pytest.ini
[pytest]
markers =
    api: 接口测试
    smoke: 冒烟测试（核心路径）
    auth: 认证模块
    script: 剧本模块
    session: 场次模块
    booking: 预约模块
    order: 订单模块
    dm: DM模块
    stats: 统计模块
```

> [!IMPORTANT]
> - 每个接口至少 1 个正常 + 1 个异常用例（A2 + A3/A4/A5）
> - `@pytest.mark.smoke` 标记核心路径，CI 先跑冒烟
> - fixtures 使用 session scope 避免重复创建数据
> - 断言用封装函数，不裸写 `assert resp.status_code`

> [!WARNING]
> - 不要用 mock！直接打真实后端
> - 不要在测试中硬编码 ID，通过 fixture 动态获取
> - 不要依赖测试执行顺序，每个 test 应能独立运行
> - 后端 500/502 标记为 BROKEN，不是测试 FAIL

> [!TIP]
> - 先实现认证模块测试，确保登录可用
> - `parametrize` 批量覆盖参数校验场景
> - Allure `@allure.epic` + `@allure.story` 让报告结构清晰
> - 定期清理测试创建的脏数据

---

## 更新日志

- **2026-03-26**: 创建初始版本，基于剧本杀预约平台实战经验总结
