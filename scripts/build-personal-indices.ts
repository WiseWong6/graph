/**
 * 个人写作库索引构建脚本
 *
 * 功能：
 * 1. 读取 PDF 文件（data/rewrite/）
 * 2. 提取文本并分块
 * 3. 自动标注 component_type
 * 4. 分别建立 content/voice 两张 LanceDB 表
 *
 * 使用方式:
 *   npm run rag:personal:index
 */

import { VectorStoreIndex, Document, storageContextFromDefaults, Settings } from "llamaindex";
import { LanceDBVectorStore } from "../src/rag/vector-store/lancedb.js";
import { HuggingFaceEmbedding } from "@llamaindex/huggingface";
import { readFileSync, readdirSync, mkdirSync, existsSync } from "fs";
import { join, resolve } from "path";
import { createHash } from "crypto";

const PERSONAL_KB_DIR = process.env.PERSONAL_KB_DIR || join(process.cwd(), "data", "rewrite");
const PERSONAL_LANCEDB_DIR = process.env.PERSONAL_LANCEDB_DIR || join(process.cwd(), "data", "lancedb_personal");

Settings.embedModel = new HuggingFaceEmbedding({
  modelType: resolve(process.cwd(), "local_models"),
  modelOptions: {
    dtype: "fp32"
  }
});

function formatDurationMs(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "0s";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remain = seconds % 60;
  return `${minutes}m${remain}s`;
}

interface ArticleMetadata {
  article_id: string;
  article_title: string;
  date?: string;
  tags?: string[];
  pillar?: string;
  channel?: string;
}

interface Chunk {
  text: string;
  metadata: ArticleMetadata & {
    component_type: string;
    section_path?: string;
  };
}

declare module "pdf-parse" {
  interface PDFData {
    text: string;
    numpages: number;
    numrender: number;
    info: Record<string, any>;
    metadata: Record<string, any>;
    version: string;
  }

  interface PDFOptions {
    max?: number;
  }

  function pdfParse(dataBuffer: Buffer, options?: PDFOptions): Promise<PDFData>;
  export = pdfParse;
}

async function loadPDF(filePath: string): Promise<string> {
  try {
    const pdfParse = (await import("pdf-parse")).default;
    const dataBuffer = readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    return data.text;
  } catch (error) {
    console.error(`[build-personal-indices] ❌ PDF 解析失败: ${filePath}`, error);
    return "";
  }
}

function inferMetadata(filePath: string): ArticleMetadata {
  const fileName = filePath.split("/").pop() || "";
  const articleId = fileName.replace(/\.[^/.]+$/, "");
  const articleTitle = articleId.replace(/[_-]/g, " ");

  return {
    article_id: articleId,
    article_title: articleTitle
  };
}

function chunkText(text: string, metadata: ArticleMetadata): Chunk[] {
  const chunks: Chunk[] = [];

  const paragraphs = text.split(/\n\n+/);
  const sectionPath = "root";

  paragraphs.forEach((paragraph, index) => {
    const trimmed = paragraph.trim();
    if (trimmed.length < 20) return;

    const componentType = classifyComponent(trimmed, index);

    chunks.push({
      text: trimmed,
      metadata: {
        ...metadata,
        component_type: componentType,
        section_path: sectionPath
      }
    });
  });

  return chunks;
}

function classifyComponent(text: string, index: number): string {
  const contentTypes = ["concept", "framework", "method", "case", "data", "checklist", "counterpoint"];
  const voiceTypes = ["hook_opening", "turning_point", "metaphor", "closing", "sentence_pattern"];

  if (index === 0) {
    return voiceTypes[0];
  }

  const lowerText = text.toLowerCase();

  if (lowerText.includes("第一步") || lowerText.includes("首先") || lowerText.includes("步骤")) {
    return "method";
  }
  if (lowerText.includes("案例") || lowerText.includes("例子") || lowerText.includes("例如")) {
    return "case";
  }
  if (lowerText.includes("数据") || lowerText.includes("统计") || /\d+%/.test(text)) {
    return "data";
  }
  if (lowerText.includes("清单") || /\d+[.、]/.test(text)) {
    return "checklist";
  }
  if (lowerText.includes("但是") || lowerText.includes("然而") || lowerText.includes("不过")) {
    return "counterpoint";
  }
  if (lowerText.includes("比喻") || lowerText.includes("像") || lowerText.includes("类似")) {
    return "metaphor";
  }
  if (lowerText.includes("总结") || lowerText.includes("最后") || lowerText.includes("结论")) {
    return "closing";
  }

  return contentTypes[Math.floor(Math.random() * contentTypes.length)];
}

function buildEmbeddingText(chunk: Chunk): string {
  const { metadata, text } = chunk;
  return text;
}

