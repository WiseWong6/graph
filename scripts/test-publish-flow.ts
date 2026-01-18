/**
 * 完整发布流程测试脚本
 *
 * 测试流程:
 * 1. 读取本地 Markdown + 图片
 * 2. 上传图片到微信 CDN (11_upload)
 * 3. 生成 HTML (12_html)
 * 4. 发布到草稿箱 (13_draftbox)
 *
 * 使用方法:
 *   npx tsx scripts/test-publish-flow.ts
 */

import { readFileSync } from "fs";
import { join } from "path";
import "dotenv/config";
import { uploadImagesNode } from "../src/agents/article/nodes/11_upload.node.js";
import { htmlNode } from "../src/agents/article/nodes/12_html.node.js";
import { draftboxNode } from "../src/agents/article/nodes/13_draftbox.node.js";
import type { ArticleState } from "../src/agents/article/state.js";

/**
 * 测试配置
 */
const TEST_CONFIG = {
  // 输出目录（包含图片和 Markdown）
  outputDir: join(process.cwd(), "output/article-2026-01-18T14-25-55"),

  // 图片目录
  imagesDir: join(process.cwd(), "output/article-2026-01-18T14-25-55/images"),

  // Markdown 文件路径
  markdownPath: join(process.cwd(), "output/article-2026-01-18T14-25-55/humanize/08_humanized.md"),

  // 微信公众号配置（硬编码"人类是我的副业"）
  wechat: {
    account: "account1",
    name: "人类是我的副业",
    appId: process.env.WECHAT_APP_ID_1 || "",
    appSecret: process.env.WECHAT_APP_SECRET_1 || ""
  },

  // 标题（从 Markdown 中提取）
  title: "实战指南：用 MiniMax 开源评测集高效优化智能体"
};

/**
 * 主函数
 */
async function main() {
  console.log("=== 完整发布流程测试 ===\n");

  // ========== 环境检查 ==========
  if (!TEST_CONFIG.wechat.appId || !TEST_CONFIG.wechat.appSecret) {
    console.error("❌ 错误: 微信配置缺失");
    console.error("请确保 .env 中配置了 WECHAT_APP_ID_1 和 WECHAT_APP_SECRET_1");
    process.exit(1);
  }

  console.log(`✅ 目标公众号: ${TEST_CONFIG.wechat.name}`);
  console.log(`✅ 图片目录: ${TEST_CONFIG.imagesDir}`);
  console.log(`✅ Markdown: ${TEST_CONFIG.markdownPath}\n`);

  // ========== 步骤 0: 读取数据 ==========
  console.log("=== 步骤 0: 读取输入数据 ===");

  // 读取 Markdown
  const markdown = readFileSync(TEST_CONFIG.markdownPath, "utf-8");
  console.log(`✅ 读取 Markdown: ${markdown.length} 字符`);

  // 构造图片路径
  const imagePaths = [
    join(TEST_CONFIG.imagesDir, "image_01.png"),
    join(TEST_CONFIG.imagesDir, "image_02.png"),
    join(TEST_CONFIG.imagesDir, "image_03.png"),
    join(TEST_CONFIG.imagesDir, "image_04.png")
  ];
  console.log(`✅ 图片路径: ${imagePaths.length} 张\n`);

  // ========== 构造 ArticleState ==========
  const state: ArticleState = {
    prompt: "测试",
    topic: "测试",

    // Markdown 内容（来自 08_humanize）
    humanized: markdown,

    // 图片路径（本地）
    imagePaths,

    // 用户决策
    decisions: {
      wechat: TEST_CONFIG.wechat,
      images: {
        confirmed: true,
        count: 4,
        style: "infographic",
        model: "doubao-seedream-4-5-251128",
        resolution: "2k"
      },
      selectedTitle: TEST_CONFIG.title
    },

    // 输出路径
    outputPath: TEST_CONFIG.outputDir,
    runId: "test-publish-flow",

    // 初始化空数组（重要！）
    uploadedImageUrls: [],

    // 其他必需字段
    status: "running",
    titles: [TEST_CONFIG.title],
    draft: markdown,
    rewritten: markdown,
    polished: markdown,
    researchResult: "",
    ragContent: "",
    imagePrompts: [],
    htmlPath: "",
    generatedText: "",
    generatedText2: "",
    generatedText3: ""
  };

  // ========== 步骤 1: 上传图片 ==========
  console.log("=== 步骤 1: 上传图片到微信 CDN ===");
  const uploadResult = await uploadImagesNode(state);

  // 更新 state
  Object.assign(state, uploadResult);

  console.log(`✅ 上传完成: ${state.uploadedImageUrls.length} 张`);
  if (state.uploadedImageUrls.length > 0) {
    state.uploadedImageUrls.forEach((url, i) => {
      console.log(`   [${i}] ${url}`);
    });
  }
  console.log();

  // ========== 步骤 2: 生成 HTML ==========
  console.log("=== 步骤 2: 生成 HTML ===");
  const htmlResult = await htmlNode(state);

  // 更新 state
  Object.assign(state, htmlResult);

  if (!state.htmlPath) {
    console.error("❌ HTML 生成失败");
    process.exit(1);
  }

  console.log(`✅ HTML 已生成: ${state.htmlPath}\n`);

  // ========== 步骤 3: 发布到草稿箱 ==========
  console.log("=== 步骤 3: 发布到草稿箱 ===");
  const draftboxResult = await draftboxNode(state);

  console.log("\n=== 完成 ===");
  console.log("✅ 完整发布流程测试通过！");
}

// 运行
main().catch((error) => {
  console.error("\n❌ 测试失败:", error);
  process.exit(1);
});
