# Migration Guide

## From Python LangGraph to TypeScript

This project adapts concepts from the Python LangGraph tutorials to TypeScript.

### Key Differences

1. **Type Definitions**: TypeScript interfaces replace Python dataclasses
2. **Async/Await**: Uses JavaScript promises instead of Python coroutines
3. **Module System**: ES modules instead of Python imports
4. **Configuration**: YAML files instead of Python config objects

### Example Comparison

**Python:**
```python
from typing import TypedDict

class AgentState(TypedDict):
    topic: str
    content: str
```

**TypeScript:**
```typescript
interface AgentState {
  topic: string;
  content: string;
}
```

## Coming from LangChain Python

If you're familiar with LangChain Python:

| LangChain Python | LangGraph.js (TS) |
|-----------------|-------------------|
| `Runnable` | `Runnable` |
| `RunnableLambda` | `RunnableLambda` |
| `StateGraph` | `StateGraph` |
| `MemorySaver` | `MemorySaver` |

The concepts transfer directly, only syntax differs.