async function buildPersonalIndex(
  name: string,
  chunks: Chunk[],
  tableName: string,
  indexDir: string,
  lancedbUri: string
): Promise<void> {
  if (chunks.length === 0) {
    console.log(`[build-personal-indices] ⚠️  ${name}: 无数据，跳过`);
    return;
  }

  mkdirSync(indexDir, { recursive: true });

  const vectorStore = new LanceDBVectorStore({
    uri: lancedbUri,
    tableName: tableName
  });

  await vectorStore.init();

  const storageContext = await storageContextFromDefaults({
    persistDir: indexDir,
    vectorStore: vectorStore
  });

  console.log(`[build-personal-indices] ${name}: 共 ${chunks.length} 个 chunks`);

  const batchSize = 50;
  const totalBatches = Math.ceil(chunks.length / batchSize);
  const startTime = Date.now();

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batchChunks = chunks.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;

    const docs = batchChunks.map(chunk => {
      const embeddingText = buildEmbeddingText(chunk);
      const doc = new Document({
        text: embeddingText,
        metadata: {
          article_id: chunk.metadata.article_id,
          component_type: chunk.metadata.component_type,
          original_text: chunk.text.slice(0, 500)
        }
      });
      const hash = createHash("sha256").update(chunk.text).digest("hex");
      doc.id_ = `${chunk.metadata.article_id}_${hash.slice(0, 8)}`;
      return doc;
    });

    try {
      if (i === 0) {
        await VectorStoreIndex.fromDocuments(docs, {
          storageContext
        });
      } else {
        const index = await VectorStoreIndex.init({
          storageContext
        });
        const nodes = await Settings.nodeParser.getNodesFromDocuments(docs);
        await index.insertNodes(nodes);
      }
    } catch (error) {
      console.error(`[build-personal-indices] ❌ 批次 ${batchNum} 失败:`, error);
    }

    process.stdout.write(
      `\r[build-personal-indices] ${name} · 批 ${batchNum}/${totalBatches} · ${i + batchChunks.length}/${chunks.length} · ETA ${formatDurationMs(((Date.now() - startTime) / (i + batchChunks.length) * (chunks.length - i - batchChunks.length)))}       `
    );
  }

  process.stdout.write("\n");
  console.log(`[build-personal-indices] ✅ ${name} 索引构建完成，已保存至: ${indexDir}`);
}

async function main() {
  console.log("[build-personal-indices] 开始构建个人写作库索引...\n");
  console.log(`[build-personal-indices] 数据目录: ${PERSONAL_KB_DIR}`);
  console.log(`[build-personal-indices] 索引目录: ${PERSONAL_LANCEDB_DIR}`);

  if (!existsSync(PERSONAL_KB_DIR)) {
    console.error(`[build-personal-indices] ❌ 目录不存在: ${PERSONAL_KB_DIR}`);
    process.exit(1);
  }

  const files = readdirSync(PERSONAL_KB_DIR).filter(f => f.endsWith(".pdf"));
  if (files.length === 0) {
    console.error(`[build-personal-indices] ❌ 未找到 PDF 文件`);
    process.exit(1);
  }

  console.log(`[build-personal-indices] 找到 ${files.length} 个 PDF 文件\n`);

  const allContentChunks: Chunk[] = [];
  const allVoiceChunks: Chunk[] = [];

  for (const file of files) {
    const filePath = join(PERSONAL_KB_DIR, file);
    console.log(`[build-personal-indices] 处理: ${file}`);

    const metadata = inferMetadata(filePath);
    const text = await loadPDF(filePath);

    if (!text) {
      console.warn(`[build-personal-indices] ⚠️  ${file}: 文本为空，跳过`);
      continue;
    }

    const chunks = chunkText(text, metadata);

    const contentChunks = chunks.filter(c => [
      "concept", "framework", "method", "case", "data", "checklist", "counterpoint"
    ].includes(c.metadata.component_type));

    const voiceChunks = chunks.filter(c => [
      "hook_opening", "turning_point", "metaphor", "closing", "sentence_pattern"
    ].includes(c.metadata.component_type));

    allContentChunks.push(...contentChunks);
    allVoiceChunks.push(...voiceChunks);

    console.log(`[build-personal-indices]   ${file}: ${chunks.length} chunks (content=${contentChunks.length}, voice=${voiceChunks.length})`);
  }

  console.log(`\n[build-personal-indices] 总计: content=${allContentChunks.length}, voice=${allVoiceChunks.length}`);

  const startTime = Date.now();

  try {
    await buildPersonalIndex(
      "个人写作库 Content",
      allContentChunks,
      "personal_content_chunks",
      join(PERSONAL_LANCEDB_DIR, "content"),
      PERSONAL_LANCEDB_DIR
    );

    await buildPersonalIndex(
      "个人写作库 Voice",
      allVoiceChunks,
      "personal_voice_chunks",
      join(PERSONAL_LANCEDB_DIR, "voice"),
      PERSONAL_LANCEDB_DIR
    );

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n[build-personal-indices] 🎉 个人写作库索引构建完成! (总耗时: ${elapsed}秒)`);
  } catch (error) {
    console.error(`\n[build-personal-indices] ❌ 构建失败:`, error);
    process.exit(1);
  }
}

main();
