/**
 * Draftbox 节点
 *
 * 职责: 发布文章到微信公众号草稿箱
 *
 * 数据流:
 * htmlPath + selectedTitle + wechatConfig → 微信 API → draftbox URL
 *
 * 设计原则:
 * - 调用微信 API
 * - 返回草稿箱链接
 * - 错误处理
 */

import { readFileSync, existsSync } from "fs";
import { ArticleState } from "../state";
import { httpPost } from "../../../adapters/mcp.js";

/**
 * 微信草稿响应
 */
interface DraftboxResponse {
  success: boolean;
  data?: {
    media_id: string;
    draft_url: string;
  };
  error?: string;
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
    const result = await publishToDraftbox(title, htmlContent, wechatConfig);

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
  wechatConfig: { appId: string; appSecret: string; name: string }
): Promise<{ draft_url: string; media_id: string }> {
  const config = {
    appId: wechatConfig.appId,
    appSecret: wechatConfig.appSecret,
    apiUrl: process.env.WECHAT_API_URL || "https://api.weixin.qq.com"
  };

  // 获取 access_token
  const token = await getAccessToken(config);

  // 构建草稿数据
  const draftData = {
    articles: [{
      title,
      content: htmlContent,
      digest: extractDigest(htmlContent), // 摘要
      author: "AI Assistant",
      show_cover_pic: 0
    }]
  };

  // 调用 API
  const response = await httpPost<DraftboxResponse>(
    `${config.apiUrl}/cgi-bin/draft/add?access_token=${token}`,
    draftData,
    {
      "Content-Type": "application/json"
    }
  );

  if (!response.success || !response.data) {
    throw new Error(response.error || "Failed to publish to draftbox");
  }

  return {
    draft_url: response.data.draft_url,
    media_id: response.data.media_id
  };
}

/**
 * 获取 access_token
 */
async function getAccessToken(config: {
  appId: string;
  appSecret: string;
  apiUrl: string;
}): Promise<string> {
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
 * 提取摘要
 */
function extractDigest(html: string): string {
  // 移除 HTML 标签
  const text = html.replace(/<[^>]*>/g, "");

  // 取前 120 字作为摘要
  return text.length > 120
    ? text.substring(0, 120) + "..."
    : text;
}
