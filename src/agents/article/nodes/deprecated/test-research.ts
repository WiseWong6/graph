/**
 * Research 节点独立测试
 *
 * 用于验证:
 * 1. 搜索能力是否正常工作
 * 2. 使用的是 MCP 还是 HTTP
 * 3. 搜索结果质量
 */

import { researchNode } from "../02_research.node.js";
import type { ArticleState } from "../../state.js";

/**
 * 测试 Research 节点
 */
async function testResearch() {
  console.log("=== Research 节点测试 ===\n");

  // 测试用例
  const testCases = [
    {
      name: "简单主题",
      prompt: "什么是 AI Agent？"
    },
    {
      name: "复杂主题",
      prompt: "写一篇关于 LangGraph 和 LangChain 区别的文章"
    },
    {
      name: "模糊输入",
      prompt: "我想写一些关于 Kubernetes 的内容"
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n--- 测试: ${testCase.name} ---`);
    console.log(`输入: ${testCase.prompt}\n`);

    const initialState: Partial<ArticleState> = {
      prompt: testCase.prompt
    };

    try {
      const startTime = Date.now();
      const result = await researchNode(initialState as ArticleState);
      const duration = (Date.now() - startTime) / 1000;

      console.log(`\n✅ 测试完成 (${duration.toFixed(2)}s)`);
      console.log(`主题: ${result.topic}`);
      console.log(`输出目录: ${result.outputPath}`);

      // 显示摘要
      if (result.researchResult) {
        const preview = result.researchResult
          .split("\n")
          .slice(0, 20)
          .join("\n");
        console.log(`\n结果预览:\n${preview}...`);
      }
    } catch (error) {
      console.error(`\n❌ 测试失败: ${error}`);
    }
  }

  console.log("\n=== 测试完成 ===");
}

/**
 * 测试搜索能力（对比不同方式）
 */
async function testSearchCapabilities() {
  console.log("\n=== 搜索能力对比测试 ===\n");

  // 检查环境
  console.log("环境检查:");
  console.log(`  CLAUDE_CODE_MCP_AVAILABLE: ${process.env.CLAUDE_CODE_MCP_AVAILABLE || "未设置"}`);
  console.log(`  FIRECRAWL_API_KEY: ${process.env.FIRECRAWL_API_KEY ? "已设置" : "未设置"}`);
  console.log("");

  // 导入适配器 - 使用 WebSearchAdapter
  const { WebSearchAdapter } = await import("../../../../adapters/web-search.js");
  const adapter = new WebSearchAdapter();

  // 健康检查
  const healthCheck = await adapter.healthCheck();
  console.log("WebSearch 适配器状态:");
  console.log(`  可用: ${healthCheck.data?.available}`);
  console.log(`  模式: ${healthCheck.data?.mode}`);
  console.log("");

  // 测试搜索
  const testQuery = "AI Agent 最新进展 2026";
  console.log(`测试搜索: "${testQuery}"\n`);

  try {
    const result = await adapter.search(testQuery, { limit: 5 });

    if (result.success) {
      console.log(`✅ 搜索成功 (${result.data?.length} 个结果)`);
      console.log(`  降级模式: ${result.fallback ? "是 (HTTP)" : "否 (MCP)"}\n`);

      result.data?.slice(0, 3).forEach((item, i) => {
        console.log(`  ${i + 1}. ${item.title}`);
        console.log(`     ${item.url}`);
        if (item.snippet) {
          console.log(`     ${item.snippet.substring(0, 100)}...`);
        }
        console.log("");
      });
    } else {
      console.error(`❌ 搜索失败: ${result.error}`);
    }
  } catch (error) {
    console.error(`❌ 搜索异常: ${error}`);
  }
}

// 命令行入口
const args = process.argv.slice(2);
const command = args[0];

if (command === "search") {
  testSearchCapabilities();
} else if (command === "full") {
  testResearch();
} else {
  console.log("用法:");
  console.log("  test-research search  - 测试搜索能力");
  console.log("  test-research full    - 完整测试 research 节点");
}
