/**
 * Prompts 节点快速测试（非交互式）
 *
 * 验证五风格提示词生成
 */

import { promptsNode } from "../src/agents/article/nodes/10_prompts.node.js";
import { ArticleState, ImageStyle } from "../src/agents/article/state.js";
import { config } from "dotenv";
import { resolve } from "path";

// 加载环境变量
config({ path: resolve(process.cwd(), ".env") });

/**
 * 模拟文章内容
 */
const MOCK_ARTICLE = `
# 什么是 AI Agent？

AI Agent 是人工智能代理，它能够自主感知环境、做出决策并执行动作。

## 工作原理

1. **感知**: Agent 通过传感器获取环境信息
2. **决策**: 基于目标和规则选择最优行动
3. **执行**: 通过执行器改变环境状态

这个过程不断循环，使 Agent 能够持续学习和适应。

## 核心特征

- **自主性**: 无需人工干预即可运行
- **反应性**: 能及时响应环境变化
- **主动性**: 能主动采取行动实现目标
`.trim();

/**
 * 测试单个风格
 */
async function testStyle(style: ImageStyle): Promise<{
  success: boolean;
  prompts?: string[];
  error?: string;
  duration: number;
}> {
  const startTime = Date.now();

  try {
    const state: ArticleState = {
      prompt: "测试主题",
      topic: "测试",
      humanized: MOCK_ARTICLE,
      researchResult: "",
      ragContent: "",
      titles: [],
      draft: "",
      polished: "",
      rewritten: "",
      imagePrompts: [],
      imagePaths: [],
      uploadedImageUrls: [],
      htmlPath: "",
      decisions: {
        images: {
          confirmed: true,
          count: 2,
          style,
          model: "doubao-seedream-4-5-251128",
          resolution: "2k"
        }
      },
      outputPath: "",
      status: "",
      runId: "",
      generatedText: "",
      generatedText2: "",
      generatedText3: "",
    };

    const result = await promptsNode(state);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    return {
      success: true,
      prompts: result.imagePrompts,
      duration: parseFloat(duration)
    };
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    return {
      success: false,
      error: String(error),
      duration: parseFloat(duration)
    };
  }
}

/**
 * 验证提示词质量
 */
function validatePrompts(prompts: string[], style: ImageStyle): {
  hasStyleKeywords: boolean;
  hasFunctionalLabels: boolean;
  hasNegativeConstraints: boolean;
} {
  // 风格关键词
  const styleKeywords: Record<ImageStyle, string[]> = {
    infographic: ["flat vector", "white background", "thin-outline", "infographic"],
    healing: ["warm pastel", "soft light", "healing", "gentle"],
    pixar: ["pixar style", "sharpie", "bold lines", "vibrant"],
    sokamono: ["minimalist", "simple lines", "sokamono", "clean"],
    handdrawn: ["hand-drawn", "grid paper", "marker pen", "notebook"]
  };

  const keywords = styleKeywords[style] || [];
  const hasStyleKeywords = prompts.some(p => {
    const lower = p.toLowerCase();
    return keywords.some(kw => lower.includes(kw.toLowerCase()));
  });

  // 检测功能性标签（不想要的）
  const hasFunctionalLabels = prompts.some(p => {
    const lower = p.toLowerCase();
    return (
      lower.includes("for correct") ||
      lower.includes("for success") ||
      lower.includes("for warning") ||
      lower.includes("for error") ||
      lower.includes("checkmark") ||
      lower.includes("warning label")
    );
  });

  // 检测负面约束
  const hasNegativeConstraints = prompts.some(p => {
    const lower = p.toLowerCase();
    return (
      lower.includes("no watermark") ||
      lower.includes("no logo") ||
      lower.includes("no random letters")
    );
  });

  return {
    hasStyleKeywords,
    hasFunctionalLabels,
    hasNegativeConstraints
  };
}

/**
 * 主测试函数
 */
async function main() {
  console.log("\n🎨 Prompts 节点快速测试\n");
  console.log("=".repeat(60) + "\n");

  const styles: ImageStyle[] = ["infographic", "healing", "pixar", "sokamono", "handdrawn"];
  const results: Array<{
    style: ImageStyle;
    success: boolean;
    prompts?: string[];
    error?: string;
    duration: number;
    validation?: ReturnType<typeof validatePrompts>;
  }> = [];

  for (const style of styles) {
    console.log(`🔄 测试风格: ${style}`);

    const result = await testStyle(style);

    if (result.success && result.prompts) {
      const validation = validatePrompts(result.prompts, style);
      results.push({ style, ...result, validation });

      console.log(`   ✅ 成功 (${result.duration}s)`);
      console.log(`   📝 生成 ${result.prompts.length} 个提示词`);
      console.log(`   🎭 风格关键词: ${validation.hasStyleKeywords ? "✅" : "❌"}`);
      console.log(`   ⚠️ 功能性标签: ${validation.hasFunctionalLabels ? "❌ (有问题)" : "✅ (无问题)"}`);
      console.log(`   🚫 负面约束: ${validation.hasNegativeConstraints ? "✅" : "❌"}`);
      console.log("");
    } else {
      results.push({ style, ...result });
      console.log(`   ❌ 失败 (${result.duration}s)`);
      console.log(`   错误: ${result.error}\n`);
    }
  }

  // 汇总
  console.log("=".repeat(60));
  console.log("\n📊 测试结果汇总\n");

  const successCount = results.filter(r => r.success).length;
  const totalCount = results.length;

  console.log(`成功: ${successCount}/${totalCount}\n`);

  // 显示样例提示词
  console.log("=".repeat(60));
  console.log("\n📝 样例提示词（每种风格第一个）\n");

  for (const result of results) {
    if (result.success && result.prompts && result.prompts.length > 0) {
      console.log(`【${result.style}】`);
      console.log(result.prompts[0].substring(0, 150) + "...\n");
    }
  }

  // 颜色描述专项检查
  console.log("=".repeat(60));
  console.log("\n🔍 颜色描述专项检查（handdrawn 风格）\n");

  const handdrawnResult = results.find(r => r.style === "handdrawn");
  if (handdrawnResult?.prompts) {
    for (let i = 0; i < handdrawnResult.prompts.length; i++) {
      const prompt = handdrawnResult.prompts[i];
      console.log(`提示词 ${i + 1}:`);

      // 检查颜色描述
      const colorMatches = prompt.match(/(green|red|blue|yellow)[^,.]*/gi);
      if (colorMatches) {
        console.log(`  颜色描述: ${colorMatches.join(", ")}`);

        // 检查是否有功能性描述
        const hasFunctionalIssue = colorMatches.some(m =>
          /for\s+(correct|success|warning|error)/i.test(m)
        );

        if (hasFunctionalIssue) {
          console.log(`  ⚠️ 发现功能性关联 - 可能导致生成文字标签`);
        } else {
          console.log(`  ✅ 纯装饰性描述 - 无问题`);
        }
      }
      console.log("");
    }
  }

  console.log("=".repeat(60));
  console.log("\n✅ 测试完成!\n");
}

main().catch(console.error);
