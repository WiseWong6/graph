/**
 * Gate B: 确认图片配置
 *
 * 触发时机: 图片提示词生成前执行
 * 功能: 让用户配置图片生成参数（方向、数量、比例等）
 *
 * 交互 UI:
 * ```
 * ? 请配置图片生成参数（支持简写 "横屏，4张"）:
 *
 * ? 图片方向:
 *   1. 横屏 (16:9)
 *   2. 竖屏 (3:4)
 *
 * ? 生成数量: 4
 *
 * ? 封面图比例（回车使用默认 16:9）:
 * ? 正文图比例（回车使用默认 16:9）:
 *
 * === 配置确认 ===
 * 方向: 横屏
 * 数量: 4 张
 * 封面比例: 16:9
 * 正文比例: 16:9
 * 模型: doubao-seedream-4-5-251128
 * 分辨率: 2k
 *
 * ? 确认以上配置? (Y/n)
 * ```
 *
 * 存储位置: state.decisions.images
 */

import { ArticleState, ImageConfig } from "../state";

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
 * 智能解析图片配置
 *
 * 支持的输入格式:
 * - "横屏，4张"
 * - "横屏，4张，封面16:9，正文3:4"
 * - "竖屏 3张"
 * - "landscape 4"
 *
 * @param input - 用户输入
 */
function parseImageConfig(input: string): ImageConfig {
  const config: ImageConfig = {
    confirmed: false,
    count: 4,
    orientation: "landscape",
    poster_ratio: "16:9",
    cover_ratio: "16:9",
    model: "doubao-seedream-4-5-251128",
    resolution: "2k"
  };

  const text = input.toLowerCase();

  // 解析方向
  if (text.includes("横屏") || text.includes("landscape")) {
    config.orientation = "landscape";
    config.poster_ratio = "16:9";
  } else if (text.includes("竖屏") || text.includes("portrait")) {
    config.orientation = "portrait";
    config.poster_ratio = "3:4";
  }

  // 解析数量
  const countMatch = text.match(/(\d+)\s*[张张]/);
  if (countMatch) {
    config.count = parseInt(countMatch[1], 10);
  }

  // 解析封面比例
  const coverMatch = input.match(/(?:封面|cover)[：:\s]*([\d:x]+)/i);
  if (coverMatch) {
    config.cover_ratio = coverMatch[1];
  }

  // 解析正文比例
  const posterMatch = input.match(/(?:正文|poster|content)[：:\s]*([\d:x]+)/i);
  if (posterMatch) {
    config.poster_ratio = posterMatch[1];
  }

  return config;
}

/**
 * 确认图片配置节点
 *
 * 决策流程:
 * 1. 检查是否已确认 (state.decisions.images?.confirmed)
 * 2. 弹出输入框，支持简写格式
 * 3. 解析输入并显示确认信息
 * 4. 二次确认
 * 5. 保存决策到 state.decisions.images
 */
export async function confirmImagesNode(
  state: ArticleState
): Promise<Partial<ArticleState>> {
  const existingConfig = state.decisions?.images;

  // 已确认，跳过
  if (existingConfig?.confirmed) {
    console.log(`[confirm_images] 使用已确认的配置:`);
    console.log(`  方向: ${existingConfig.orientation === "landscape" ? "横屏" : "竖屏"}`);
    console.log(`  数量: ${existingConfig.count} 张`);
    return {};
  }

  console.log("\n=== Gate B: 确认图片配置 ===\n");

  const prompt = await getPromptFn();

  // 第一步：输入（支持简写）
  const { input } = await prompt<{ input: string }>([
    {
      type: "input",
      name: "input",
      message: "请配置图片（支持简写如 \"横屏，4张\"）:",
      default: "横屏，4张"
    }
  ]);

  // 第二步：解析
  const config = parseImageConfig(input);

  console.log("\n解析结果:");
  console.log(`  方向: ${config.orientation === "landscape" ? "横屏" : "竖屏"}`);
  console.log(`  数量: ${config.count} 张`);
  console.log(`  封面比例: ${config.cover_ratio}`);
  console.log(`  正文比例: ${config.poster_ratio}`);
  console.log(`  模型: ${config.model}`);
  console.log(`  分辨率: ${config.resolution}\n`);

  // 第三步：二次确认
  const { confirmed } = await prompt<{ confirmed: boolean }>([
    {
      type: "confirm",
      name: "confirmed",
      message: "确认以上配置?",
      default: true
    }
  ]);

  if (!confirmed) {
    // 重新输入
    console.log("\n请重新配置...\n");
    return confirmImagesNode(state);
  }

  console.log(`[confirm_images] 配置已保存\n`);

  return {
    decisions: {
      ...state.decisions,
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
  description: "确认图片生成配置（方向、数量、比例等）",
  writes: ["decisions.images"]
};
