# 实施方案 B：彻底迁移到 LanceDB

## 核心目标

既然用户倾向于方案 B，我们将彻底解决 SimpleVectorStore 的容量限制，通过引入 **LanceDB** 来支撑百万级向量数据。虽然之前安装依赖失败，我们将通过更严谨的方式重试并集成。

## 关键步骤

### 1. 正确安装 LanceDB

* **问题回顾**：之前直接安装 `@llamaindex/lancedb` 失败（包名或 registry 问题），安装 `lancedb` 成功但没适配 LlamaIndex。

* **解决方案**：

  * 使用官方正确的包名：`vectordb` (LanceDB 的 Node.js 客户端旧名) 或 `@lancedb/lancedb` (新名)。

  * **关键**：由于 LlamaIndex TS 0.12 可能还没发布官方的 LanceDB 适配器（或者我们找不到），我们将**手写一个轻量级的** **`LanceDBVectorStore`** **类**，实现 LlamaIndex 的 `BaseVectorStore` 接口。这比找包更靠谱。

### 2. 实现 `LanceDBVectorStore` 适配器

* 在 `src/rag/vector-store/lancedb.ts` 创建适配器。

* 实现 `add` (插入), `query` (检索), `delete` (删除), `persist` (空操作，因为它是即时写入的)。

* 利用 `@lancedb/lancedb` 的原生 API 管理数据。

### 3. 数据迁移 (JSON -> LanceDB)

* 写一个一次性脚本 `scripts/migrate-to-lancedb.ts`。

* 读取现有的 503MB `vector_store.json`（SimpleVectorStore）。

* 解析出 embedding 和 metadata。

* 批量插入到新的 LanceDB 表中。

* **收益**：不用重跑 embedding！直接复用那 6500 篇的成果。

### 4. 补全剩余 7%

* 修改 `build-indices.ts` 使用新的 `LanceDBVectorStore`。

* 运行脚本，它会自动发现 LanceDB 里已有 6500 条，只跑剩下的 475 条。

* 此时再无内存限制，轻松跑完。

### 5. 更新 RAG 检索

* 修改 `IndexManager` 使用 `LanceDBVectorStore` 加载索引。

## 风险控制

* **依赖安装**：如果 `@lancedb/lancedb` 原生编译失败（常见于 macOS 环境问题），我们将回退到方案 A（双索引）。但 M2 Pro 通常支持得很好。

* **数据一致性**：迁移脚本需校验条数。

## 执行顺序

1. 安装 `@lancedb/lancedb`。
2. 编写 `LanceDBVectorStore` 适配器。
3. 编写并运行迁移脚本（救回 93% 数据）。
4. 更新构建脚本并跑完剩余 7%。

