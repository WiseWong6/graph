# 修复 build-indices.ts 计划

## 核心目标

重写 `scripts/build-indices.ts`，实现**真正的分批构建**，同时保持代码简洁和健壮。

## 存在的问题 (Code Review)

1. **Quotes 构建逻辑错误**：

   * 循环内定义 `docs`，循环外使用（作用域错误）。

   * 每次循环都 `fromDocuments` 并覆盖保存，导致只有最后一批被保存。
2. **Articles 构建逻辑缺失**：

   * 仍处于"测试模式"，只处理前2条。

   * 缺少分批逻辑。
3. **分批策略不佳**：

   * 试图为每一批创建独立索引是错误的。

   * 正确做法：第一批创建索引，后续批次**插入**现有索引。

## 解决方案 (Linus Style)

我们将实现一个统一的 `buildIndexBatch` 模式：

1. **初始化**：定义存储上下文 (`storageContext`)。
2. **第一批**：使用 `VectorStoreIndex.fromDocuments` 创建初始索引。
3. **后续批次**：使用 `index.insert(doc)` 将文档追加到索引中。
4. **持久化**：每批处理完后立即 `storageContext.persist()`，确保进度保存。

## 具体步骤

### 1. 重写 `buildQuotesIndex`

* 读取所有金句数据。

* 按 1,000 条分批。

* **Batch 1**: `index = await VectorStoreIndex.fromDocuments(batch1, { storageContext })`

* **Batch 2+**: 并行执行 `await Promise.all(batchDocs.map(doc => index.insert(doc)))`

* 每批完成后打印进度并保存。

### 2. 重写 `buildArticlesIndex`

* 读取所有文章 JSONL 文件列表。

* 遍历文件，收集所有文章对象（或流式处理以节省内存）。

* 按 500 篇分批。

* 复用上述的 "Create then Insert" 逻辑。

* 移除所有 "测试模式" 的 break 和 slice 限制。

### 3. 清理与验证

* 移除冗余代码（如循环外的无效 `docs` 引用）。

* 确保路径检查和错误处理严谨。

* 增加耗时统计。

## 预期结果

* `npm run build-indices` 将能够完整跑完 38k 金句和 7k 文章。

* 内存占用受控（分批处理）。

* 中断后虽不能断点续传（本期不做），但每批都会保存中间状态，降低数据丢失风险。

