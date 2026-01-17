/**
 * 向量索引构建脚本
 *
 * 为金句库、文章库建立向量索引
 *
 * 使用方式:
 *   npm run build-indices
 */

import {
  VectorStoreIndex,
  Document,
  storageContextFromDefaults,
  Settings
} from "llamaindex";
import { HuggingFaceEmbedding } from "@llamaindex/huggingface";
import { readFileSync, readdirSync, mkdirSync, existsSync, writeFileSync } from "fs";
import { join, resolve } from "path";

const DATA_DIR = join(process.cwd(), "data");
const INDICES_DIR = join(process.cwd(), ".index");

// 全局设置嵌入模型 - 使用本地模型路径
Settings.embedModel = new HuggingFaceEmbedding({
  modelType: resolve(process.cwd(), "local_models")  // 强制使用本地模型
});

/**
 * 加载 JSONL 文件
 */
function loadJSONL(filePath: string): any[] {
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n").filter(line => line.trim());

  return lines.map(line => {
    try {
      return JSON.parse(line);
    } catch {
      return null;
    }
  }).filter(item => item !== null);
}

function parseNumberArg(args: string[], name: string, fallback: number): number {
  const idx = args.indexOf(name);
  if (idx === -1) return fallback;
  const value = args[idx + 1];
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function formatDurationMs(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "0s";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remain = seconds % 60;
  return `${minutes}m${remain}s`;
}

/**
 * 通用分批构建索引函数
 */
async function buildIndexInBatches(
  name: string,
  items: any[],
  batchSize: number,
  outputDir: string,
  docMapper: (item: any) => Document,
  options?: { chunkSize?: number; concurrency?: number; persistEveryChunks?: number }
): Promise<void> {
  if (items.length === 0) {
    console.log(`[build-indices] ⚠️  ${name}: 无数据，跳过`);
    return;
  }

  // 创建输出目录
  mkdirSync(outputDir, { recursive: true });

  const chunkSize = options?.chunkSize ?? 10;
  const concurrency = options?.concurrency ?? 1;
  const persistEveryChunks = options?.persistEveryChunks ?? Math.ceil(batchSize / chunkSize);
  const docStorePath = join(outputDir, "doc_store.json");
  const indexStorePath = join(outputDir, "index_store.json");
  const vectorStorePath = join(outputDir, "vector_store.json");

  let storageContext: Awaited<ReturnType<typeof storageContextFromDefaults>>;
  try {
    storageContext = await storageContextFromDefaults({
      persistDir: outputDir
    });
  } catch (e) {
    console.error(`[build-indices] ❌ 无法加载索引存储 (可能是 JSON 损坏): ${e}`);
    console.error(`[build-indices]    请删除目录后重试: ${outputDir}`);
    throw e;
  }

  const docStoreAny = storageContext.docStore as any;
  if (docStoreAny?.kvStore) docStoreAny.kvStore.persistPath = undefined;
  const indexStoreAny = storageContext.indexStore as any;
  if (indexStoreAny?.kvStore) indexStoreAny.kvStore.persistPath = undefined;
  const vectorStoresAny = storageContext.vectorStores as any;
  const vectorStoreAny = Object.values(vectorStoresAny)[0] as any;
  if (vectorStoreAny) vectorStoreAny.persistPath = undefined;

  // ===== 1. 加载已有索引并建立 ID Set (去重逻辑) =====
  let existingIds = new Set<string>();
  let index: VectorStoreIndex | null = null;

  try {
    // 尝试加载现有索引
    if (existsSync(join(outputDir, "vector_store.json"))) {
      console.log(`[build-indices]   📚 发现已有索引，尝试加载...`);
      
      try {
        // LlamaIndex TS 0.12+ 中初始化已有索引的方法
        index = await VectorStoreIndex.init({
          storageContext
        });
        
        // 提取所有已存在的 docId
        // 注意：docStore.docs 是一个对象，key 是 id
        const docs = await storageContext.docStore.docs();
        Object.keys(docs).forEach(id => existingIds.add(id));
        
        console.log(`[build-indices]   ✅ 已加载 ${existingIds.size} 条历史数据，将跳过重复项`);
      } catch (loadErr) {
        console.warn(`[build-indices]   ⚠️ 索引文件存在但加载失败 (可能损坏)，将重新构建: ${loadErr}`);
        
        // 【关键修复】如果加载失败，storageContext 可能已经处于不一致状态
        // 尤其是 docStore.json 加载了一半。
        // 我们需要"重置"它，或者让下面的代码在空的状态下运行。
        // 由于我们无法轻易重置 storageContext 对象，最安全的做法是
        // 告诉后续逻辑：这是一个全新的开始，并接受可能的覆盖。
        
        index = null;
        existingIds.clear();
        
        // 可选：如果文件彻底坏了，后续写入可能会失败吗？
        // 如果是 JSON 格式错误，fs.writeFile 会直接覆盖它，通常没问题。
        // 但如果文件系统锁定，那就没办法了。
      }
    }
  } catch (e) {
    console.log(`[build-indices]   ⚠️ 加载现有索引失败 (可能是首次构建或文件损坏): ${e}`);
    // 如果加载失败，假设是从头开始
    index = null;
    existingIds.clear();
  }

  const totalBatches = Math.ceil(items.length / batchSize);
  console.log(`[build-indices] ${name}: 共 ${items.length} 条，分 ${totalBatches} 批处理 (每批 ${batchSize})`);
  console.log(`[build-indices] ${name}: chunkSize=${chunkSize}, concurrency=${concurrency}, persistEveryChunks=${persistEveryChunks}`);

  let insertedTotal = 0;
  const globalStart = Date.now();

  // ===== 2. 分批处理 =====
  for (let i = 0; i < items.length; i += batchSize) {
    const currentBatchNum = Math.floor(i / batchSize) + 1;
    const batchItems = items.slice(i, i + batchSize);
    
    // 转换为 Document (此时生成 ID)
    const docs = batchItems.map(docMapper);
    
    // 过滤掉已存在的文档
    const newDocs = docs.filter(doc => !existingIds.has(doc.id_));
    
    if (newDocs.length === 0) {
      console.log(`[build-indices]   ⏭️ 第 ${currentBatchNum}/${totalBatches} 批: 全部 ${docs.length} 条已存在，跳过`);
      continue;
    }
    
    console.log(`[build-indices]   正在处理第 ${currentBatchNum}/${totalBatches} 批 (新增 ${newDocs.length}/${docs.length} 条)...`);

    const batchStart = Date.now();

    let createdIndexThisBatch = false;
    let processedInBatch = 0;

    if (!index) {
      console.log(`[build-indices]   🚀 初始化索引...`);
      const initialDocs = newDocs.slice(0, Math.min(chunkSize, newDocs.length));
      index = await VectorStoreIndex.fromDocuments(initialDocs, {
        storageContext
      });
      insertedTotal += initialDocs.length;
      for (const d of initialDocs) existingIds.add(d.id_);
      processedInBatch += initialDocs.length;
      createdIndexThisBatch = true;
    }

    const docsToInsert = createdIndexThisBatch ? newDocs.slice(Math.min(chunkSize, newDocs.length)) : newDocs;

    const totalChunks = Math.ceil(docsToInsert.length / chunkSize);
    let avgPerDocMs = 0;
    let completedDocsInBatch = processedInBatch;

    for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
      const start = chunkIdx * chunkSize;
      const chunk = docsToInsert.slice(start, start + chunkSize);
      const chunkStart = Date.now();

      for (let j = 0; j < chunk.length; j += concurrency) {
        const sub = chunk.slice(j, j + concurrency);
        const insertedCounts = await Promise.all(sub.map(async (doc) => {
          try {
            await index!.insert(doc);
            existingIds.add(doc.id_);
            return 1;
          } catch (err) {
            console.error(`[build-indices]   ❌ 插入文档失败 (ID: ${doc.id_}):`, err);
            return 0;
          }
        }));
        insertedTotal += insertedCounts.reduce<number>((a, b) => a + b, 0);
      }

      const chunkElapsed = Date.now() - chunkStart;
      const perDoc = chunkElapsed / Math.max(1, chunk.length);
      avgPerDocMs = avgPerDocMs === 0 ? perDoc : avgPerDocMs * 0.8 + perDoc * 0.2;

      completedDocsInBatch += chunk.length;

      const remainingInBatch = newDocs.length - completedDocsInBatch;
      const etaMs = avgPerDocMs * remainingInBatch;
      const elapsedTotal = Date.now() - globalStart;

      process.stdout.write(
        `\r[build-indices]   批 ${currentBatchNum}/${totalBatches} · ${completedDocsInBatch}/${newDocs.length} · 总插入 ${insertedTotal} · 本批ETA ${formatDurationMs(etaMs)} · 总耗时 ${formatDurationMs(elapsedTotal)}        `
      );

      if ((chunkIdx + 1) % persistEveryChunks === 0 || chunkIdx === totalChunks - 1) {
        if (docStoreAny?.kvStore?.persist) {
          await docStoreAny.kvStore.persist(docStorePath);
        } else {
          await storageContext.docStore.persist(docStorePath);
        }
        if (indexStoreAny?.kvStore?.persist) {
          await indexStoreAny.kvStore.persist(indexStorePath);
        } else {
          await storageContext.indexStore.persist(indexStorePath);
        }
        if (vectorStoreAny?.persist) await vectorStoreAny.persist(vectorStorePath);
      }
    }

    if (totalChunks === 0) {
      if (docStoreAny?.kvStore?.persist) {
        await docStoreAny.kvStore.persist(docStorePath);
      } else {
        await storageContext.docStore.persist(docStorePath);
      }
      if (indexStoreAny?.kvStore?.persist) {
        await indexStoreAny.kvStore.persist(indexStorePath);
      } else {
        await storageContext.indexStore.persist(indexStorePath);
      }
      if (vectorStoreAny?.persist) await vectorStoreAny.persist(vectorStorePath);
    }

    process.stdout.write("\n");
    console.log(`[build-indices]   ✅ 第 ${currentBatchNum} 批完成 (耗时: ${formatDurationMs(Date.now() - batchStart)})`);
    
    // 手动触发垃圾回收 (如果可用)
    if (global.gc) {
        global.gc();
    }
  }
  
  // 确保最后保存
  // 在某些版本中需要显式调用，但 storageContextFromDefaults 绑定的文件系统通常会在更新时写入
  // 或者 index 对象有 persist 方法? 
  // index.storageContext.docStore.persist()
  // 简单起见，我们信任库的行为。
  console.log(`[build-indices] ✅ ${name} 索引构建完成，已保存至: ${outputDir}`);
}

