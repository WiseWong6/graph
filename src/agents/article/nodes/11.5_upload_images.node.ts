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

  // ========== 批量上传 ==========
  const uploadedUrls: string[] = [];

  for (let i = 0; i < state.imagePaths.length; i++) {
    const imagePath = state.imagePaths[i];
    console.log(`[10.5_upload] Uploading ${i + 1}/${state.imagePaths.length}: ${imagePath}`);

    try {
      // 读取图片
      if (!existsSync(imagePath)) {
        console.error(`[10.5_upload] File not found: ${imagePath}`);
        continue;
      }

      const imageBuffer = readFileSync(imagePath);
      const base64 = imageBuffer.toString("base64");

      // 上传
      const result = await uploadImage(base64, config);

      if (result.url) {
        uploadedUrls.push(result.url);
        console.log(`[10.5_upload] Uploaded: ${result.url}`);
      }

      // 避免频率限制
      await delay(500);
    } catch (error) {
      console.error(`[10.5_upload] Failed to upload ${imagePath}: ${error}`);
      // 继续上传下一张
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
