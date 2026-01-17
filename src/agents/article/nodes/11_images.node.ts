/**
 * Images 节点 v2 - 并行图片生成
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
import { httpPost } from "../../../adapters/mcp.js";
import { createLogger } from "../../../utils/logger.js";
import { retry } from "../../../utils/errors.js";

const log = createLogger("11_images");

/**
 * Ark API 配置
 */
interface ArkConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

/**
 * 图片生成请求
 */
interface ImageGenerationRequest {
  prompt: string;
  model?: string;
  size?: string;
  quality?: string;
  style?: string;
}

/**
 * 图片生成响应
 */
interface ImageGenerationResponse {
  success: boolean;
  data?: {
    image_url?: string;
    image_base64?: string;
  };
  error?: string;
}

/**
 * 并发控制 - 并行执行多个异步任务
 */
async function parallelMap<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  const executing: Promise<void>[] = [];

  for (let i = 0; i < items.length; i++) {
    const promise = fn(items[i], i).then(result => {
      results[i] = result;
    });

    executing.push(promise);

    if (executing.length >= concurrency) {
      await Promise.race(executing);
      executing.splice(
        executing.findIndex(p => p === promise),
        1
      );
    }
  }

  await Promise.all(executing);
  return results;
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

  // 确定尺寸
  const size = imageConfig?.orientation === "portrait"
    ? "768:1024"  // 3:4
    : "1024:768"; // 16:9

  log.info("Config:", { model: config.model, size });
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
    async (prompt, index) => {
      const filename = `image_${String(index + 1).padStart(2, "0")}.png`;
      const filepath = join(imagesDir, filename);

      try {
        // 使用重试机制生成图片
        const imageData = await retry(
          () => generateImage(prompt, config, size),
          { maxAttempts: 2, delay: 500 }
        )();

        // 保存图片
        if (imageData.image_base64) {
          const buffer = Buffer.from(imageData.image_base64, "base64");
          writeFileSync(filepath, buffer);
          progress.increment(`image_${index + 1}`);
          return { index, path: filepath };
        } else if (imageData.image_url) {
          log.warn(`Image ${index + 1} returned URL (not implemented)`);
          return { index, path: imageData.image_url };
        }
      } catch (error) {
        log.error(`Failed to generate image ${index + 1}:`, error);
        return { index, error: String(error) };
      }
    },
    3 // 并发限制
  );

  progress.complete();

  // ========== 整理结果 ==========
  const imagePaths: string[] = [];
  const errors: string[] = [];

  for (const result of results) {
    if (result.path) {
      imagePaths[result.index] = result.path;
    } else if (result.error) {
      errors.push(`Image ${result.index + 1}: ${result.error}`);
    }
  }

  log.completeStep("generate_images", {
    success: imagePaths.filter(Boolean).length,
    failed: errors.length
  });

  if (errors.length > 0) {
    log.warn("Some images failed:", errors);
  }

  log.success(`Complete in ${timer.log()}`);

  return {
    imagePaths: imagePaths.filter(Boolean)
  };
}

/**
 * 生成单张图片
 */
async function generateImage(
  prompt: string,
  config: ArkConfig,
  size: string
): Promise<{ image_url?: string; image_base64?: string }> {
  const request: ImageGenerationRequest = {
    prompt,
    model: config.model,
    size
  };

  const response = await httpPost<ImageGenerationResponse>(
    `${config.baseUrl}/images/generations`,
    request,
    {
      "Authorization": `Bearer ${config.apiKey}`,
      "Content-Type": "application/json"
    }
  );

  if (!response.success || !response.data) {
    throw new Error(response.error || "Failed to generate image");
  }

  return response.data;
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
    baseUrl: process.env.ARK_BASE_URL || "https://ark.cn-beijing.volces.com/api/v3",
    model: process.env.ARK_MODEL || "doubao-v1"
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
