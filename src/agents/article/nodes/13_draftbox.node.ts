/**
 * Draftbox 节点
 *
 * 职责: 发布文章到微信公众号草稿箱
 *
 * 数据流:
 * htmlPath + selectedTitle + wechatConfig + imagePaths → 微信 API → draftbox URL
 *
 * 设计原则:
 * - 调用微信 API
 * - 上传永久缩略图素材（thumb_media_id 必填）
 * - 返回草稿箱链接
 * - 错误处理
 */

import { readFileSync, existsSync } from "fs";
import { ArticleState } from "../state";
import { httpPost } from "../../../adapters/mcp.js";

/**
 * 微信草稿响应（原始 API 格式）
 */
interface DraftboxResponse {
  media_id: string;
  errcode?: number;
  errmsg?: string;
}

/**
 * Draftbox 节点主函数
 *
 * @param state - 当前状态
 * @returns 更新的状态
 */
export async function draftboxNode(state: ArticleState): Promise<Partial<ArticleState>> {
  console.log("[13_draftbox] Publishing to WeChat draftbox...");

  if (!state.htmlPath) {
    console.error("[13_draftbox] No HTML path found");
    throw new Error("HTML path not found in state");
  }

  // 获取标题和公众号配置
  const title = state.decisions?.selectedTitle || state.titles?.[0] || "未命名文章";
  const wechatConfig = state.decisions?.wechat;

  if (!wechatConfig || !wechatConfig.appId || !wechatConfig.appSecret) {
    console.error("[13_draftbox] ❌ 公众号配置不完整");
    console.error("[13_draftbox] 请确保在 Gate A 正确选择了公众号");
    throw new Error("WeChat account not configured in state");
  }

  console.log(`[13_draftbox] 目标公众号: ${wechatConfig.name}`);

  // 读取 HTML 内容
  if (!existsSync(state.htmlPath)) {
    console.error(`[13_draftbox] HTML file not found: ${state.htmlPath}`);
    throw new Error(`HTML file not found: ${state.htmlPath}`);
  }

  const htmlContent = readFileSync(state.htmlPath, "utf-8");

  console.log(`[13_draftbox] Title: ${title}`);
  console.log(`[13_draftbox] HTML length: ${htmlContent.length} chars`);

  try {
    // ========== 发布到草稿箱 ==========
    const firstImagePath = state.imagePaths?.[0];  // 第一张图片作为封面
    const result = await publishToDraftbox(title, htmlContent, wechatConfig, firstImagePath);

    console.log(`[13_draftbox] Published successfully!`);
    console.log(`[13_draftbox] Draft URL: ${result.draft_url}`);
    console.log(`[13_draftbox] Media ID: ${result.media_id}`);

    return {
      status: "completed"
    };
  } catch (error) {
    console.error(`[13_draftbox] Failed to publish: ${error}`);
    throw error;
  }
}

/**
 * 发布到草稿箱
 */
async function publishToDraftbox(
  title: string,
  htmlContent: string,
  wechatConfig: { appId: string; appSecret: string; name: string },
  firstImagePath?: string
): Promise<{ draft_url: string; media_id: string }> {
  const config = {
    appId: wechatConfig.appId,
    appSecret: wechatConfig.appSecret,
    apiUrl: process.env.WECHAT_API_URL || "https://api.weixin.qq.com"
  };

  // 获取 access_token
  const token = await getAccessToken(config);

  // 步骤 1: 上传永久缩略图素材（thumb_media_id 必填）
  let thumbMediaId = "";

  if (firstImagePath) {
    console.log(`[13_draftbox] 上传封面图: ${firstImagePath}`);
    thumbMediaId = await uploadThumbMaterial(firstImagePath, config.apiUrl, token);
    console.log(`[13_draftbox] thumb_media_id: ${thumbMediaId}`);
  } else {
    console.warn(`[13_draftbox] ⚠️ 没有提供封面图，草稿可能失败`);
  }

  // 步骤 2: 构建草稿数据
  // 注意：thumb_media_id 是必填的（即使 show_cover_pic: 0）
  const draftData = {
    articles: [{
      title,
      content: htmlContent,
      digest: extractDigest(htmlContent),
      author: "AI Assistant",
      show_cover_pic: 0,  // 不显示封面图
      thumb_media_id: thumbMediaId  // 封面素材 ID（必填）
    }]
  };

  console.log(`[13_draftbox] Draft data keys:`, Object.keys(draftData.articles[0]));

  // 步骤 3: 调用 API
  const response = await httpPost<DraftboxResponse>(
    `${config.apiUrl}/cgi-bin/draft/add?access_token=${token}`,
    draftData,
    {
      "Content-Type": "application/json"
    }
  );

  // 检查 API 错误
  if (response.errcode && response.errcode !== 0) {
    throw new Error(`WeChat API Error: ${response.errmsg} (errcode: ${response.errcode})`);
  }

  if (!response.media_id) {
    throw new Error("Failed to publish: no media_id returned");
  }

  console.log(`[13_draftbox] media_id: ${response.media_id}`);

  // 构造草稿箱 URL
  const draftUrl = `https://mp.weixin.qq.com/cgi-bin/appmsg?t=media/appmsg_edit_v2&action=edit&isNew=1&type=10&createType=0&token=${token}&lang=zh_CN&mid=${response.media_id}`;

  return {
    draft_url: draftUrl,
    media_id: response.media_id
  };
}

