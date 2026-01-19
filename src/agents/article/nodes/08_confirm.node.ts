/**
 * Gate B: 确认图片配置
 *
 * 触发时机: 图片提示词生成前执行
 * 功能: 让用户配置图片生成参数（风格、数量）
 *
 * 交互 UI:
 * ```
 * === 图片风格推荐 ===
 * 基于文章内容分析，推荐使用: [扁平化科普图]
 *
 * 理由: 文章包含"解释"、"原理"等科普关键词
 *
 * ? 请选择图片风格:
 *   1. 扁平化科普图 (推荐) - Flat vector style, white background
 *   2. 治愈系插画 - Warm pastel color, soft light
 *   3. 粗线条插画 - Pixar style, bold lines
 *   4. 描边插画 - Minimalist, clean lines
 *   5. 方格纸手绘 - Hand-drawn notebook style
 *
 * ? 生成数量: 4
 *
 * === 配置确认 ===
 * 风格: 扁平化科普图
 * 数量: 4 张
 * 模型: doubao-seedream-4-5-251128
 * 分辨率: 2k
 *
 * ? 确认以上配置? (Y/n)
 * ```
 *
 * 存储位置: state.decisions.images
 */

import { ArticleState, ImageConfig, ImageStyle } from "../state";

/**
 * 交互提示函数类型
 *
 * 允许外部注入自定义交互逻辑
 * 使用 any 类型以避免 inquirer 复杂的泛型约束
 */
export type InteractivePrompt = <T = unknown>(
  questions: unknown
) => Promise<T>;

/**
 * 默认交互提示函数
 *
 * 使用真实的 inquirer 模块
 */
let promptFn: InteractivePrompt | null = null;

export function setPromptFn(fn: InteractivePrompt | null) {
  promptFn = fn;
}

async function getPromptFn(): Promise<InteractivePrompt> {
  if (!promptFn) {
    // 动态导入 inquirer
    const inquirerModule = await import("inquirer");
    promptFn = inquirerModule.default.prompt as InteractivePrompt;
  }
  return promptFn;
}

/**
 * 风格关键词映射
 */
const STYLE_KEYWORDS: Record<ImageStyle, string[]> = {
  infographic: ["解释", "原理", "是什么", "如何", "步骤", "科普", "说明"],
  healing: ["故事", "情绪", "场景", "温暖", "治愈", "叙事", "氛围"],
  pixar: ["卡通", "可爱", "童趣", "活力", "鲜艳", "3d", "动画"],
  sokamono: ["清新", "简洁", "文艺", "淡雅", "描边", "治愈", "清新"],
  handdrawn: ["笔记", "手绘", "草图", "学习", "手写", "方格", "马克笔"]
};

/**
 * 风格名称映射（中文）
 */
const STYLE_NAMES: Record<ImageStyle, string> = {
  infographic: "扁平化科普图",
  healing: "治愈系插画",
  pixar: "粗线条插画",
  sokamono: "描边插画",
  handdrawn: "方格纸手绘"
};

/**
 * 风格描述映射
 */
const STYLE_DESCRIPTIONS: Record<ImageStyle, string> = {
  infographic: "Flat vector style, white background, simple thin-outline icons",
  healing: "Warm pastel color, soft light, cozy healing illustration",
  pixar: "Pixar style, sharpie illustration, bold lines and solid colors",
  sokamono: "Cartoon illustration, minimalist, simple and vivid lines",
  handdrawn: "Hand-drawn notebook style on grid paper, marker pen"
};

/**
 * 智能推荐图片数量
 *
 * 基于以下因素:
 * 1. 文章长度
 * 2. 核心观点数量（从 Brief 中提取）
 * 3. 标题复杂度
 */
