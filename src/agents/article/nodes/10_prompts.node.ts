/**
 * Image Prompts 节点
 *
 * 职责: 基于初稿文章生成图片提示词
 *
 * 数据流:
 * draft + imageConfig → LLM 生成提示词 → imagePrompts[]
 *
 * 设计原则:
 * - 每个核心段落生成一个提示词
 * - 根据选定风格使用对应的 Style Prefix
 * - 统一使用 16:9 比例（公众号）
 * - 使用英文提示词
 * - 基于 draft（与 humanize 并行，不依赖 humanized）
 */

import { ArticleState, ImageStyle } from "../state";
import { callLLMWithFallback } from "../../../utils/llm-runner.js";
import { outputCoordinator } from "../../../utils/llm-client.js";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env") });

/**
 * 风格 Prefix 映射
 *
 * 参考 image-prompter 技能的五风格定义
 * 统一使用 16:9 横屏比例
 */
const STYLE_PREFIXES: Record<ImageStyle, string> = {
  infographic: `Create a clean 16:9 horizontal infographic. Flat vector style, white background, simple thin-outline icons, single bright accent color. Minimal text: a large Chinese title + 3-4 ultra-short labels max. No gradients, no heavy shadows.`,

  healing: `Warm pastel color, soft light, cozy healing illustration, clean lineart, gentle shading. Clean 16:9 horizontal layout.`,

  pixar: `Pixar style, sharpie illustration, bold lines and solid colors, simple details, minimalist, 3D cartoon style, vibrant colors. Cartoon, energetic, concise, childlike wonder. Clean 16:9 horizontal layout.`,

  sokamono: `Cartoon illustration, minimalist, simple and vivid lines, calm healing atmosphere, clean and fresh color, light blue background, style by sokamono. Clean 16:9 horizontal layout.`,

  handdrawn: `Hand-drawn illustration on cream-colored paper with visible texture. Colored pencil line art with visible strokes, light watercolor shading with gentle smudging. Warm atmosphere, light doodles, playful but clean. High readability. 16:9 horizontal layout. Colors are for decorative highlights only.`
};

/**
 * 风格名称映射（中文）
 */
const STYLE_NAMES: Record<ImageStyle, string> = {
  infographic: "扁平化科普图",
  healing: "治愈系插画",
  pixar: "粗线条插画",
  sokamono: "描边插画",
  handdrawn: "彩铅水彩手绘"
};

/**
 * 图片提示词
 */
export interface ImagePrompt {
  paragraph_index: number;
  paragraph_summary: string;
  prompt: string;        // 英文提示词
  style: string;        // 风格描述
  mood: string;         // 情感基调
  composition?: string; // 构图类型
}

/**
 * Image Prompts 节点主函数
 *
 * @param state - 当前状态
 * @returns 更新的状态
 */
