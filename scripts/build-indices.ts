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
import { readFileSync, readdirSync, mkdirSync, existsSync } from "fs";
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

/**
 * 构建金句库索引
 */
async function buildQuotesIndex(): Promise<void> {
  console.log("\n[build-indices] 构建金句库索引（测试模式：只索引 2 条）...");

  const jsonlFile = join(DATA_DIR, "golden_sentences.jsonl");

  if (!existsSync(jsonlFile)) {
    console.error(`[build-indices] ❌ 文件不存在: ${jsonlFile}`);
    return;
  }

  const data = loadJSONL(jsonlFile);
  console.log(`[build-indices]   加载 ${data.length} 条金句`);

  // ===== 测试模式：只处理前 2 条 =====
  const testData = data.slice(0, 2);
  console.log(`[build-indices]   ⚠️  测试模式：只索引 ${testData.length} 条`);

  // 转换为 Document
  const docs: Document[] = [];

  for (const item of testData) {  // 使用 testData
    const doc = new Document({
      text: item.content,
      metadata: {
        id: item.id,
        author: item.author || "",
        quote_type: item.quote_type || "",
        quality_score: item.quality_score?.overall || 0,
        source_title: item.source_title || "",
        url: item.source_url || "",
        category: item.category || ""
      }
    });
    docs.push(doc);
  }

  console.log(`[build-indices]   开始向量化 ${docs.length} 条...`);

  // 输出目录
  const outputDir = join(INDICES_DIR, "golden_quotes");
  mkdirSync(outputDir, { recursive: true });

  // 创建 StorageContext
  const storageContext = await storageContextFromDefaults({
    persistDir: outputDir
  });

  // 构建索引（带存储上下文）
  const index = await VectorStoreIndex.fromDocuments(docs, {
    storageContext
  });

  console.log(`[build-indices]   ✅ 金句库索引已保存: ${outputDir}`);
}

/**
 * 构建文章库索引
 */
async function buildArticlesIndex(): Promise<void> {
  console.log("\n[build-indices] 构建文章库索引（测试模式：只索引 2 篇）...");

  // 查找所有解析后的 JSONL 文件
  const articlesDir = join(DATA_DIR, "articles");

  if (!existsSync(articlesDir)) {
    console.error(`[build-indices] ❌ 目录不存在: ${articlesDir}`);
    console.error(`[build-indices]    请先运行: npm run parse-articles`);
    return;
  }

  const files = readdirSync(articlesDir).filter(f => f.endsWith(".jsonl"));

  if (files.length === 0) {
    console.error(`[build-indices] ❌ 未找到 JSONL 文件: ${articlesDir}`);
    console.error(`[build-indices]    请先运行: npm run parse-articles`);
    return;
  }

  let allDocs: Document[] = [];

  for (const file of files) {
    const filePath = join(articlesDir, file);
    console.log(`[build-indices]   加载: ${file}`);

    const data = loadJSONL(filePath);

    // ===== 测试模式：只处理前 2 条 =====
    const testItems = data.slice(0, 2);
    console.log(`[build-indices]   ⚠️  测试模式：只索引 ${testItems.length} 条`);

    for (const item of testItems) {
      // 组合标题和内容
      const text = `标题：${item.title}\n\n${item.content}`;

      const doc = new Document({
        text,
        metadata: {
          title: item.title || "",
          author: item.author || "",
          publish_time: item.publish_time || "",
          url: item.url || "",
          source_file: file
        }
      });
      allDocs.push(doc);
    }

    // 测试模式：只处理第一个文件
    break;
  }

  console.log(`[build-indices]   总计 ${allDocs.length} 篇文章（测试）`);
  console.log(`[build-indices]   开始向量化...`);

  // 输出目录
  const outputDir = join(INDICES_DIR, "articles");
  mkdirSync(outputDir, { recursive: true });

  // 创建 StorageContext
  const storageContext = await storageContextFromDefaults({
    persistDir: outputDir
  });

  // 构建索引（带存储上下文）
  const index = await VectorStoreIndex.fromDocuments(allDocs, {
    storageContext
  });

  console.log(`[build-indices]   ✅ 文章库索引已保存: ${outputDir}`);
}

/**
 * 主函数
 */
async function main() {
  console.log("[build-indices] 开始构建向量索引...\n");
  console.log(`[build-indices] 数据目录: ${DATA_DIR}`);
  console.log(`[build-indices] 索引目录: ${INDICES_DIR}`);
  console.log(`[build-indices] 嵌入模型: BAAI/bge-small-zh-v1.5`);

  const startTime = Date.now();

  try {
    // 构建金句库索引
    await buildQuotesIndex();

    // 构建文章库索引
    await buildArticlesIndex();

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n[build-indices] ✅ 所有索引构建完成! (耗时: ${elapsed}秒)`);

  } catch (error) {
    console.error(`\n[build-indices] ❌ 构建失败: ${error}`);
    process.exit(1);
  }
}

// 运行
main();
