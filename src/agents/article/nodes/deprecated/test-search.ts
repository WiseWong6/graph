#!/usr/bin/env tsx
/**
 * MCP 搜索能力测试命令
 *
 * 用途: 测试并行搜索功能，验证各搜索源是否正常工作
 *
 * 使用:
 *   tsx src/agents/article/nodes/test-search.ts "搜索查询"
 *   npm run test-search-mcp "搜索查询"
 */

import { config } from "dotenv";
import { resolve } from "path";

// 加载环境变量
config({ path: resolve(process.cwd(), ".env") });

import { createParallelSearchManager } from "../../../../adapters/parallel-search.js";

interface TestOptions {
  verbose?: boolean;
  limit?: number;
  timeout?: number;
}

async function main() {
  const args = process.argv.slice(2);
  const query = args[0] || "AI Agent 最新进展 2026";

  // 解析选项
  const options: TestOptions = {};
  for (let i = 1; i < args.length; i++) {
    if (args[i] === "--verbose") options.verbose = true;
    if (args[i] === "--limit" && args[i + 1]) options.limit = parseInt(args[i + 1]);
    if (args[i] === "--timeout" && args[i + 1]) options.timeout = parseInt(args[i + 1]);
  }

  console.log("=== MCP 搜索测试 ===");
  console.log(`查询: ${query}\n`);

  // 环境检查
  console.log("环境检查:");
  console.log(`  FIRECRAWL_API_KEY: ${process.env.FIRECRAWL_API_KEY ? "✅ 已配置" : "❌ 未配置"}`);
  console.log(`  CLAUDE_CODE_MCP_AVAILABLE: ${process.env.CLAUDE_CODE_MCP_AVAILABLE || "未设置"}`);
  console.log("");

  // 创建搜索管理器
  const manager = createParallelSearchManager();

  // 健康检查
  console.log("健康检查...");
  const health = await manager.healthCheck();
  console.log(`  mcp-webresearch (Google): ${health.webresearch ? "✅" : "❌"}`);
  console.log(`  Firecrawl: ${health.firecrawl ? "✅" : "❌"}`);
  console.log("");

  // 执行搜索
  console.log("开始并行搜索...\n");
  const startTime = Date.now();

  try {
    const { results, sources, metadata } = await manager.parallelSearch(query, {
      limit: options.limit || 10,
      timeout: options.timeout || 10000,
      minResults: 3
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`\n=== 搜索完成 (${duration}s) ===`);
    console.log(`数据源: ${sources.join(", ") || "无"}`);
    console.log(`结果数量: ${results.length}`);
    console.log(`各源结果数:`, JSON.stringify(metadata.bySource));
    console.log("");

    if (options.verbose) {
      console.log("详细结果:");
      console.log("---");
      results.forEach((r, i) => {
        console.log(`${i + 1}. [${r.source.toUpperCase()}] ${r.title}`);
        console.log(`   ${r.url}`);
        if (r.snippet) {
          const preview = r.snippet.length > 150
            ? r.snippet.substring(0, 150) + "..."
            : r.snippet;
          console.log(`   ${preview}`);
        }
        console.log("");
      });
    } else {
      console.log("结果预览:");
      console.log("---");
      results.slice(0, 5).forEach((r, i) => {
        console.log(`${i + 1}. [${r.source.toUpperCase()}] ${r.title}`);
        console.log(`   ${r.url}`);
        console.log("");
      });

      if (results.length > 5) {
        console.log(`... 还有 ${results.length - 5} 个结果\n`);
      }
    }

    // 测试通过
    if (results.length > 0) {
      console.log("✅ 搜索测试通过!");
      process.exit(0);
    } else {
      console.error("❌ 搜索测试失败: 没有返回结果");
      process.exit(1);
    }
  } catch (error) {
    console.error(`\n❌ 搜索测试失败: ${error}`);
    process.exit(1);
  }
}

main();