export async function promptsNode(state: ArticleState): Promise<Partial<ArticleState>> {
  console.log("[10_prompts] Generating image prompts...");

  if (!state.draft) {
    console.error("[10_prompts] No draft article to generate prompts for");
    throw new Error("Draft article not found in state");
  }

  // 获取图片配置（需要 confirm 节点先完成）
  const imageConfig = state.decisions?.images;
  const count = imageConfig?.count || 4;
  const style: ImageStyle = imageConfig?.style || "infographic";

  console.log(`[10_prompts] Config: ${count} images, style: ${STYLE_NAMES[style]}`);

  // ========== 构建 Prompt ==========
  const prompt = buildPromptPrompt(state.draft, count, style);

  // ========== 调用 LLM ==========
  console.log("[10_prompts] Calling LLM...");

  try {
    const { response, config } = await callLLMWithFallback(
      {
        selectedModel: state.decisions?.selectedModel,
        selectedModels: state.decisions?.selectedModels
      },
      "10_prompts",
      { prompt, systemMessage: PROMPT_SYSTEM_MESSAGE }
    );

    // 延迟输出完成日志，等待并行节点完成
    outputCoordinator.defer(() => {
      console.log("[10_prompts] LLM model:", config.model);
      console.log("[10_prompts] Prompts generated");
    }, "10_prompts");

    // ========== 解析提示词 ==========
    // 添加原始响应日志（用于调试）
    outputCoordinator.defer(() => {
      console.log("[10_prompts] LLM raw response (first 500 chars):", response.text.substring(0, 500));
    }, "10_prompts");

    const prompts = parsePrompts(response.text);

    // 验证解析结果，如果没有解析到任何提示词，使用降级方案
    if (prompts.length === 0) {
      outputCoordinator.defer(() => {
        console.warn("[10_prompts] No prompts parsed from LLM response, using fallback");
      }, "10_prompts");
      const fallbackPrompts = generateFallbackPrompts(count, style);
      return { imagePrompts: fallbackPrompts };
    }

    const promptStrings = prompts.map(p => p.prompt);

    // 延迟输出结果，等待并行节点完成
    outputCoordinator.defer(() => {
      console.log(`[10_prompts] Generated ${promptStrings.length} prompts:`);
      prompts.forEach((p, i) => {
        console.log(`  ${i + 1}. ${p.paragraph_summary}`);
        console.log(`     ${p.prompt.substring(0, 80)}...`);
      });
    }, "10_prompts");

    return {
      imagePrompts: promptStrings
    };
  } catch (error) {
    outputCoordinator.defer(() => {
      console.error(`[10_prompts] Failed to generate prompts: ${error}`);
    }, "10_prompts");

    // 降级: 返回风格化通用提示词
    const fallbackPrompts = generateFallbackPrompts(count, style);
    outputCoordinator.defer(() => {
      console.log("[10_prompts] Using fallback prompts");
    }, "10_prompts");

    return {
      imagePrompts: fallbackPrompts
    };
  }
}

/**
 * 构建提示词生成 Prompt
 */
