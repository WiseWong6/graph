/**
 * RAG 节点
 *
 * 职责: 基于调研 Brief，从本地知识库检索相关素材
 *
 * 数据流:
 * researchResult (Brief) → 提取关键词 → 并行检索 → 生成 RAG 内容 → 文件落盘
 *
 * 设计原则:
 * - 并行检索多个库（金句、文章、标题）
 * - 统一格式化输出
 * - 不破坏现有数据
 */

import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { ArticleState } from "../state";
import IndexManager from "../../../rag/index/index-manager.js";
import { formatRAGContent, extractKeywords, buildQuery } from "../../../rag/utils/rag-formatter.js";
import type { RAGContent } from "../../../rag/index/schema.js";

/**
 * RAG 节点主函数
 *
 * @param state - 当前状态
 * @returns 更新的状态
 */
export async function ragNode(state: ArticleState): Promise<Partial<ArticleState>> {
  const startTime = Date.now();
  console.log("[02_rag] Starting RAG retrieval for:", state.topic);

  // ========== 步骤 1: 加载索引 ==========
  console.log("[02_rag] Step 1: Loading indices...");
  const manager = IndexManager.getInstance();
  await manager.loadIndices();

  if (!manager.isReady()) {
    console.warn("[02_rag] ⚠️ 索引未就绪，返回空内容");
    return {
      ragContent: "# RAG 检索结果\n\n⚠️ 索引未初始化，请先运行: npm run build-indices"
    };
  }

  // ========== 步骤 2: 提取关键词 ==========
  console.log("[02_rag] Step 2: Extracting keywords from Brief...");
  const keywords = extractKeywords(state.researchResult || "");
  console.log(`[02_rag] Extracted ${keywords.length} keywords: ${keywords.slice(0, 5).join(", ")}...`);

  const query = buildQuery(state.topic, keywords);
  console.log(`[02_rag] Query: ${query}`);

  // ========== 步骤 3: 并行检索 ==========
  console.log("[02_rag] Step 3: Parallel retrieval...");

  const [quotes, articles, titles] = await Promise.all([
    manager.retrieveQuotes(query, { topK: 3 }),
    manager.retrieveArticles(query, { topK: 2 }),
    manager.retrieveTitles(query, { topK: 10 })
  ]);

  console.log(`[02_rag] Retrieved:`);
  console.log(`  - ${quotes.length} quotes`);
  console.log(`  - ${articles.length} articles`);
  console.log(`  - ${titles.length} titles`);

  // ========== 步骤 4: 生成 RAG 内容 ==========
  console.log("[02_rag] Step 4: Generating RAG content...");

  const retrievalTime = Date.now() - startTime;

  const ragData: RAGContent = {
    topic: state.topic,
    quotes,
    articles,
    titles,
    stats: {
      quotesCount: quotes.length,
      articlesCount: articles.length,
      titlesCount: titles.length,
      retrievalTime
    }
  };

  const ragMarkdown = formatRAGContent(ragData);

  console.log("[02_rag] RAG content generated:");
  console.log(`  ${quotes.length} quotes, ${articles.length} articles, ${titles.length} titles`);
  console.log(`  Time: ${retrievalTime}ms`);

  // ========== 步骤 5: 保存文件 ==========
  console.log("[02_rag] Step 5: Saving files...");

  const outputPath = state.outputPath || getDefaultOutputPath();
  const researchDir = join(outputPath, "research");

  // 确保目录存在
  mkdirSync(researchDir, { recursive: true });

  // 保存 RAG 内容
  const ragPath = join(researchDir, "01_rag_content.md");
  writeFileSync(ragPath, ragMarkdown, "utf-8");
  console.log(`[02_rag] Saved RAG content: ${ragPath}`);

  console.log(`[02_rag] Total time: ${((Date.now() - startTime) / 1000).toFixed(2)}s`);

  return {
    ragContent: ragMarkdown,
    outputPath
  };
}

/**
 * 获取默认输出路径
 */
function getDefaultOutputPath(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const runId = `article-${timestamp}`;
  return join(process.cwd(), "output", runId);
}