/**
 * 上传永久缩略图素材
 *
 * API: /cgi-bin/material/add_material?type=thumb
 * 文档: https://developers.weixin.qq.com/doc/offiaccount/Asset_Management/Adding_Permanent_Assets.html
 *
 * @param imagePath - 本地图片路径
 * @param apiUrl - 微信 API 地址
 * @param token - access_token
 * @returns media_id
 */
async function uploadThumbMaterial(
  imagePath: string,
  apiUrl: string,
  token: string
): Promise<string> {
  const { readFileSync } = await import("fs");

  if (!imagePath) {
    throw new Error("imagePath is required for thumb material upload");
  }

  // 读取图片
  const imageBuffer = readFileSync(imagePath);

  // 构建 FormData（只传递 media，其他参数通过 URL 参数指定）
  const formData = new FormData();
  formData.append("media", new File([imageBuffer], "thumb.png", { type: "image/png" }));

  // 上传永久素材
  const { httpPostFormData } = await import("../../../adapters/mcp.js");
  const response = await httpPostFormData<{
    media_id: string;
    url?: string;
    errcode?: number;
    errmsg?: string;
  }>(
    `${apiUrl}/cgi-bin/material/add_material?access_token=${token}&type=thumb`,
    formData
  );

  if (response.errcode && response.errcode !== 0) {
    throw new Error(`Failed to upload thumb material: ${response.errmsg} (errcode: ${response.errcode})`);
  }

  if (!response.media_id) {
    throw new Error("Failed to upload thumb material: no media_id returned");
  }

  return response.media_id;
}

/**
 * 获取 stable access_token（微信推荐的新接口）
 *
 * 文档: https://developers.weixin.qq.com/doc/offiaccount/Basic_Information/getStableAccessToken.html
 *
 * 使用 POST 请求，更安全可靠
 */
async function getAccessToken(config: {
  appId: string;
  appSecret: string;
  apiUrl: string;
}): Promise<string> {
  // 使用新的 stable access_token 接口
  const response = await httpPost<{ access_token: string; errcode?: number; errmsg?: string }>(
    `${config.apiUrl}/cgi-bin/stable_token`,
    {
      grant_type: "client_credential",
      appid: config.appId,
      secret: config.appSecret
    }
  );

  if (response.errcode && response.errcode !== 0) {
    throw new Error(`Failed to get stable access_token: ${response.errmsg} (errcode: ${response.errcode})`);
  }

  if (!response.access_token) {
    throw new Error("Failed to get stable access_token: no token returned");
  }

  return response.access_token;
}

/**
 * 提取摘要
 *
 * 微信限制摘要长度为 54 个汉字（或 120 字节）
 */
function extractDigest(html: string): string {
  // 移除 HTML 标签
  const text = html.replace(/<[^>]*>/g, "");

  // 取前 54 字作为摘要（微信限制）
  return text.length > 54
    ? text.substring(0, 54)
    : text;
}
