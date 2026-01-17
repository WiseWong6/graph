/**
 * Image Prompts 节点
 *
 * 职责: 基于人化文章生成图片提示词
 *
 * 数据流:
 * humanized + imageConfig → LLM 生成提示词 → imagePrompts[]
 *
 * 设计原则:
 * - 每个核心段落生成一个提示词
 * - 考虑图片方向和比例
 * - 使用英文提示词(大多数模型)
 */

import { ArticleState } from "../state";
import { getNodeLLMConfig } from "../../../config/llm.js";
import { LLMClient } from "../../../utils/llm-client.js";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env") });

/**
 * 图片提示词
 */
export interface ImagePrompt {
  paragraph_index: number;
  paragraph_summary: string;
  prompt: string;        // 英文提示词
  style: string;        // 风格描述
  mood: string;         // 情感基调
}

/**
 * Image Prompts 节点主函数
 *
 * @param state - 当前状态
 * @returns 更新的状态
 */
export async function promptsNode(state: ArticleState): Promise<Partial<ArticleState>> {
  console.log("[10_prompts] Generating image prompts...");

  if (!state.humanized) {
    console.error("[10_prompts] No humanized article to generate prompts for");
    throw new Error("Humanized article not found in state");
  }

  // 获取图片配置
  const imageConfig = state.decisions?.images;
  const count = imageConfig?.count || 4;
  const orientation = imageConfig?.orientation || "landscape";

  console.log(`[10_prompts] Config: ${count} images, ${orientation} orientation`);

  // ========== 构建 Prompt ==========
  const prompt = buildPromptPrompt(state.humanized, count, orientation);

  // ========== 调用 LLM ==========
  const llmConfig = getNodeLLMConfig("image_prompt");
  const client = new LLMClient(llmConfig);

  console.log("[10_prompts] Calling LLM with config:", llmConfig.model);

  try {
    const response = await client.call({
      prompt,
      systemMessage: PROMPT_SYSTEM_MESSAGE
    });

    console.log("[10_prompts] Prompts generated");

    // ========== 解析提示词 ==========
    const prompts = parsePrompts(response.text);
    const promptStrings = prompts.map(p => p.prompt);

    console.log(`[10_prompts] Generated ${promptStrings.length} prompts:`);
    prompts.forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.paragraph_summary}`);
      console.log(`     ${p.prompt.substring(0, 60)}...`);
    });

    return {
      imagePrompts: promptStrings
    };
  } catch (error) {
    console.error(`[10_prompts] Failed to generate prompts: ${error}`);

    // 降级: 返回通用提示词
    const fallbackPrompts = generateFallbackPrompts(count);
    console.log("[10_prompts] Using fallback prompts");

    return {
      imagePrompts: fallbackPrompts
    };
  }
}

/**
 * 构建提示词生成 Prompt
 */
function buildPromptPrompt(article: string, count: number, orientation: string): string {
  // 提取文章摘要
  const summary = extractSummary(article);

  const lines: string[] = [];

  lines.push(`请为一篇文章生成 ${count} 个配图提示词。\n`);

  lines.push("文章内容摘要:");
  lines.push(summary);
  lines.push("");

  lines.push("配图要求:");
  lines.push(`  1. 数量: ${count} 张`);
  lines.push(`  2. 方向: ${orientation === "landscape" ? "横屏 (16:9)" : "竖屏 (3:4)"}`);
  lines.push("  3. 风格: 扁平化科普图或治愈系插画");
  lines.push("  4. 情感基调: 专业但友好");
  lines.push("");

  lines.push("输出格式:");
  lines.push("请输出 JSON 数组,每个元素包含:");
  lines.push("  - paragraph_index: 对应段落序号");
  lines.push("  - paragraph_summary: 段落摘要");
  lines.push("  - prompt: 英文图片提示词");
  lines.push("  - style: 风格描述");
  lines.push("  - mood: 情感基调");
  lines.push("");
  lines.push("示例:");
  lines.push(`[
  {
    "paragraph_index": 1,
    "paragraph_summary": "AI Agent 概念介绍",
    "prompt": "A futuristic illustration showing AI agents as helpful digital assistants, clean flat design, blue and white color scheme, modern tech aesthetic",
    "style": "扁平化科普图",
    "mood": "专业、友好"
  }
]`);

  return lines.join("\n");
}

/**
 * System Message
 */
const PROMPT_SYSTEM_MESSAGE = `你是一个专业的配图设计师,擅长为文章创作配图提示词。

你的核心能力:
- 理解文章核心内容
- 选择合适的视觉元素
- 使用英文描述场景
- 平衡美观和信息传达

提示词创作原则:
1. 主体明确: 画面要表达什么?
2. 环境清晰: 背景和场景
3. 风格统一: 与其他配图协调
4. 色彩和谐: 符合情感基调

常用风格:
- 扁平化科普图: 简洁、清晰、信息性强
- 治愈系插画: 温暖、友好、感性
- 等距视角: 现代、专业、科技感

提示词结构:
[主体描述] + [环境/背景] + [风格描述] + [色彩/光影] + [技术/质量]

示例:
"A cute robot assistant helping a human work, flat illustration style, soft blue and orange colors, minimal background, high quality"`;

/**
 * 解析 LLM 输出的提示词
 */
function parsePrompts(text: string): ImagePrompt[] {
  const prompts: ImagePrompt[] = [];

  try {
    // 尝试解析 JSON 数组
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);

      for (const item of parsed) {
        if (item.prompt) {
          prompts.push({
            paragraph_index: item.paragraph_index || 0,
            paragraph_summary: item.paragraph_summary || "",
            prompt: item.prompt,
            style: item.style || "扁平化科普图",
            mood: item.mood || "专业"
          });
        }
      }
    }
  } catch (error) {
    console.error(`[10_prompts] Failed to parse prompts: ${error}`);
  }

  return prompts;
}

/**
 * 生成降级提示词
 */
function generateFallbackPrompts(count: number): string[] {
  const templates = [
    "Professional flat illustration explaining a technical concept, clean design, blue and white colors, modern aesthetic, high quality",
    "Friendly robot assistant helping user work, flat illustration style, soft colors, minimal background, cute and approachable",
    "Data visualization chart with clean design, professional look, blue accent colors, modern tech style, high quality",
    "Collaboration scene with people and technology, flat illustration, harmonious colors, positive atmosphere, professional quality",
    "Future cityscape with digital elements, clean sci-fi style, blue and purple tones, modern aesthetic, high quality"
  ];

  return templates.slice(0, count);
}

/**
 * 提取文章摘要
 */
function extractSummary(article: string): string {
  // 简化版: 取前 500 字作为摘要
  const cleaned = article
    .replace(/[#*`\[\]]/g, "")
    .replace(/\n+/g, " ")
    .trim();

  return cleaned.length > 500
    ? cleaned.substring(0, 500) + "..."
    : cleaned;
}
