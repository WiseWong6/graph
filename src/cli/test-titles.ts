/**
 * 标题生成测试脚本
 *
 * 功能：
 * 1. 使用现有的 Brief 数据测试标题生成
 * 2. 提供完整的 Gate C 交互体验（选择、自定义、重新生成）
 * 3. 循环直到用户满意
 */

import inquirer from "inquirer";
import { titlesNode } from "../agents/article/nodes/03_titles.node.js";
import { ArticleState } from "../agents/article/state.js";
import { readFileSync } from "fs";
import { join } from "path";

// ========== Mock 数据 ==========

const MOCK_BRIEF = readFileSync(
  join(process.cwd(), "output/article-2026-01-18T12-08-01/research/00_brief.md"),
  "utf-8"
);

const MOCK_TOPICS = [
  "英伟达和 Y Combinator 支持的 GRU Space 计划在 2032 年前在月球上建造第一家酒店",
  "苹果不再与 OpenAI 合作而是和谷歌达成 AI 战略合作",
  "Skild AI 获得近 14 亿美元融资，估值超 140 亿美元，打造通用机器人基础模型",
  "Kubernetes 容器编排系统入门指南"
];

// ========== 主函数 ==========

async function main() {
  console.log("\n=== 标题生成测试 ===\n");

  // 1. 选择主题
  const { topic } = await inquirer.prompt([
    {
      type: "list",
      name: "topic",
      message: "请选择一个主题进行测试:",
      choices: [...MOCK_TOPICS, "自定义输入..."]
    }
  ]);

  let finalTopic = topic;
  if (topic === "自定义输入...") {
    const { customTopic } = await inquirer.prompt([
      {
        type: "input",
        name: "customTopic",
        message: "请输入主题:",
        validate: (input: string) => input.trim().length > 0 || "主题不能为空"
      }
    ]);
    finalTopic = customTopic;
  }

  console.log(`\n📝 主题: ${finalTopic}\n`);

  // 2. 初始化状态
  let state: Partial<ArticleState> = {
    prompt: finalTopic,
    topic: finalTopic,
    researchResult: MOCK_BRIEF,
    decisions: {}
  };

  // 3. 循环测试标题生成
  let running = true;
  let iteration = 0;

  while (running) {
    iteration++;
    console.log(`\n${"=".repeat(60)}`);
    console.log(`第 ${iteration} 轮标题生成`);
    console.log(`${"=".repeat(60)}\n`);

    // 生成标题
    const result = await titlesNode(state as ArticleState);
    state = { ...state, ...result };

    if (!state.titles || state.titles.length === 0) {
      console.error("❌ 标题生成失败");
      break;
    }

    // 4. Gate C 交互
    console.log("\n=== Gate C: 选择标题 ===\n");

    const { action } = await inquirer.prompt([
      {
        type: "list",
        name: "action",
        message: "请选择最终标题:",
        choices: [
          ...state.titles.map((title, index) => ({
            name: `${index + 1}. ${title}`,
            value: title
          })),
          new inquirer.Separator("───"),
          { name: "📝 自定义标题", value: "__CUSTOM__" },
          { name: "🔄 重新生成标题", value: "__REGENERATE__" },
          { name: "✅ 完成测试", value: "__EXIT__" }
        ]
      }
    ]);

    // 处理选择
    if (action === "__EXIT__") {
      console.log("\n✅ 测试完成");
      running = false;
    } else if (action === "__REGENERATE__") {
      console.log("\n🔄 重新生成标题...\n");
      // 清除旧标题，保持其他状态
      state.titles = undefined;
      state.decisions!.selectedTitle = undefined;
    } else if (action === "__CUSTOM__") {
      const { customTitle } = await inquirer.prompt([
        {
          type: "input",
          name: "customTitle",
          message: "请输入标题:",
          validate: (input: string) => input.trim().length > 0 || "标题不能为空"
        }
      ]);
      console.log(`\n✅ 自定义标题: ${customTitle}`);
      console.log("\n测试完成！\n");
      running = false;
    } else {
      console.log(`\n✅ 已选择: ${action}`);
      console.log("\n测试完成！\n");
      running = false;
    }
  }

  // 5. 总结
  console.log(`${"=".repeat(60)}`);
  console.log("测试总结");
  console.log(`${"=".repeat(60)}`);
  console.log(`总轮数: ${iteration}`);
  console.log(`最终主题: ${state.topic}`);
  console.log(`最终标题: ${state.decisions?.selectedTitle || "未选择"}`);
  console.log(`${"=".repeat(60)}\n`);
}

// ========== 运行 ==========

main().catch((error) => {
  console.error("测试失败:", error);
  process.exit(1);
});
