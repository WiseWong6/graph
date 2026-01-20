# 迁移指南

## 从 Python LangGraph 到 TypeScript

本项目将 Python LangGraph 教程的概念适配到 TypeScript。

### 主要差异

1. **类型定义**：TypeScript 接口替代 Python dataclass
2. **Async/Await**：使用 JavaScript Promise 替代 Python 协程
3. **模块系统**：ES 模块替代 Python 导入
4. **配置**：TypeScript 代码 + 环境变量替代 Python 配置对象

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
interface ArticleState {
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
| `SqliteSaver` | `SqliteSaver` |

概念可以直接迁移，只是语法不同。

## Humanize 节点架构迁移

### 旧架构（LLM Only）
```typescript
// 旧方式：所有任务交给 LLM
const humanized = await callLLM({
    prompt: "去除 AI 味，修复标点...",
    systemMessage: "你是一位资深编辑..."
});
```

**问题：**
- LLM 处理引号/破折号时容易产生幻觉
- 格式一致性无法保证
- 浪费 LLM Token 在简单规则上

### 新架构（Code First, AI Second）
```typescript
// 新方式：两阶段处理
// Phase A: Code 处理死板规则
const formatted = humanizeFormat(humanized);

// Phase B: LLM 专注于风格优化
const humanized = await callLLM({
    prompt: "去除 AI 味，增加活人感...",
    systemMessage: "你是一位资深编辑..."
});

// Phase C: 再次 Code 清洗（如有必要）
```

**优势：**
- 确定性规则用代码处理（零误差）
- LLM 资源用于更有价值的风格优化
- 格式一致性保证

## Checkpoint 迁移

### Python LangGraph Checkpoint
```python
from langgraph.checkpoint.sqlite import SqliteSaver

checkpointer = SqliteSaver.from_conn_string("checkpoints.db")
```

### TypeScript LangGraph Checkpoint
```typescript
import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite";

const checkpointer = SqliteSaver.fromConnString(
    join(process.cwd(), "src", "checkpoints", "article", "checkpoints.db")
);
```

## ResumeManager 功能实现

### Python 风格（假设）
```python
class ResumeManager:
    def list_threads(self) -> List[ThreadSummary]:
        # 直接查询 SQLite
        pass

    def resume(self, thread_id: str, checkpoint_id: Optional[str] = None):
        # 调用 LangGraph 恢复
        pass
```

### TypeScript 实现
```typescript
export class ResumeManager {
    constructor(private graph: GraphType) {}

    async listThreads(): Promise<ThreadSummary[]> {
        // 动态导入 better-sqlite3
        const Database = await import("better-sqlite3").then(m => m.default);
        const db = new Database(dbPath);

        // 查询并聚合
        const rows = db.prepare("...").all();
        // ...
    }

    async resume(threadId: string, checkpointId?: string): Promise<void> {
        const config = {
            configurable: {
                thread_id: threadId,
                ...(checkpointId && { checkpoint_ns: "", checkpoint_id: checkpointId }),
            },
            streamMode: "values" as const,
        };

        for await (const event of await this.graph.stream(null, config)) {
            console.log(event);
        }
    }
}
```

**关键差异：**
- TypeScript 使用动态导入（`import()`）来处理可选依赖
- 使用 `for await` 处理异步迭代器
- 更严格的类型定义

## 并行执行迁移

### Python LangGraph 条件边
```python
def route(state):
    if state["images"]["count"] > 0:
        return "with_images"
    return "without_images"

workflow.add_conditional_edges(
    "confirm",
    route,
    {
        "with_images": "prompts",
        "without_images": "humanize"
    }
)
```

### TypeScript LangGraph 并行
```typescript
workflow
    .addEdge("08_confirm", "10_prompts")   // 图片分支
    .addEdge("08_confirm", "09_humanize")  // 文本分支
    .addEdge(["13_wait_for_upload", "09_humanize"], "14_html");  // 汇聚点
```

**关键差异：**
- TypeScript 使用 `addEdge` 创建无条件并行
- 使用数组 `["node1", "node2"]` 创建 join 边（等待两者完成）

## 文本处理迁移

### Python 字符串处理
```python
def clean_text(text):
    # 去除空格
    text = text.replace(" ", "")
    # 正则替换
    text = re.sub(r"--|——", "，", text)
    return text
```

### TypeScript 正则处理
```typescript
export function cleanTextFormatting(text: string): string {
    let processed = text;

    // 破折号替换
    processed = processed.replace(/\s*(--|——)\s*/g, "，");

    // 标点中文化
    processed = processed
        .replace(/([\u4e00-\u9fa5])\s*,/g, "$1，")
        .replace(/([\u4e00-\u9fa5])\s*\./g, "$1。");

    return processed;
}
```

**关键差异：**
- TypeScript 使用原生 `RegExp`（支持 `g` 全局标志）
- Python 使用 `re` 模块
- TypeScript 正则表达式语法更简洁

## 环境变量迁移

### Python (.env)
```python
import os
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("DEEPSEEK_API_KEY")
```

### TypeScript (.env)
```typescript
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env") });

const apiKey = process.env.DEEPSEEK_API_KEY;
```

**关键差异：**
- TypeScript 使用 `process.env`（Node.js 标准）
- 类型安全需要额外处理（`string | undefined`）

## 类型定义迁移

### Python TypedDict
```python
from typing import TypedDict

class WechatConfig(TypedDict):
    account: str
    name: str
    appId: str
    appSecret: str
```

### TypeScript Interface
```typescript
interface WechatConfig {
    account: string;
    name: string;
    appId: string;
    appSecret: string;
}
```

## 异步处理迁移

### Python Async/Await
```python
async def upload_images(state):
    for image_path in state["image_paths"]:
        url = await upload_image(image_path)
        state["uploaded_urls"].append(url)
    return state
```

### TypeScript 并行处理
```typescript
export async function uploadImagesNode(state: ArticleState): Promise<Partial<ArticleState>> {
    const concurrency = parseInt(process.env.UPLOAD_CONCURRENCY || "5");

    const uploadResults = await parallelMap(
        state.imagePaths,
        async (imagePath, index) => {
            return await uploadImage(imagePath, uploadConfig);
        },
        concurrency
    );

    return {
        uploadedImageUrls: uploadResults.map(r => r.url)
    };
}
```

**关键差异：**
- TypeScript 使用 `parallelMap` 实现并发控制
- Python 需要使用 `asyncio.gather` 或 `concurrent.futures`

## 测试迁移

### Python pytest
```python
def test_humanize():
    result = humanize_node({"rewritten": "测试文本"})
    assert "humanized" in result
```

### TypeScript Vitest
```typescript
import { describe, it, expect } from "vitest";
import { humanizeNode } from "../src/agents/article/nodes/09_humanize.node";

describe("Humanize Node", () => {
    it("should remove AI flavor", async () => {
        const result = await humanizeNode({
            rewritten: "测试文本",
            decisions: {}
        });
        expect(result.humanized).toBeDefined();
    });
});
```

## 常见陷阱

### 1. 动态导入
**问题**：某些依赖（如 `better-sqlite3`）不支持 ES 模块导入。

**解决方案**：使用动态导入
```typescript
const Database = await import("better-sqlite3").then(m => m.default);
```

### 2. 类型定义
**问题**：LangGraph.js 的类型参数非常复杂。

**解决方案**：使用 `any` 简化（关键处保留类型）
```typescript
type GraphType = CompiledStateGraph<any, any, any, any, any, any, any, any, any>;
```

### 3. 事件处理
**问题**：`streamEvents` 是 LangGraph.js 的 v2 功能，需要指定版本。

**解决方案**：显式指定版本
```typescript
const eventStream = await fullArticleGraph.streamEvents(
    { prompt },
    {
        ...config,
        version: "v2"  // 必须指定
    }
);
```

### 4. 并行检测
**问题**：LangGraph.js 的并行执行需要特殊处理。

**解决方案**：监听 `on_chain_start` 事件
```typescript
if (eventType === "on_chain_start") {
    tracker.activeNodes.set(nodeName, Date.now());
    if (tracker.activeNodes.size > 1) {
        console.log(`⚡ 并行执行 [${tracker.activeNodes.size}]`);
    }
}
```

## 下一步

- 阅读架构文档：[ARCHITECTURE.md](ARCHITECTURE.md)
- 查看配置指南：[CONFIG.md](CONFIG.md)
- 理解工作流图：[WORKFLOW_GRAPH.md](WORKFLOW_GRAPH.md)