function buildPromptPrompt(article: string, count: number, style: ImageStyle): string {
  // 提取文章摘要
  const summary = extractSummary(article);

  const stylePrefix = STYLE_PREFIXES[style];
  const styleName = STYLE_NAMES[style];

  const lines: string[] = [];

  lines.push(`请为一篇文章生成 ${count} 个配图提示词。\n`);

  lines.push("文章内容摘要:");
  lines.push(summary);
  lines.push("");

  lines.push("配图要求:");
  lines.push(`  1. 数量: ${count} 张`);
  lines.push(`  2. 风格: ${styleName}`);
  lines.push(`  3. 比例: 16:9 横屏（公众号统一）`);
  lines.push("");

  lines.push("风格规范（必须严格遵守）:");
  lines.push(stylePrefix);
  lines.push("");

  lines.push("画面构图（必须多样化）:");
  lines.push("  - Split screen comparison (Left vs Right)");
  lines.push("  - Three-column layout (Step 1, 2, 3)");
  lines.push("  - Central focal point (Hero object)");
  lines.push("  - Isometric view (3D overview)");
  lines.push("  - Roadmap/Timeline path");
  lines.push("");

  lines.push("负面约束:");
  lines.push("  - no watermark, no logo, no random letters, no gibberish text");
  lines.push("  - avoid overcrowded layout, avoid messy typography");
  if (style === "handdrawn") {
    lines.push("  - colors are for decorative highlights only, do NOT generate text labels with colors");
    lines.push("  - avoid functional labels like 'correct', 'warning', 'success' as text");
  }
  lines.push("");

  lines.push("输出格式:");
  lines.push("请输出 JSON 数组,每个元素包含:");
  lines.push("  - paragraph_index: 对应段落序号");
  lines.push("  - paragraph_summary: 段落摘要");
  lines.push("  - prompt: 英文图片提示词（结构：[Composition] + [Visual Metaphor] + [Environment] + [Style Prefix] + [Negative Constraints]）");
  lines.push("  - style: 风格描述");
  lines.push("  - mood: 情感基调");
  lines.push("  - composition: 构图类型（如 Split screen, Central focal point 等）");
  lines.push("");

  lines.push("示例:");
  lines.push(`[
  {
    "paragraph_index": 1,
    "paragraph_summary": "AI Agent 概念介绍",
    "prompt": "Split screen comparison, left side shows a human struggling with messy papers, right side shows a smart robot organizing them neatly. ${stylePrefix.substring(0, 100)}...",
    "style": "${styleName}",
    "mood": "专业、友好",
    "composition": "Split screen comparison"
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
- 选择合适的视觉元素（善用隐喻）
- 使用英文描述场景
- 平衡美观和信息传达

提示词创作原则:
1. 视觉隐喻（关键）: 拒绝抽象概念，将概念转化为具体物体。
   - 错误：Business partnership (两个人握手)
   - 正确：Two gears interlocking perfectly, or A bridge connecting two cliffs
   - 错误：Data network (抽象的线)
   - 正确：A busy city map with glowing traffic lines
2. 构图多样: 不要每张图都是中间放个东西。使用左右对比、三段式、透视等。
3. 风格统一: 严格遵守给定的 Style Prefix。
4. 色彩和谐: 符合情感基调。
5. 负面约束: 严禁生成乱码文字。

提示词结构:
[Composition] + [Visual Metaphor/Subject] + [Environment] + [Style Prefix] + [Negative Constraints]

颜色使用规范（重要）:
- 颜色描述仅用于视觉装饰和高亮
- 禁止在提示词中描述带颜色的功能性标签文字
- 例如：不要写 "green checkmark" 或 "red warning label"
- 应该写： "green decorative arrow", "red accent line"
- 对于 handdrawn 风格尤其注意：颜色用于装饰元素，不是文字标签

重要:
- 必须在提示词中包含完整的风格规范
- 风格规范会在用户提示中提供
- 确保提示词可直接用于图像生成模型`;

/**
 * 解析 LLM 输出的提示词
 *
 * 解析策略（按优先级）：
 * 1. 标准 JSON 数组：[{"prompt": "..."}, ...]
 * 2. Markdown 代码块中的 JSON：```json [...] ```
 * 3. 带引号的 JSON 数组："[...]" (需去除引号)
 * 4. 对象数组（非标准格式）
 */
function parsePrompts(text: string): ImagePrompt[] {
  const prompts: ImagePrompt[] = [];

  try {
    // 策略 1: 尝试解析标准 JSON 数组
    let jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed) && parsed.length > 0) {
          for (const item of parsed) {
            if (item.prompt) {
              prompts.push({
                paragraph_index: item.paragraph_index || 0,
                paragraph_summary: item.paragraph_summary || "",
                prompt: item.prompt,
                style: item.style || "扁平化科普图",
                mood: item.mood || "专业",
                composition: item.composition || ""
              });
            }
          }
          if (prompts.length > 0) return prompts;
        }
      } catch {
        // 继续尝试其他策略
      }
    }

    // 策略 2: 尝试从 Markdown 代码块中提取 JSON
    const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (codeBlockMatch) {
      try {
        const parsed = JSON.parse(codeBlockMatch[1]);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (item.prompt) {
              prompts.push({
                paragraph_index: item.paragraph_index || 0,
                paragraph_summary: item.paragraph_summary || "",
                prompt: item.prompt,
                style: item.style || "扁平化科普图",
                mood: item.mood || "专业",
                composition: item.composition || ""
              });
            }
          }
          if (prompts.length > 0) return prompts;
        }
      } catch {
        // 继续尝试其他策略
      }
    }

    // 策略 3: 尝试解析带引号的 JSON 数组（某些 LLM 可能返回带引号的字符串）
    const quotedMatch = text.match(/"(\[[\s\S]*\])"/);
    if (quotedMatch) {
      try {
        const parsed = JSON.parse(quotedMatch[1]);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (item.prompt) {
              prompts.push({
                paragraph_index: item.paragraph_index || 0,
                paragraph_summary: item.paragraph_summary || "",
                prompt: item.prompt,
                style: item.style || "扁平化科普图",
                mood: item.mood || "专业",
                composition: item.composition || ""
              });
            }
          }
          if (prompts.length > 0) return prompts;
        }
      } catch {
        // 继续尝试其他策略
      }
    }

    // 策略 4: 尝试提取所有类 JSON 对象（非标准格式容错）
    const objectMatches = text.match(/\{[^{}]*"prompt"[^{}]*\}/g);
    if (objectMatches) {
      for (const objStr of objectMatches) {
        try {
          const item = JSON.parse(objStr);
          if (item.prompt) {
            prompts.push({
              paragraph_index: item.paragraph_index || 0,
              paragraph_summary: item.paragraph_summary || "",
              prompt: item.prompt,
              style: item.style || "扁平化科普图",
              mood: item.mood || "专业",
              composition: item.composition || ""
            });
          }
        } catch {
          // 忽略单个对象解析失败
        }
      }
      if (prompts.length > 0) return prompts;
    }

    if (prompts.length === 0) {
      console.warn("[10_prompts] All parsing strategies failed, response format may be invalid");
    }
  } catch (error) {
    console.error(`[10_prompts] Failed to parse prompts: ${error}`);
  }

  return prompts;
}