/**
 * 构建金句库索引
 */
async function buildQuotesIndex(options?: { chunkSize?: number; concurrency?: number; persistEveryChunks?: number }): Promise<void> {
  console.log("\n[build-indices] === 构建金句库索引 ===");

  const jsonlFile = join(DATA_DIR, "golden_sentences.jsonl");
  if (!existsSync(jsonlFile)) {
    console.error(`[build-indices] ❌ 文件不存在: ${jsonlFile}`);
    return;
  }

  const data = loadJSONL(jsonlFile);
  const outputDir = join(INDICES_DIR, "golden_quotes");

  await buildIndexInBatches(
    "金句库",
    data,
    1000,
    outputDir,
    (item) => {
      const doc = new Document({
        text: item.content,
        metadata: {
          id: item.id,
          quote_type: item.quote_type || "",
          quality_score: item.quality_score?.overall || 0,
          source_title: item.source_title || "",
          url: item.source_url || "",
          category: item.category || ""
        }
      });
      if (item.id) doc.id_ = String(item.id);
      return doc;
    },
    options
  );
}

/**
 * 构建文章库索引
 */
async function buildArticlesIndex(options?: { chunkSize?: number; concurrency?: number; persistEveryChunks?: number }): Promise<void> {
  console.log("\n[build-indices] === 构建文章库索引 ===");

  const articlesDir = join(DATA_DIR, "articles");
  if (!existsSync(articlesDir)) {
    console.error(`[build-indices] ❌ 目录不存在: ${articlesDir}`);
    return;
  }

  const files = readdirSync(articlesDir).filter(f => f.endsWith(".jsonl"));
  if (files.length === 0) {
    console.error(`[build-indices] ❌ 未找到 JSONL 文件`);
    return;
  }

  console.log(`[build-indices] 加载 ${files.length} 个文件...`);
  
  let allArticles: any[] = [];
  for (const file of files) {
    const filePath = join(articlesDir, file);
    const articles = loadJSONL(filePath);
    // 附加源文件名到每个文章对象，以便在 mapper 中使用
    articles.forEach(a => a._source_file = file);
    allArticles.push(...articles);
  }

  const outputDir = join(INDICES_DIR, "articles");

  await buildIndexInBatches(
    "文章库",
    allArticles,
    500,
    outputDir,
    (item) => {
      const text = `标题：${item.title}\n\n${item.content}`;
      const doc = new Document({
        text,
        metadata: {
          title: item.title || "",
          publish_time: item.publish_time || "",
          url: item.url || "",
          source_file: item._source_file || ""
        }
      });
      // 使用 URL 或 标题+文件名 作为确定性 ID
      // 优先使用 URL，因为它是唯一的；如果没有，则使用 title + source_file 的哈希
      // 这里简单拼接，因为 Document ID 只是个字符串
      if (item.url) {
        doc.id_ = item.url;
      } else {
        // 简单清理文件名
        const cleanTitle = (item.title || "").replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, "");
        const cleanSource = (item._source_file || "").replace(/[^a-zA-Z0-9]/g, "");
        doc.id_ = `${cleanTitle}_${cleanSource}`;
      }
      return doc;
    },
    options
  );
}

