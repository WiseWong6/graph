# 为 build-indices.ts 增加进度显示与稳健持久化

## 需求复述
你现在 embedding 很慢、看不到进度；同时希望降低中断风险（例如每 10 条一组），并且能明确知道“500 条这一批跑到哪里了”。

## 关键判断（为什么你现在看不到进度）
- 你当前的瓶颈是 embedding 推理本身（CPU 上 fp32），而脚本只在“批开始/批结束”打日志，所以中间看起来像“卡死”。
- 另外并发 insert 会触发底层频繁写盘（vector_store.json / doc_store.json / index_store.json），并发写同一个 JSON 文件会导致刷屏、甚至文件损坏（你之前的 JSON 截断就是这种典型症状）。

## 方案总览
同时解决三件事：
1) **进度条/进度输出**：在每个 500 的 batch 内，按“每 10 条”为单位输出进度（已完成/剩余/耗时/ETA）。
2) **降低中断风险**：把写盘变成“单线程、可控的节奏”，避免并发写 JSON 文件。
3) **可恢复**：继续保留已有的去重/断点逻辑，让脚本能重复运行而不重复写入。

## 实施步骤

### 1) 增加“每 10 条一组”的子进度
- 在 `buildIndexInBatches()` 的插入阶段，把 500 条拆成 `chunkSize=10` 的小块。
- 每处理完一个 chunk，输出一次：
  - 当前 batch：chunk 序号/总 chunk
  - 当前 batch 已插入数量/500
  - 全局已插入数量/总新增数量
  - chunk 耗时与 ETA（用移动平均估算）
- 输出形式优先用单行覆盖（carriage return），如果终端不兼容就退化成普通 log。

### 2) 解决“并发写盘导致卡顿/损坏”
- 关键点：底层 `SimpleKVStore` / `SimpleVectorStore` 在 `persistPath` 存在时会**每次写入都立刻 fs.writeFile(JSON.stringify(...))**。
- 我会在进入批处理前：
  - **临时关闭自动写盘**（把各 store 的 `persistPath` 置空/禁用）。
  - 让插入阶段只做内存更新。
- 然后在每个 chunk 结束后（或每 N 个 chunk）：
  - 显式调用一次 `docStore.persist(...)` / `indexStore.persist(...)` / `vectorStore.persist(...)`，保证写盘是**串行**且频率可控。

### 3) 并发策略（你问“要不要每 10 条每 10 条一组”）
- “每 10 条一组”我会做成两层参数：
  - `chunkSize=10`：进度更新与持久化粒度。
  - `concurrency=1~3`：每个 chunk 内 insert 的并发度。
- 默认我会用 **concurrency=1**（最稳、不会刷屏、不会损坏 JSON）。
  - 你想要更快，可以改到 2 或 3，但前提是持久化已经被我们串行化控制住。

### 4) 让你随时知道“跑到哪一批”
- 现在已有 batch 日志：`第 X/14 批`。
- 我会补充：
  - 每批开始打印“预计 chunk 数”和“本批新增数量”。
  - 每批结束打印“本批累计耗时”。

## 验证方式
- 运行 `npm run build-indices -- articles`，观察：
  - 不再出现海量 `dtype not specified...` 刷屏。
  - 每 10 条输出一次明确进度。
  - 中途中断后再次运行，会快速跳过已完成部分并继续。

如果你确认，我就按这个方案改 [build-indices.ts](file:///Users/wisewong/Documents/Developer/write-agent/scripts/build-indices.ts)。