---
name: mcp-builder
description: Workflow skill from mcp-builder.md
---

# MCP Server 构建指南

构建高质量的 MCP (Model Context Protocol) 服务器，让 LLM 能够与外部服务交互。

## 核心原则

1. **工具设计**: 每个工具应该做一件事并做好
2. **错误处理**: 返回有意义的错误信息
3. **类型安全**: 使用 TypeScript 或 Python 类型提示
4. **文档**: 每个工具都需要清晰的描述和参数说明

## Python (FastMCP) 示例

```python
from fastmcp import FastMCP

mcp = FastMCP("my-server")

@mcp.tool()
def my_tool(param: str) -> str:
    """工具描述"""
    return result
```

## TypeScript (MCP SDK) 示例

```typescript
import { Server } from "@modelcontextprotocol/sdk/server";

const server = new Server({
  name: "my-server",
  version: "1.0.0"
});

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{ name: "my_tool", description: "...", inputSchema: {...} }]
}));
```

## 最佳实践

- 使用环境变量存储敏感配置
- 实现速率限制和超时
- 记录关键操作日志
- 提供健康检查端点