/**
 * 构建标题库索引 (生成 JSONL 文件)
 */
async function buildTitlesIndex(): Promise<void> {
  console.log("\n[build-indices] === 构建标题库 (生成 article_titles.jsonl) ===");

  const articlesDir = join(DATA_DIR, "articles");
  if (!existsSync(articlesDir)) {
    console.error(`[build-indices] ❌ 目录不存在: ${articlesDir}`);
    return;
  }

  const files = readdirSync(articlesDir).filter(f => f.endsWith(".jsonl"));
  if (files.length === 0) {
    console.error(`[build-indices] ❌ 未找到 JSONL 文件`);
    return;
  }

  let titleCount = 0;
  const titleLines: string[] = [];

  for (const file of files) {
    const filePath = join(articlesDir, file);
    const articles = loadJSONL(filePath);

    for (const article of articles) {
      if (!article.title) continue;

      const titleRecord = {
        title: article.title,
        source_file: file
      };
      
      titleLines.push(JSON.stringify(titleRecord));
      titleCount++;
    }
  }

  const outputFile = join(DATA_DIR, "article_titles.jsonl");
  writeFileSync(outputFile, titleLines.join("\n"), "utf-8");

  console.log(`[build-indices] ✅ 标题库生成完成: ${titleCount} 条记录`);
  console.log(`[build-indices]    已保存至: ${outputFile}`);
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2);
  const target = args.find(a => !a.startsWith("-")); // 'quotes' | 'articles' | 'titles' | undefined
  const chunkSize = parseNumberArg(args, "--chunk", 10);
  const concurrency = parseNumberArg(args, "--concurrency", 1);
  const persistEveryChunks = args.includes("--persist-every") ? parseNumberArg(args, "--persist-every", 1) : undefined;
  const runtimeOptions: { chunkSize?: number; concurrency?: number; persistEveryChunks?: number } = {
    chunkSize,
    concurrency,
    persistEveryChunks
  };

  console.log("[build-indices] 开始构建向量索引...\n");
  console.log(`[build-indices] 数据目录: ${DATA_DIR}`);
  console.log(`[build-indices] 索引目录: ${INDICES_DIR}`);
  console.log(`[build-indices] 嵌入模型: 本地模型 (local_models)`);
  if (target) {
    console.log(`[build-indices] 🎯 仅构建目标: ${target}`);
  }

  const startTime = Date.now();

  try {
    // 构建金句库索引
    if (!target || target === 'quotes') {
      await buildQuotesIndex(runtimeOptions);
    }

    // 构建文章库索引
    if (!target || target === 'articles') {
      await buildArticlesIndex(runtimeOptions);
    }

    // 构建标题库索引 (非向量，仅生成 JSONL)
    if (!target || target === 'titles') {
      await buildTitlesIndex();
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n[build-indices] 🎉 索引构建完成! (总耗时: ${elapsed}秒)`);

  } catch (error) {
    console.error(`\n[build-indices] ❌ 构建失败:`, error);
    process.exit(1);
  }
}

// 运行
main();
