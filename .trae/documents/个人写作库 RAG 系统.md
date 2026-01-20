## 目标

在现有 LlamaIndex TS + LanceDBVectorStore 架构上，新增个人写作库的 RAG 检索能力，分为 Content（观点/框架/案例）和 Voice（风格/句式）两个维度，并在 rewrite 节点集成。

**关键调整**：原始文件是 PDF 格式（位于 `/data/rewrite`），需要 PDF 解析而非 Markdown 解析。

## 实现步骤

### 1. 扩展 Schema 类型

在 `src/rag/index/schema.ts` 新增：

* `PersonalChunkNode`：个人 chunk 检索结果

* `RetrievePersonalOptions`：检索选项（topKContent, topKVoice）

* `ComponentType`：写作组件标签枚举（content: concept/framework/method/case/data/checklist/counterpoint; voice: hook\_opening/turning\_point/metaphor/closing/sentence\_pattern）

### 2. 扩展 IndexManager

在 `src/rag/index/index-manager.ts` 新增：

* `personalContentIndex` / `personalVoiceIndex` 私有字段

* `getPersonalContentIndex()` / `getPersonalVoiceIndex()` 方法（懒加载，单例缓存）

* `retrievePersonalRAG()` 方法（检索 API）

* `loadIndices()` 方法中增加个人索引加载逻辑

配置从 `.env` 读取：

```env
PERSONAL_KB_DIR=./data/rewrite
PERSONAL_LANCEDB_DIR=./data/lancedb_personal
```

### 3. PDF 解析 + 分块 + 索引脚本

新建 `scripts/build-personal-indices.ts`：

* 读取 `PERSONAL_KB_DIR` 下 PDF 文件（`*.pdf`）

* 使用 PDF 解析器提取文本（添加 `pdf-parse` 依赖）

* 从文件名/内容推断元数据（article\_id=文件名, title=文件名, date, tags, pillar, channel）

* 按段落/章节切 chunk（目标 450-900 中文字符，overlap 1-2 段）

* 代码块/表格独立 chunk，不拆内部

* 自动标注 component\_type（先用启发式规则，后续可改 LLM）

* embedding\_text 包装上下文（Title/Section/Pillar/Tags/Component + Content）

* 使用 LanceDBVectorStore 分别建两张表（personal\_content\_chunks, personal\_voice\_chunks）

* 脚本入口：`npm run rag:personal:index`

**简化**：暂不实现 chunk\_hash + manifest 增量机制，先全量重建

### 4. 检索 API

新建 `src/rag/retrieval/personal-rag.ts`：

* `retrievePersonalRAG()` 函数

* 分别检索 content/voice 表（topKContent=5, topKVoice=3）

* 去重（按 text hash）

* 截断（单条最长 300 字，总条数按 topK）

* 降级处理（try/catch 返回空对象）

### 5. 接入 Rewrite 节点

修改 `src/agents/article/nodes/07_rewrite.node.ts`：

* 在 `parseBriefForRewrite` / `parseRAGForRewrite` 之后新增检索步骤

* 构造 query（title + topic + key\_insights + draft 前 600 字）

* 调用 `retrievePersonalRAG()`

* 日志命中数、耗时、是否降级

* 在 `renderTemplate` 参数中新增 `personal_rag_content` / `personal_rag_voice`

更新 `config/llm.yaml` 的 `rewrite_user` 模板：

```yaml
【作者历史内容参考（只吸收观点/素材，不要原文照抄）】
{personal_rag_content}

【作者历史风格参考（尽量模仿句式/节奏/转折方式，不要照抄内容）】
{personal_rag_voice}
```

### 6. 配置与依赖

* `.env.example` 新增配置项

* `package.json` 新增 `pdf-parse` 依赖和 `rag:personal:index` 脚本

## 验收标准

1. 能对 `./data/rewrite` 下 PDF 文件执行索引
2. Rewrite 运行时能检索到 personal\_content + personal\_voice
3. 检索异常不会阻塞 rewrite（warn + 返回空）
4. Token 控制：单条 300 字截断，topK 限制
5. CLI 入口：`npm run rag:personal:index`

## 最小可用优先顺序

1. 先跑通 content 表（只实现 content 检索）
2. 再补 voice 表（复制 content 逻辑，改表名）
3. 最后接入 rewrite（集成两路检索）

代码结构预留两表并行，但可以逐步实现。
