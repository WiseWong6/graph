/**
 * 单点测试：上传图片到微信 CDN
 *
 * 测试内容：
 * 1. 使用 state.wechat 配置
 * 2. 上传本地图片到微信 CDN
 */

import "dotenv/config";
import { uploadImagesNode } from "../src/agents/article/nodes/11_upload.node.js";
import type { ArticleState } from "../src/agents/article/state.js";

// 模拟 state
const state: Partial<ArticleState> = {
  // 使用 select_wechat 节点选择的配置
  wechat: {
    appId: process.env.WECHAT_APP_ID_1 || "",
    appSecret: process.env.WECHAT_APP_SECRET_1 || "",
    apiUrl: process.env.WECHAT_API_URL || "https://api.weixin.qq.com"
  },

  // 本地图片路径
  imagePaths: [
    "/Users/wisewong/Documents/Developer/write-agent/output/article-2026-01-18T14-25-55/images/image_01.png"
  ]
};

// 验证配置
console.log("=== Upload Node 单点测试 ===\n");
console.log("WeChat 配置:");
console.log(`  App ID: ${state.wechat?.appId?.substring(0, 10)}...`);
console.log(`  API URL: ${state.wechat?.apiUrl}`);
console.log(`\n待上传图片: ${state.imagePaths?.length} 张`);
state.imagePaths?.forEach((path, i) => {
  console.log(`  ${i + 1}. ${path}`);
});
console.log("");

// 运行测试
async function run() {
  try {
    const result = await uploadImagesNode(state as ArticleState);

    console.log("\n=== 测试结果 ===");
    console.log("上传成功！");
    console.log("CDN URLs:");
    result.uploadedImageUrls?.forEach((url, i) => {
      console.log(`  ${i + 1}. ${url}`);
    });
  } catch (error) {
    console.error("\n❌ 测试失败:");
    console.error(error);
    process.exit(1);
  }
}

run();
