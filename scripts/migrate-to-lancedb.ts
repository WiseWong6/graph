
import {
  VectorStoreIndex,
  storageContextFromDefaults,
  Settings,
  TextNode
} from "llamaindex";
import { LanceDBVectorStore } from "../src/rag/vector-store/lancedb";
import { HuggingFaceEmbedding } from "@llamaindex/huggingface";
import { join, resolve } from "path";
import { existsSync } from "fs";

const INDICES_DIR = join(process.cwd(), ".index");
const ARTICLES_DIR = join(INDICES_DIR, "articles");
const LANCEDB_URI = join(ARTICLES_DIR, "lancedb");

// 设置本地嵌入模型 (必须与构建时一致，否则维度可能不对？其实这里不需要 embedding，只需要搬运)
// 但加载 VectorStoreIndex 可能需要 embedModel
Settings.embedModel = new HuggingFaceEmbedding({
  modelType: resolve(process.cwd(), "local_models")
});

async function migrate() {
  console.log("=== 开始迁移 SimpleVectorStore 到 LanceDB ===");
  console.log(`源目录: ${ARTICLES_DIR}`);
  console.log(`目标 LanceDB: ${LANCEDB_URI}`);

  if (!existsSync(join(ARTICLES_DIR, "vector_store.json"))) {
    console.error("❌ 未找到 vector_store.json，无法迁移");
    return;
  }

  // 1. 加载旧的 SimpleVectorStore
  console.log("正在加载旧索引 (可能需要几秒钟)...");
  const storageContext = await storageContextFromDefaults({
    persistDir: ARTICLES_DIR
  });
  
  // 强制获取 SimpleVectorStore 的数据
  // 注意：我们通过 docStore 和 vectorStore 配合来获取完整节点
  const docs = await storageContext.docStore.docs();
  const docIds = Object.keys(docs);
  console.log(`✅ 已加载 ${docIds.length} 个文档节点`);

  // 2. 初始化新的 LanceDBVectorStore
  const vectorStore = new LanceDBVectorStore({
    uri: LANCEDB_URI,
    tableName: "articles"
  });
  await vectorStore.init();

  // 3. 批量迁移
  console.log("开始批量写入 LanceDB...");
  const BATCH_SIZE = 1000;
  let processed = 0;
  let loggedDebug = false;

  for (let i = 0; i < docIds.length; i += BATCH_SIZE) {
    const batchIds = docIds.slice(i, i + BATCH_SIZE);
    const nodes: TextNode[] = [];

    for (const id of batchIds) {
      const doc = docs[id];
      // 从 docStore 获取的是 Document/Node 对象
      // 我们需要确保它有 embedding
      // SimpleVectorStore 的数据在 storageContext.vectorStore 里
      // 但 llamaindex 的 storageContext 抽象层可能没有直接暴露 vectorStore 的 get
      
      // 幸运的是，如果节点已经有了 embedding (在 docStore 里可能没有，但在 vectorStore 里有)
      // 我们需要从 vectorStore 获取 embedding
      
      // Hack: 访问 SimpleVectorStore 的内部数据
      // @ts-ignore
      const simpleVS = storageContext.vectorStores['text'] || storageContext.vectorStores['default'] || Object.values(storageContext.vectorStores)[0];
      
      // 调试信息
      if (i === 0 && !loggedDebug) {
        console.log("VectorStores keys:", Object.keys(storageContext.vectorStores));
        // @ts-ignore
        console.log("First VectorStore data keys:", Object.keys(simpleVS?.data || {}));
        // @ts-ignore
        const embeddingDict = simpleVS?.data?.embeddingDict;
        console.log("EmbeddingDict size:", embeddingDict ? Object.keys(embeddingDict).length : 0);
        // @ts-ignore
        if (embeddingDict) console.log("First embedding key:", Object.keys(embeddingDict)[0]);
        console.log("First doc ID:", id);
        loggedDebug = true;
      }

      // @ts-ignore
      const embedding = simpleVS?.data?.embeddingDict?.[id];

      if (embedding) {
        // 重建带有 embedding 的节点
        const node = new TextNode({
          // @ts-ignore
          text: doc.text || doc.getContent(),
          metadata: doc.metadata,
          embedding: embedding,
          id_: doc.id_
        });
        nodes.push(node);
      } else {
        // console.warn(`⚠️ 节点 ${id} 缺少 embedding，跳过`);
      }
    }

    if (nodes.length > 0) {
      await vectorStore.add(nodes);
      processed += nodes.length;
      process.stdout.write(`\r已迁移: ${processed}/${docIds.length}`);
    }
  }

  console.log("\n✅ 迁移完成！");
  console.log(`共迁移 ${processed} 条向量数据`);
}

migrate().catch(console.error);
