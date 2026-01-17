/**
 * Upload Images 节点
 *
 * 职责: 上传本地图片到微信 CDN
 *
 * 数据流:
 * imagePaths + wechatConfig → 微信 API → uploadedImageUrls[]
 *
 * 设计原则:
 * - 批量上传
 * - 错误处理
 * - 返回 CDN URL
 */

import { readFileSync, existsSync } from "fs";
import { ArticleState } from "../state";
import { httpPost } from "../../../adapters/mcp.js";

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
 * 微信 API 配置
 */
interface WechatConfig {
  appId: string;
  appSecret: string;
  apiUrl: string;
}

/**
 * 上传响应
 */
interface UploadResponse {
  success: boolean;
  data?: {
    url: string;
    media_id: string;
  };
  error?: string;
}

/**
 * Upload Images 节点主函数
 *
 * @param state - 当前状态
 * @returns 更新的状态
 */
export async function uploadImagesNode(state: ArticleState): Promise<Partial<ArticleState>> {
  console.log("[10.5_upload] Uploading images to WeChat CDN...");

  if (!state.imagePaths || state.imagePaths.length === 0) {
    console.log("[10.5_upload] No images to upload");
    return {
      uploadedImageUrls: []
    };
  }

  // 获取微信配置
  const config = getWechatConfig();
  const account = state.decisions?.wechat?.account;

  console.log(`[10.5_upload] Account: ${account || "default"}`);
  console.log(`[10.5_upload] Uploading ${state.imagePaths.length} images...`);

  // ========== 并行上传 ==========
  const concurrency = parseInt(process.env.UPLOAD_CONCURRENCY || "5");

  console.log(`[10.5_upload] Starting parallel upload (concurrency: ${concurrency})...`);

  const uploadResults = await parallelMap(
    state.imagePaths,
    async (imagePath, index) => {
      console.log(`[10.5_upload] Uploading ${index + 1}/${state.imagePaths.length}: ${imagePath}`);

      try {
        // 读取图片
        if (!existsSync(imagePath)) {
          console.error(`[10.5_upload] File not found: ${imagePath}`);
          return { index, url: null as string | null };
        }

        const imageBuffer = readFileSync(imagePath);
        const base64 = imageBuffer.toString("base64");

        // 上传
        const result = await uploadImage(base64, config);

        // 避免频率限制
        await delay(300);

        return { index, url: result.url };
      } catch (error) {
        console.error(`[10.5_upload] Failed to upload ${imagePath}: ${error}`);
        return { index, url: null as string | null };
      }
    },
    concurrency
  );

  // 整理结果
  const uploadedUrls: string[] = [];
  for (const result of uploadResults) {
    if (result.url) {
      uploadedUrls[result.index] = result.url;
      console.log(`[10.5_upload] Uploaded: ${result.url}`);
    }
  }

  console.log(`[10.5_upload] Uploaded ${uploadedUrls.length} images successfully`);

  return {
    uploadedImageUrls: uploadedUrls
  };
}

/**
 * 上传单张图片
 */
async function uploadImage(
  base64: string,
  config: WechatConfig
): Promise<{ url: string; media_id: string }> {
  // 首先获取 access_token
  const token = await getAccessToken(config);

  // 上传临时素材
  const response = await httpPost<UploadResponse>(
    `${config.apiUrl}/cgi-bin/media/upload?access_token=${token}&type=image`,
    { media: base64 },
    {
      "Content-Type": "application/json"
    }
  );

  if (!response.success || !response.data) {
    throw new Error(response.error || "Failed to upload image");
  }

  return {
    url: response.data.url,
    media_id: response.data.media_id
  };
}

/**
 * 获取 access_token
 */
async function getAccessToken(config: WechatConfig): Promise<string> {
  const response = await httpPost<{ access_token: string }>(
    `${config.apiUrl}/cgi-bin/token`,
    {
      grant_type: "client_credential",
      appid: config.appId,
      secret: config.appSecret
    }
  );

  return response.access_token;
}

/**
 * 获取微信配置
 */
function getWechatConfig(): WechatConfig {
  const appId = process.env.WECHAT_APP_ID;
  const appSecret = process.env.WECHAT_APP_SECRET;

  if (!appId || !appSecret) {
    throw new Error("WECHAT_APP_ID and WECHAT_APP_SECRET must be set");
  }

  return {
    appId,
    appSecret,
    apiUrl: process.env.WECHAT_API_URL || "https://api.weixin.qq.com"
  };
}

/**
 * 延迟函数
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
