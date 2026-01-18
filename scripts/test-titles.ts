/**
 * 测试脚本：验证 titlesNode 中的 Brief 标题提取
 *
 * 使用现有 brief 测试：
 * 1. 写作角度描述提取
 * 2. 标题建议提取（去除书名号）
 * 3. 去重合并
 */

import { titlesNode } from "../src/agents/article/nodes/03_titles.node.js";
import fs from "fs";
import { config } from "dotenv";
import { resolve } from "path";

// 加载环境变量
config({ path: resolve(process.cwd(), ".env") });

async function main() {
  console.log("=== 测试 Brief 标题提取 ===\n");

  // 读取现有 brief
  const briefPath = "./output/article-2026-01-18T14-25-55/research/00_brief.md";
  if (!fs.existsSync(briefPath)) {
    console.error(`Brief 文件不存在: ${briefPath}`);
    process.exit(1);
  }

  const brief = fs.readFileSync(briefPath, "utf-8");
  console.log(`已读取 Brief: ${briefPath}\n`);

  // 构造最小 state
  const state = {
    topic: "MiniMax宣布开源面向Coding Agent的新评测集",
    researchResult: brief,
    decisions: {
      wechat: {
        account: "account1",
        name: "测试",
        appId: "",
        appSecret: ""
      }
    }
  };

  // 运行 titlesNode
  console.log("运行 titlesNode...\n");
  const result = await titlesNode(state);

  console.log("\n=== 最终标题列表 ===\n");
  if (result.titles && result.titles.length > 0) {
    result.titles.forEach((title, i) => {
      console.log(`${i + 1}. ${title}`);
    });
    console.log(`\n共 ${result.titles.length} 个标题`);

    // 验证：检查 brief 标题是否在结果中
    // Brief 中应该有 3 个角度标题 + 3 个标题建议 = 6 个标题
    const briefTitlesStartIndex = 8;  // 前 8 个是 LLM 生成的
    const briefTitlesCount = 6;

    console.log("\n=== 验证 Brief 标题 ===");
    console.log(`预期从第 ${briefTitlesStartIndex + 1} 个开始是 Brief 标题，共 ${briefTitlesCount} 个`);

    const briefTitlesInResult = result.titles?.slice(briefTitlesStartIndex) || [];
    if (briefTitlesInResult.length >= briefTitlesCount) {
      console.log("✅ Brief 标题提取成功！");
      console.log("\nBrief 标题列表:");
      briefTitlesInResult.forEach((title, i) => {
        console.log(`  ${i + 1}. ${title}`);
      });
    } else {
      console.log(`❌ Brief 标题数量不足，预期至少 ${briefTitlesCount} 个，实际 ${briefTitlesInResult.length} 个`);
    }
  } else {
    console.error("未生成任何标题！");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("测试失败:", error);
  process.exit(1);
});
