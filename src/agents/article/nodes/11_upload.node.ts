/**
 * Upload Images 节点 v2 - 修复版
 *
 * 职责: 上传本地图片到微信 CDN (图文消息图片)
 *
 * 数据流:
 * imagePaths + wechatConfig → 微信 API → uploadedImageUrls[]
 *
 * 设计原则:
 * - 使用正确的 API: /media/uploadimg (图文消息图片)
 * - 使用 form-data 上传
 * - 返回 CDN URL
 */

import { readFileSync, existsSync } from "fs";
import { ArticleState } from "../state";
import { httpPostFormData } from "../../../adapters/mcp.js";
import { parallelMap } from "../../../utils/concurrency.js";

/**
 * 微信 API 配置
 */
interface WechatConfig {
  appId: string;
  appSecret: string;
  apiUrl: string;
}

/**
 * 上传响应 (图文消息图片)
 */
interface UploadImageResponse {
  errcode?: number;
  errmsg?: string;
  url?: string;
}

/**
 * Upload Images 节点主函数
 *
 * @param state - 当前状态
 * @returns 更新的状态
 */
export async function uploadImagesNode(state: ArticleState): Promise<Partial<ArticleState>> {
  console.log("[11.5_upload] Uploading images to WeChat CDN...");

  if (!state.imagePaths || state.imagePaths.length === 0) {
    console.log("[11.5_upload] No images to upload");
    return {
      uploadedImageUrls: []
    };
  }

  // 使用 select_wechat 节点选择的微信配置
  const config = state.wechat;

  if (!config) {
    throw new Error("WeChat config not found in state. Please run select_wechat first.");
  }

  console.log(`[11.5_upload] Uploading ${state.imagePaths.length} images...`);

  // ========== 并行上传 ==========
  const concurrency = parseInt(process.env.UPLOAD_CONCURRENCY || "5");

  console.log(`[11.5_upload] Starting parallel upload (concurrency: ${concurrency})...`);

  const uploadResults = await parallelMap(
    state.imagePaths,
    async (imagePath, index) => {
      console.log(`[11.5_upload] Uploading ${index + 1}/${state.imagePaths.length}: ${imagePath}`);

      try {
        // 读取图片
        if (!existsSync(imagePath)) {
          console.error(`[11.5_upload] File not found: ${imagePath}`);
          return { index, url: null as string | null };
        }

        const imageBuffer = readFileSync(imagePath);

        // 上传
        const result = await uploadImage(imageBuffer, config);

        // 避免频率限制
        await delay(300);

        return { index, url: result };
      } catch (error) {
        console.error(`[11.5_upload] Failed to upload ${imagePath}: ${error}`);
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
      console.log(`[11.5_upload] Uploaded: ${result.url}`);
    }
  }

  console.log(`[11.5_upload] Uploaded ${uploadedUrls.length} images successfully`);

  return {
    uploadedImageUrls: uploadedUrls
  };
}

/**
 * 上传单张图片 (图文消息图片)
 *
 * API: /cgi-bin/media/uploadimg
 * Doc: https://developers.weixin.qq.com/doc/offiaccount/Asset_Management/New_temp_materials_library.html
 */
async function uploadImage(
  imageBuffer: Buffer,
  config: WechatConfig
): Promise<string> {
  // 首先获取 access_token
  const token = await getAccessToken(config);

  // 构建 FormData - Node.js 需要显式指定 filename
  const formData = new FormData();

  // 从 Buffer 创建 File 对象（Node.js 18+ 支持）
  // 或使用 Blob 并指定文件名
  const file = new File([imageBuffer], "image.png", { type: "image/png" });
  formData.append("media", file);

  // 上传图文消息图片
  const response = await httpPostFormData<UploadImageResponse>(
    `${config.apiUrl}/cgi-bin/media/uploadimg?access_token=${token}`,
    formData
  );

  if (response.errcode && response.errcode !== 0) {
    throw new Error(`Upload failed: ${response.errmsg} (errcode: ${response.errcode})`);
  }

  if (!response.url) {
    throw new Error("Upload failed: no URL returned");
  }

  return response.url;
}

/**
 * 获取 access_token
 */
async function getAccessToken(config: WechatConfig): Promise<string> {
  const url = `${config.apiUrl}/cgi-bin/token?grant_type=client_credential&appid=${config.appId}&secret=${config.appSecret}`;
  console.log("[11.5_upload] Token API URL:", url.replace(config.appSecret, "***"));
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to get access_token: ${response.statusText}`);
  }

  const data = await response.json() as { access_token: string; errcode?: number; errmsg?: string };

  // 打印完整响应用于调试
  console.log("[11.5_upload] Token API response:", JSON.stringify(data));

  if (data.errcode && data.errcode !== 0) {
    throw new Error(`Failed to get access_token: ${data.errmsg} (errcode: ${data.errcode})`);
  }

  if (!data.access_token) {
    throw new Error("Failed to get access_token: no token returned");
  }

  return data.access_token;
}

/**
 * 延迟函数
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
