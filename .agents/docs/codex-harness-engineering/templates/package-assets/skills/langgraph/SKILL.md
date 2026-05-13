---
name: langgraph
description: LangGraph + LangChain 开发指南
---

# LangGraph + LangChain 开发指南

## 项目集成位置

```
WHartTest_Django/
├── langgraph_integration/    # LLM 配置管理
│   ├── models.py             # LLMConfig, ChatSession
│   └── views.py              # Chat API
├── orchestrator_integration/ # Agent 编排
│   ├── agent_loop.py         # Agent 循环逻辑
│   ├── graph.py              # LangGraph 工作流
│   └── prompts.py            # 系统提示词
└── knowledge/                # RAG 知识库
    └── services.py           # 向量检索服务
```

## LangGraph 工作流定义

```python
from langgraph.graph import StateGraph, END
from typing import TypedDict, Annotated
from operator import add

class AgentState(TypedDict):
    messages: Annotated[list, add]
    next_action: str

def create_graph():
    workflow = StateGraph(AgentState)
    
    workflow.add_node("agent", agent_node)
    workflow.add_node("tools", tool_node)
    
    workflow.set_entry_point("agent")
    workflow.add_conditional_edges(
        "agent",
        should_continue,
        {"continue": "tools", "end": END}
    )
    workflow.add_edge("tools", "agent")
    
    return workflow.compile()
```

## LLM 配置使用

```python
from langgraph_integration.models import LLMConfig
from langchain_openai import ChatOpenAI

config = LLMConfig.objects.get(id=config_id)
llm = ChatOpenAI(
    model=config.model_name,
    api_key=config.api_key,
    base_url=config.api_base_url,
    temperature=config.temperature
)
```

## MCP 工具集成

```python
from langchain_mcp_adapters.client import MultiServerMCPClient

async def get_mcp_tools(mcp_configs):
    client = MultiServerMCPClient(mcp_configs)
    tools = await client.get_tools()
    return tools
```

## 检查点持久化

```python
from langgraph.checkpoint.postgres import PostgresSaver

checkpointer = PostgresSaver.from_conn_string(
    os.environ.get('DATABASE_URL')
)
graph = workflow.compile(checkpointer=checkpointer)
```

## 常用模式

### 流式输出
```python
async for event in graph.astream(
    {"messages": [HumanMessage(content=query)]},
    config={"configurable": {"thread_id": thread_id}}
):
    yield event
```

### 工具调用
```python
from langchain_core.tools import tool

@tool
def my_tool(query: str) -> str:
    """工具描述"""
    return f"Result for {query}"
```

