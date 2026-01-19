/**
 * Upload Images 节点 v3 - 带回退机制
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
 * - 如果 wechat 配置缺失，自动调用选择逻辑（回退机制）
 */

import FormData from "form-data";
import { readFileSync, existsSync } from "fs";
import { ArticleState, WechatConfig } from "../state";
import { parallelMap } from "../../../utils/concurrency.js";
import { config } from "dotenv";

// 加载环境变量
config({ path: process.cwd() + "/.env" });

/**
 * 微信公众号配置
 */
interface WeChatAccount {
  id: string;
  name: string;
  appId: string;
  appSecret: string;
}

/**
 * 可用的公众号列表
 */
const WECHAT_ACCOUNTS: WeChatAccount[] = [
  {
    id: "account1",
    name: "人类是我的副业",
    appId: process.env.WECHAT_APP_ID_1 || "",
    appSecret: process.env.WECHAT_APP_SECRET_1 || ""
  },
  {
    id: "account2",
    name: "歪斯Wise",
    appId: process.env.WECHAT_APP_ID_2 || "",
    appSecret: process.env.WECHAT_APP_SECRET_2 || ""
  }
];

/**
 * 交互提示函数类型
 */
type InteractivePrompt = <T = unknown>(
  questions: unknown
) => Promise<T>;

/**
 * 默认交互提示函数
 */
let promptFn: InteractivePrompt | null = null;

async function getPromptFn(): Promise<InteractivePrompt> {
  if (!promptFn) {
    const inquirerModule = await import("inquirer");
    promptFn = inquirerModule.default.prompt as InteractivePrompt;
  }
  return promptFn;
}

/**
 * 回退：让用户选择公众号
 *
 * 当 state.decisions.wechat 缺失时调用
 */
async function promptForWechat(): Promise<WechatConfig> {
  console.log("\n=== ⚠️  微信配置缺失 ===");
  console.log("检测到恢复的会话中没有微信公众号配置，请重新选择：\n");

  const prompt = await getPromptFn();

  // 过滤出配置完整的公众号
  const availableAccounts = WECHAT_ACCOUNTS.filter(
    acc => acc.appId && acc.appSecret
  );

  if (availableAccounts.length === 0) {
    console.error("❌ 没有配置完整的公众号！");
    console.error("请在 .env 中配置 WECHAT_APP_ID_1 和 WECHAT_APP_SECRET_1");
    throw new Error("No WeChat account configured");
  }

  const answer = await prompt<{ accountId: string }>([
    {
      type: "list",
      name: "accountId",
      message: "请选择公众号账号:",
      choices: availableAccounts.map(acc => ({
        name: acc.name,
        value: acc.id
      }))
    }
  ]);

  const selectedAccount = availableAccounts.find(
    acc => acc.id === answer.accountId
  );

  if (!selectedAccount) {
    throw new Error(`Selected account not found: ${answer.accountId}`);
  }

  console.log(`\n✅ 已选择: ${selectedAccount.name}\n`);

  return {
    account: selectedAccount.id,
    name: selectedAccount.name,
    appId: selectedAccount.appId,
    appSecret: selectedAccount.appSecret
  };
}

/**
 * 微信 API 配置
 */
interface WechatApiConfig {
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
  console.log("[11.5_upload] ========== NODE STARTED ==========");
  console.log("[11.5_upload] ========== START ==========");
  console.log("[11.5_upload] imagePaths:", state.imagePaths);
  console.log("[11.5_upload] wechat config:", state.decisions?.wechat ? "SET" : "MISSING");
  console.log("[11.5_upload] current state keys:", Object.keys(state));

  if (!state.imagePaths || state.imagePaths.length === 0) {
    console.log("[11.5_upload] No images to upload");
    console.log("[11.5_upload] Returning empty uploadedImageUrls");
    console.log("[11.5_upload] ========== END ==========");
    return {
      uploadedImageUrls: []
    };
  }

  // 使用 select_wechat 节点选择的微信配置
  let wechatConfig = state.decisions?.wechat;

  // 回退机制：如果 wechat 配置缺失，提示用户选择
  if (!wechatConfig) {
    console.warn("[11.5_upload] ⚠️  微信配置缺失，触发回退机制...");
    wechatConfig = await promptForWechat();
    // 将选择的配置保存到 state 中
    console.log("[11.5_upload] ✅ 微信配置已保存");
  }

  console.log(`[11.5_upload] Uploading ${state.imagePaths.length} images...`);

  // 构建 uploadImage 函数期望的配置（添加 apiUrl）
  const uploadConfig: WechatApiConfig = {
    appId: wechatConfig.appId,
    appSecret: wechatConfig.appSecret,
    apiUrl: "https://api.weixin.qq.com"
  };

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
        const result = await uploadImage(imageBuffer, uploadConfig);

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
  console.log("[11.5_upload] Returning uploadedImageUrls:", uploadedUrls);
  console.log("[11.5_upload] ========== END ==========");

  // 返回上传结果和 wechat 配置（如果使用了回退机制）
  const result: Partial<ArticleState> = {
    uploadedImageUrls: uploadedUrls
  };

  // 如果使用了回退机制，需要保存 wechat 配置到 state
  if (!state.decisions?.wechat) {
    result.decisions = {
      ...state.decisions,
      wechat: wechatConfig
    };
  }

  return result;
}

/**
 * 上传单张图片 (图文消息图片)
 *
 * API: /cgi-bin/media/uploadimg
 * Doc: https://developers.weixin.qq.com/doc/offiaccount/Asset_Management/New_temp_materials_library.html
 */
async function uploadImage(
  imageBuffer: Buffer,
  config: WechatApiConfig
): Promise<string> {
  // 首先获取 access_token
  const token = await getAccessToken(config);

  // 构建 FormData - 使用 form-data npm 包的原生 API
  const formData = new FormData();

  // 使用 form-data 的原生 API：append(name, buffer, options)
  formData.append("media", imageBuffer, {
    filename: "image.png",
    contentType: "image/png"
  });

  // 上传图文消息图片 - 使用 fetch + form-data 的 buffer
  const response = await fetch(
    `${config.apiUrl}/cgi-bin/media/uploadimg?access_token=${token}`,
    {
      method: "POST",
      headers: formData.getHeaders(),
      body: formData.getBuffer()
    }
  );

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.statusText}`);
  }

  const data = await response.json() as UploadImageResponse;

  if (data.errcode && data.errcode !== 0) {
    throw new Error(`Upload failed: ${data.errmsg} (errcode: ${data.errcode})`);
  }

  if (!data.url) {
    throw new Error("Upload failed: no URL returned");
  }

  return data.url;
}

/**
 * 获取 stable access_token（微信推荐的新接口）
 *
 * 文档: https://developers.weixin.qq.com/doc/offiaccount/Basic_Information/getStableAccessToken.html
 */
async function getAccessToken(config: WechatApiConfig): Promise<string> {
  const response = await fetch(
    `${config.apiUrl}/cgi-bin/stable_token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "client_credential",
        appid: config.appId,
        secret: config.appSecret
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to get stable access_token: ${response.statusText}`);
  }

  const data = await response.json() as { access_token: string; errcode?: number; errmsg?: string };

  if (data.errcode && data.errcode !== 0) {
    throw new Error(`Failed to get stable access_token: ${data.errmsg} (errcode: ${data.errcode})`);
  }

  if (!data.access_token) {
    throw new Error("Failed to get stable access_token: no token returned");
  }

  return data.access_token;
}

/**
 * 延迟函数
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
