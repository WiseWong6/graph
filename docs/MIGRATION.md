# 迁移指南

## 从 Python LangGraph 到 TypeScript

本项目将 Python LangGraph 教程的概念适配到 TypeScript。

### 主要差异

1. **类型定义**：TypeScript 接口替代 Python dataclass
2. **Async/Await**：使用 JavaScript Promise 替代 Python 协程
3. **模块系统**：ES 模块替代 Python 导入
4. **配置**：YAML 文件替代 Python 配置对象

### 示例对比

**Python：**
```python
from typing import TypedDict

class AgentState(TypedDict):
    topic: str
    content: str
```

**TypeScript：**
```typescript
interface AgentState {
  topic: string;
  content: string;
}
```

## 从 LangChain Python 迁移

如果你熟悉 LangChain Python：

| LangChain Python | LangGraph.js (TS) |
|-----------------|-------------------|
| `Runnable` | `Runnable` |
| `RunnableLambda` | `RunnableLambda` |
| `StateGraph` | `StateGraph` |
| `MemorySaver` | `MemorySaver` |

概念可以直接迁移，只是语法不同。