function recommendImageCount(state: ArticleState): number {
  const content = state.humanized || state.rewritten || state.draft || "";
  const brief = state.researchResult || "";

  // 因素1: 文章长度
  const wordCount = content.length;
  let baseCount = 4; // 默认4张

  if (wordCount < 1000) {
    baseCount = 2;
  } else if (wordCount < 2000) {
    baseCount = 3;
  } else if (wordCount < 3000) {
    baseCount = 4;
  } else if (wordCount < 5000) {
    baseCount = 5;
  } else {
    baseCount = 6;
  }

  // 因素2: 核心观点数量（从 Brief 中提取）
  const keyInsightsMatch = brief.match(/## 核心洞察\s*\n([\s\S]*?)(?=##|$)/i);
  if (keyInsightsMatch) {
    const insightsText = keyInsightsMatch[1];
    const insightsCount = (insightsText.match(/^\d+\./gm) || []).length;
    if (insightsCount > 0) {
      // 每个核心观点配1张图，但限制在2-8张之间
      baseCount = Math.max(2, Math.min(8, insightsCount));
    }
  }

  // 因素3: 标题复杂度
  const selectedTitle = state.decisions?.selectedTitle || "";
  if (selectedTitle.includes("||")) {
    // 有副标题，内容可能更丰富，增加1张
    baseCount = Math.min(8, baseCount + 1);
  }

  return baseCount;
}

/**
 * 智能推荐风格
 *
 * 基于文章内容关键词分析
 */
function recommendStyle(content: string): ImageStyle {
  const scores: Record<ImageStyle, number> = {
    infographic: 0,
    healing: 0,
    pixar: 0,
    sokamono: 0,
    handdrawn: 0
  };

  // 统计每种风格的关键词出现次数
  for (const [style, keywords] of Object.entries(STYLE_KEYWORDS)) {
    for (const keyword of keywords) {
      const regex = new RegExp(keyword, "gi");
      const matches = content.match(regex);
      if (matches) {
        scores[style as ImageStyle] += matches.length;
      }
    }
  }

  // 返回得分最高的风格
  let maxScore = 0;
  let recommendedStyle: ImageStyle = "infographic";

  for (const [style, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      recommendedStyle = style as ImageStyle;
    }
  }

  return recommendedStyle;
}

/**
 * 智能解析图片配置
 *
 * 支持的输入格式:
 * - "4张"
 * - "扁平化，4张"
 * - "healing 4"
 * - "科普图，3张"
 *
 * @param input - 用户输入
 * @param recommendedStyle - 推荐的风格
 * @param recommendedCount - 推荐的数量（降级时使用）
 */
function parseImageConfig(input: string, recommendedStyle: ImageStyle, recommendedCount: number): ImageConfig {
  const config: ImageConfig = {
    confirmed: false,
    count: 4,
    style: recommendedStyle,
    model: "doubao-seedream-4-5-251128",
    resolution: "2k"
  };

  const text = input.toLowerCase();

  // 解析风格（简写或中文）
  const styleAliases: Record<string, ImageStyle> = {
    "扁平": "infographic",
    "科普": "infographic",
    "infographic": "infographic",
    "治愈": "healing",
    "healing": "healing",
    "粗线": "pixar",
    "pixar": "pixar",
    "描边": "sokamono",
    "sokamono": "sokamono",
    "手绘": "handdrawn",
    "方格": "handdrawn",
    "handdrawn": "handdrawn"
  };

  for (const [alias, style] of Object.entries(styleAliases)) {
    if (text.includes(alias)) {
      config.style = style;
      break;
    }
  }

  // 解析数量（支持纯数字或"3张"格式）
  const countMatch = text.match(/(\d+)/);
  if (countMatch) {
    config.count = parseInt(countMatch[1], 10);
  } else {
    // 降级到推荐值
    config.count = recommendedCount;
  }

  return config;
}

/**
 * 确认图片配置节点
 *
 * 决策流程:
 * 1. 检查是否已确认 (state.decisions.images?.confirmed)
 * 2. 分析内容，推荐风格
 * 3. 弹出风格选择输入框
 * 4. 弹出数量输入框
 * 5. 显示确认信息
 * 6. 二次确认
 * 7. 保存决策到 state.decisions.images
 */
export async function confirmImagesNode(
  state: ArticleState
): Promise<Partial<ArticleState>> {
  return confirmImagesNodeWithTiming(state, 0);
}

async function confirmImagesNodeWithTiming(
  state: ArticleState,
  accumulatedWaitMs: number
): Promise<Partial<ArticleState>> {
  const existingConfig = state.decisions?.images;
  const timingKey = "07_confirm";
  let promptWaitMs = accumulatedWaitMs;

  // 已确认，跳过
  if (existingConfig?.confirmed) {
    console.log(`[confirm_images] 使用已确认的配置:`);
    console.log(`  风格: ${STYLE_NAMES[existingConfig.style]}`);
    console.log(`  数量: ${existingConfig.count} 张`);
    return {};
  }

  console.log("\n=== Gate B: 确认图片配置 ===\n");

  // ========== 步骤1: 分析内容，智能推荐 ==========
  const content = state.humanized || state.rewritten || state.draft || "";
  const recommendedStyle = recommendStyle(content);
  const recommendedCount = recommendImageCount(state);

  console.log("=== 图片配置推荐 ===");
  console.log(`基于文章分析 (${content.length} 字)`);
  console.log(`推荐风格: [${STYLE_NAMES[recommendedStyle]}]`);
  console.log(`推荐数量: [${recommendedCount} 张]`);
  console.log(`\n风格描述: ${STYLE_DESCRIPTIONS[recommendedStyle]}`);
  console.log("");

  // ========== 步骤2: 风格选择 ==========
  const prompt = await getPromptFn();

  const styleStart = Date.now();
  const { styleInput } = await prompt<{ styleInput: string }>([
    {
      type: "list",
      name: "styleInput",
      message: "请选择图片风格:",
      default: recommendedStyle,
      choices: [
        { name: `1. 扁平化科普图 (推荐) - Flat vector style, white background`, value: "infographic" },
        { name: `2. 治愈系插画 - Warm pastel color, soft light`, value: "healing" },
        { name: `3. 粗线条插画 - Pixar style, bold lines`, value: "pixar" },
        { name: `4. 描边插画 - Minimalist, clean lines`, value: "sokamono" },
        { name: `5. 方格纸手绘 - Hand-drawn notebook style`, value: "handdrawn" }
      ]
    }
  ]);
  promptWaitMs += Date.now() - styleStart;

  const selectedStyle = styleInput as ImageStyle;

  // ========== 步骤3: 数量输入（支持简写） ==========
  const countStart = Date.now();
  const { countInput } = await prompt<{ countInput: string }>([
    {
      type: "input",
      name: "countInput",
      message: "请输入生成数量（支持简写如 \"4张\"，或直接回车使用推荐值）:",
      default: `${recommendedCount}张`,
      validate: (input: string) => {
        const match = input.match(/(\d+)/);
        if (!match) {
          return "请输入有效的数字";
        }
        const count = parseInt(match[1], 10);
        if (count < 1 || count > 20) {
          return "数量必须在 1-20 之间";
        }
        return true;
      }
    }
  ]);
  promptWaitMs += Date.now() - countStart;

  // ========== 步骤4: 解析配置 ==========
  const config = parseImageConfig(countInput, selectedStyle, recommendedCount);

  console.log("\n=== 配置确认 ===");
  console.log(`风格: ${STYLE_NAMES[config.style]}`);
  console.log(`描述: ${STYLE_DESCRIPTIONS[config.style]}`);
  console.log(`数量: ${config.count} 张`);
  console.log(`模型: ${config.model}`);
  console.log(`分辨率: ${config.resolution}`);
  console.log(`比例: 16:9 (公众号统一横屏)\n`);

  // ========== 步骤5: 二次确认 ==========
  const confirmStart = Date.now();
  const { confirmed } = await prompt<{ confirmed: boolean }>([
    {
      type: "confirm",
      name: "confirmed",
      message: "确认以上配置?",
      default: true
    }
  ]);
  promptWaitMs += Date.now() - confirmStart;

  if (!confirmed) {
    // 重新输入
    console.log("\n请重新配置...\n");
    return confirmImagesNodeWithTiming(state, promptWaitMs);
  }

  console.log(`[confirm_images] 配置已保存\n`);

  return {
    decisions: {
      ...state.decisions,
      timings: {
        ...state.decisions?.timings,
        [timingKey]: promptWaitMs
      },
      images: { ...config, confirmed: true }
    }
  };
}

/**
 * 节点信息（用于文档和调试）
 */
export const confirmImagesNodeInfo = {
  name: "confirm_images",
  type: "interactive" as const,
  gate: "B",
  description: "确认图片生成配置（风格、数量）",
  writes: ["decisions.images"]
};