/**
 * 生成风格化降级提示词
 */
function generateFallbackPrompts(count: number, style: ImageStyle): string[] {
  const stylePrefix = STYLE_PREFIXES[style];

  // 通用负面约束
  const negativeConstraints = "no watermark, no logo, no random letters, no gibberish text, avoid overcrowded layout";

  const templatesMap: Record<ImageStyle, string[]> = {
    infographic: [
      `Professional concept explanation, clean infographic design, icons and arrows, blue and white colors, ${stylePrefix}, ${negativeConstraints}`,
      `Step-by-step process visualization, flat vector style, numbered steps, clean layout, ${stylePrefix}, ${negativeConstraints}`,
      `Comparison diagram showing before/after, simple icons, clear contrast, ${stylePrefix}, ${negativeConstraints}`,
      `Data visualization chart with clean design, professional look, blue accent colors, ${stylePrefix}, ${negativeConstraints}`,
      `Technical concept explanation, simple icons and labels, minimal background, ${stylePrefix}, ${negativeConstraints}`
    ],
    healing: [
      `Cozy indoor scene with warm light, peaceful atmosphere, ${stylePrefix}, ${negativeConstraints}`,
      `Person reading by window with plants, warm afternoon light, ${stylePrefix}, ${negativeConstraints}`,
      `Comfortable workspace with soft colors, gentle lighting, ${stylePrefix}, ${negativeConstraints}`,
      `Morning coffee scene with peaceful mood, soft pastel tones, ${stylePrefix}, ${negativeConstraints}`,
      `Relaxing moment in daily life, warm and healing atmosphere, ${stylePrefix}, ${negativeConstraints}`
    ],
    pixar: [
      `Friendly robot assistant helping human work, energetic scene, ${stylePrefix}, ${negativeConstraints}`,
      `Cute characters collaborating on project, vibrant colors, ${stylePrefix}, ${negativeConstraints}`,
      `Playful learning scene with cartoon characters, joyful mood, ${stylePrefix}, ${negativeConstraints}`,
      `Adventure scene with cute protagonists, dynamic composition, ${stylePrefix}, ${negativeConstraints}`,
      `Teamwork scene with animated characters, positive energy, ${stylePrefix}, ${negativeConstraints}`
    ],
    sokamono: [
      `Peaceful scene with simple lines, calming atmosphere, ${stylePrefix}, ${negativeConstraints}`,
      `Minimalist illustration of daily life, clean and fresh, ${stylePrefix}, ${negativeConstraints}`,
      `Quiet moment with simple composition, healing mood, ${stylePrefix}, ${negativeConstraints}`,
      `Gentle scene with soft colors, clean lines, ${stylePrefix}, ${negativeConstraints}`,
      `Serene landscape with minimalist style, calming effect, ${stylePrefix}, ${negativeConstraints}`
    ],
    handdrawn: [
      `Hand-drawn concept explanation with arrows and highlights, ${stylePrefix}, ${negativeConstraints}`,
      `Notebook-style learning notes with doodles and underlines, ${stylePrefix}, ${negativeConstraints}`,
      `Sketch-style diagram with hand-drawn elements, markers, ${stylePrefix}, ${negativeConstraints}`,
      `Handwritten notes with colorful highlights and stars, ${stylePrefix}, ${negativeConstraints}`,
      `Grid paper style concept map with hand-drawn connections, ${stylePrefix}, ${negativeConstraints}`
    ]
  };

  const templates = templatesMap[style] || templatesMap.infographic;
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

/**
 * 节点信息（用于文档和调试）
 */
export const promptsNodeInfo = {
  name: "prompts",
  type: "llm" as const,
  description: "基于初稿文章和选定风格生成图片提示词",
  reads: ["draft", "decisions.images"],
  writes: ["imagePrompts"]
};
