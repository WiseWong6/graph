/**
 * Images 节点
 *
 * 职责: 调用火山 Ark API 生成本地图片
 *
 * 数据流:
 * imagePrompts + imageConfig → Ark API → imagePaths[]
 *
 * 设计原则:
 * - 支持并行生成
 * - 保存到本地
 * - 错误重试
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { ArticleState } from "../state";
import { httpPost } from "../../../adapters/mcp.js";

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
 * Images 节点主函数
 *
 * @param state - 当前状态
 * @returns 更新的状态
 */
export async function imagesNode(state: ArticleState): Promise<Partial<ArticleState>> {
  console.log("[11_images] Generating images...");

  if (!state.imagePrompts || state.imagePrompts.length === 0) {
    console.error("[11_images] No image prompts found");
    throw new Error("Image prompts not found in state");
  }

  // 获取配置
  const config = getArkConfig();
  const imageConfig = state.decisions?.images;

  // 确定尺寸
  const size = imageConfig?.orientation === "portrait"
    ? "768:1024"  // 3:4
    : "1024:768"; // 16:9

  console.log(`[11_images] Config: model=${config.model}, size=${size}`);

  // ========== 并行生成图片 ==========
  const outputPath = state.outputPath || getDefaultOutputPath();
  const imagesDir = join(outputPath, "images");

  if (!existsSync(imagesDir)) {
    mkdirSync(imagesDir, { recursive: true });
  }

  const imagePaths: string[] = [];
  const prompts = state.imagePrompts;

  console.log(`[11_images] Generating ${prompts.length} images...`);

  for (let i = 0; i < prompts.length; i++) {
    const prompt = prompts[i];
    console.log(`[11_images] Generating image ${i + 1}/${prompts.length}...`);

    try {
      const imageData = await generateImage(prompt, config, size);

      // 保存图片
      const filename = `image_${String(i + 1).padStart(2, "0")}.png`;
      const filepath = join(imagesDir, filename);

      if (imageData.image_base64) {
        // Base64 格式
        const buffer = Buffer.from(imageData.image_base64, "base64");
        writeFileSync(filepath, buffer);
        console.log(`[11_images] Saved: ${filepath}`);
        imagePaths.push(filepath);
      } else if (imageData.image_url) {
        // URL 格式 - 需要下载
        console.log(`[11_images] Image URL: ${imageData.image_url}`);
        // TODO: 实现下载逻辑
        imagePaths.push(imageData.image_url);
      }
    } catch (error) {
      console.error(`[11_images] Failed to generate image ${i + 1}: ${error}`);
      // 继续生成下一张
    }
  }

  console.log(`[11_images] Generated ${imagePaths.length} images successfully`);

  return {
    imagePaths
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
