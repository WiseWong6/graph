/**
 * Images 节点 v3 - 使用 OpenAI SDK 调用火山 Ark API
 *
 * 职责: 调用火山 Ark API 生成本地图片
 *
 * 数据流:
 * imagePrompts + imageConfig → Ark API → imagePaths[]
 *
 * 设计原则:
 * - 支持并行生成（并发限制）
 * - 保存到本地
 * - 错误重试和降级
 * - 进度跟踪
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { ArticleState } from "../state";
import OpenAI from "openai";
import { createLogger } from "../../../utils/logger.js";
import { retry } from "../../../utils/errors.js";
import { parallelMap } from "../../../utils/concurrency.js";
import { outputCoordinator } from "../../../utils/llm-output.js";
import { displayImageInTerminal } from "../../../utils/terminal-image.js";

const log = createLogger("10_images");

/**
 * Ark API 配置
 */
interface ArkConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

/**
 * 图片生成任务结果
 */
interface ImageResult {
  index: number;
  path?: string;
  error?: string;
}

/**
 * Images 节点主函数
 *
 * @param state - 当前状态
 * @returns 更新的状态
 */
export async function imagesNode(state: ArticleState): Promise<Partial<ArticleState>> {
  const timer = log.timer("images");
  log.startStep("validate_input");

  // ========== 验证输入 ==========
  if (!state.imagePrompts || state.imagePrompts.length === 0) {
    throw new Error("Image prompts not found in state");
  }

  log.completeStep("validate_input", { promptCount: state.imagePrompts.length });

  // ========== 获取配置 ==========
  log.startStep("setup_config");
  const config = getArkConfig();
  const imageConfig = state.decisions?.images;

  // 统一使用 2K 尺寸（16:9 横屏）
  const size = "2k";

  log.info("Config:", {
    model: config.model,
    size,
    count: state.imagePrompts.length,
    style: imageConfig?.style || "infographic"
  });
  log.completeStep("setup_config");

  // ========== 准备输出目录 ==========
  log.startStep("generate_images");
  const outputPath = state.outputPath || getDefaultOutputPath();
  const imagesDir = join(outputPath, "images");

  if (!existsSync(imagesDir)) {
    mkdirSync(imagesDir, { recursive: true });
  }

  // ========== 并行生成图片（并发限制 3） ==========
  const prompts = state.imagePrompts;
  const progress = log.progress(prompts.length, "generate");

  const results = await parallelMap(
    prompts,
    async (prompt, index): Promise<ImageResult> => {
      const filename = `image_${String(index + 1).padStart(2, "0")}.png`;
      const filepath = join(imagesDir, filename);

      try {
        // 使用重试机制生成图片
        const imageData = await retry(
          () => generateImage(prompt, config, size),
          { maxAttempts: 2, delay: 500 }
        )();

        // 保存图片（从 URL 下载）
        if (imageData.url) {
          const imgResponse = await fetch(imageData.url);
          const arrayBuffer = await imgResponse.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          writeFileSync(filepath, buffer);
          progress.increment(`image_${index + 1}`);
          return { index, path: filepath };
        } else {
          return { index, error: "No image data returned" };
        }
      } catch (error) {
        log.error(`Failed to generate image ${index + 1}:`, error);
        return { index, error: String(error) };
      }
    },
    parseInt(process.env.IMAGE_CONCURRENCY || "5")  // 并发限制（可配置）
  );

  progress.complete();

  // ========== 整理结果 ==========
  const imagePaths: string[] = [];
  const errors: string[] = [];

  outputCoordinator.defer(() => {
    console.log("[10_images] Processing results:", results.length);
  });

  for (const result of results) {
      if (!result) {
        outputCoordinator.defer(() => {
          console.log("[10_images] Skipping undefined result");
        });
        continue;
      }
      if (result.path) {
        imagePaths[result.index] = result.path;
        outputCoordinator.defer(() => {
          console.log(`[10_images] Image ${result.index}: ${result.path}`);
        });
      } else if (result.error) {
        errors.push(`Image ${result.index + 1}: ${result.error}`);
        outputCoordinator.defer(() => {
          console.log(`[10_images] Image ${result.index} failed: ${result.error}`);
        });
    }
    }

  // 过滤掉空洞（undefined 元素）
  const validPaths = imagePaths.filter(p => p !== undefined && p !== null && p !== "") as string[];
  outputCoordinator.defer(() => {
    console.log("[10_images] Valid paths:", validPaths.length);
    console.log("[10_images] Valid paths array:", validPaths);
  });

  log.completeStep("generate_images", {
    success: validPaths.length,
    failed: errors.length
  });

  if (errors.length > 0) {
    log.warn("Some images failed:", errors);
  }

  log.success(`Complete in ${timer.log()}`);

  for (let i = 0; i < validPaths.length; i++) {
    await displayImageInTerminal(validPaths[i], i);
  }

  // Debug: 确认返回值
  outputCoordinator.defer(() => {
    console.log("[10_images] ========== RETURNING ==========");
    console.log("[10_images] Returning imagePaths:", validPaths);
    console.log("[10_images] imagePaths.length:", validPaths.length);
    console.log("[10_images] imagePaths is array:", Array.isArray(validPaths));
    console.log("[10_images] imagePaths[0]:", validPaths[0]);
    console.log("[10_images] =================================");
  });

  // 确保返回值是一个非空数组
  if (!Array.isArray(validPaths) || validPaths.length === 0) {
    console.error("[10_images] ERROR: validPaths is not a valid array!");
    throw new Error("10_images node failed: no valid image paths");
  }

  return {
    imagePaths: validPaths
  };
}

/**
 * 生成单张图片（使用 OpenAI SDK）
 */
async function generateImage(
  prompt: string,
  config: ArkConfig,
  size: string
): Promise<{ url: string }> {
  const client = new OpenAI({
    baseURL: config.baseUrl + "/api/v3",
    apiKey: config.apiKey
  });

  const response = await client.images.generate({
    model: config.model,
    prompt,
    size: size as any,  // Ark 支持 "2k" 等自定义尺寸
    response_format: "url",
    watermark: false  // 关闭水印
  } as any);  // 使用 any 绕过类型检查，因为 Ark API 有额外参数

  if (!response.data || !response.data[0] || !response.data[0].url) {
    throw new Error("No image URL in response");
  }

  return {
    url: response.data[0].url
  };
}

/**
 * 获取 Ark 配置
 */
function getArkConfig(): ArkConfig {
  const apiKey = process.env.ARK_API_KEY || process.env.VOLCENGINE_API_KEY;
  if (!apiKey) {
    throw new Error("ARK_API_KEY or VOLCENGINE_API_KEY not set");
  }

  return {
    apiKey,
    baseUrl: process.env.ARK_BASE_URL || "https://ark.cn-beijing.volces.com",
    model: process.env.ARK_MODEL || "doubao-seedream-4-5-251128"
  };
}

/**
 * 获取默认输出路径
 */
function getDefaultOutputPath(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const runId = `article-${timestamp}`;
  return join(process.cwd(), "output", runId);
}
