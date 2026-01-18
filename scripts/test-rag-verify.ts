/**
 * RAG 节点验证脚本
 *
 * 直接测试 IndexManager 和检索功能，无需交互
 */

import IndexManager from "../src/rag/index/index-manager.js";
import { formatRAGContent } from "../src/rag/utils/rag-formatter.js";

const TEST_QUERIES = [
  "AI Agent 开发最佳实践",
  "习惯养成技巧",
  "深度学习入门"
];

async function main() {
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║   RAG 节点验证                                          ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  try {
    // 初始化 IndexManager
    console.log("⏳ 初始化 IndexManager...");
    const indexManager = IndexManager.getInstance();
    await indexManager.loadIndices();
    console.log("✅ IndexManager 初始化成功\n");

    // 测试每个查询
    for (const query of TEST_QUERIES) {
      console.log("═══════════════════════════════════════════════════════════");
      console.log(`🔍 查询: ${query}`);
      console.log("═══════════════════════════════════════════════════════════\n");

      // 执行检索（分别调用三个方法）
      const startTime = Date.now();

      const [quotes, articles, titles] = await Promise.all([
        indexManager.retrieveQuotes(query, { topK: 3 }),
        indexManager.retrieveArticles(query, { topK: 2 }),
        indexManager.retrieveTitles(query, { topK: 5 })
      ]);

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      // 组装 RAGContent 对象
      const ragContent = {
        topic: query,
        quotes,
        articles,
        titles,
        stats: {
          quotesCount: quotes.length,
          articlesCount: articles.length,
          titlesCount: titles.length,
          retrievalTime: parseFloat(duration) * 1000
        }
      };

      // 格式化结果
      const formatted = formatRAGContent(ragContent);

      // 输出结果
      console.log(`⏱️  耗时: ${duration}s`);
      console.log(`📊 结果数量: ${quotes.length} 条金句, ${articles.length} 篇文章, ${titles.length} 个标题\n`);

      if (quotes.length > 0) {
        console.log("💬 金句:");
        quotes.slice(0, 2).forEach((q, i) => {
          console.log(`  [${i + 1}] ${q.content?.substring(0, 80)}...`);
        });
        console.log("");
      }

      if (articles.length > 0) {
        console.log("📄 文章片段:");
        articles.slice(0, 2).forEach((a, i) => {
          console.log(`  [${i + 1}] ${a.content?.substring(0, 80)}...`);
        });
        console.log("");
      }

      if (titles.length > 0) {
        console.log("📌 参考标题:");
        titles.slice(0, 5).forEach((t, i) => {
          console.log(`  [${i + 1}] ${t.title}`);
        });
        console.log("");
      }

      console.log("📝 格式化 Prompt 预览:");
      console.log("─".repeat(60));
      console.log(formatted.substring(0, 400) + "...");
      console.log("─".repeat(60) + "\n");
    }

    console.log("═══════════════════════════════════════════════════════════");
    console.log("✅ 验证完成");
    console.log("═══════════════════════════════════════════════════════════\n");

  } catch (error) {
    console.error("❌ 验证失败:", error);
    process.exit(1);
  }
}

main();
