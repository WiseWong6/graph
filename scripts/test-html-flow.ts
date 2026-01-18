/**
 * HTML 流程验证测试
 *
 * 完整链路: 生图 → 上传微信 → MD+图片URL → HTML → 草稿箱
 *
 * 使用方式:
 * npm run test-html-flow
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { config } from "dotenv";
import { resolve } from "path";
import { createInterface } from "readline";

config({ path: resolve(process.cwd(), ".env") });

// ========== 测试数据 ==========

const TEST_MARKDOWN = `# AI Agent 是什么？

AI Agent（人工智能代理）是一种能够自主感知环境、做出决策并执行动作的智能系统。

## 核心特征

1. **自主性**: 能够独立运行，无需持续人工干预
2. **感知能力**: 通过传感器或 API 获取环境信息
3. **决策能力**: 基于目标和当前状态做出选择
4. **执行能力**: 调用工具或 API 完成任务

## 应用场景

- 客服机器人：自动回答用户问题
- 数据分析：自动收集和分析数据
- 内容创作：自动生成文章和配图

AI Agent 正在改变我们与软件交互的方式。
`;

const IMAGE_COUNT = 2;
const IMAGE_STYLE = "infographic";

// ========== 颜色输出 ==========

const colors = {
  reset: "\x1b[0m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  gray: "\x1b[90m",
  red: "\x1b[31m",
};

function print(color: keyof typeof colors, text: string) {
  process.stdout.write(colors[color] + text + colors.reset);
}

// ========== 步骤 1: 生图 ==========

async function step1_generateImages(count: number, style: string): Promise<string[]> {
  print("cyan", "\n" + "=".repeat(60) + "\n");
  print("cyan", "  步骤 1: 生成图片（Ark API）\n");
  print("cyan", "=".repeat(60) + "\n\n");

  const OpenAI = (await import("openai")).default;

  const config = {
    apiKey: process.env.ARK_API_KEY || process.env.VOLCENGINE_API_KEY,
    baseUrl: process.env.ARK_BASE_URL || "https://ark.cn-beijing.volces.com",
    model: process.env.ARK_MODEL || "doubao-seedream-4-5-251128"
  };

  if (!config.apiKey) {
    throw new Error("ARK_API_KEY not set");
  }

  const client = new OpenAI({
    baseURL: config.baseUrl + "/api/v3",
    apiKey: config.apiKey
  });

  const outputDir = join(process.cwd(), "output", "html-flow-test");
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const imagePaths: string[] = [];

  // 测试提示词
  const testPrompts = [
    "Flat vector style, white background, simple icons showing AI agent concept. Clean 16:9 horizontal layout, infographic style. No text, no watermark.",
    "Warm pastel colors, soft light, cozy illustration of AI helping humans work. Clean lineart, gentle shading. 16:9 horizontal layout. No text, no watermark."
  ];

  print("gray", `生成 ${count} 张图片...\n`);

  for (let i = 0; i < count; i++) {
    const filename = join(outputDir, `image_${i + 1}.png`);
    const prompt = testPrompts[i % testPrompts.length];

    print("yellow", `  [${i + 1}/${count}] 生成中...\n`);

    try {
      const response = await client.images.generate({
        model: config.model,
        prompt,
        size: "2k" as any,
        response_format: "url",
        watermark: false
      });

      if (response.data?.[0]?.url) {
        const imgResponse = await fetch(response.data[0].url);
        const buffer = Buffer.from(await imgResponse.arrayBuffer());
        writeFileSync(filename, buffer);
        imagePaths.push(filename);
        print("green", `    ✅ 保存: ${filename}\n`);
      }
    } catch (error) {
      print("red", `    ❌ 失败: ${error}\n`);
    }
  }

  return imagePaths;
}

// ========== 步骤 2: 上传微信 ==========

async function step2_uploadImages(imagePaths: string[]): Promise<string[]> {
  print("\n");
  print("cyan", "=".repeat(60) + "\n");
  print("cyan", "  步骤 2: 上传图片到微信 CDN (图文消息图片)\n");
  print("cyan", "=".repeat(60) + "\n\n");

  const appId = process.env.WECHAT_APP_ID_1;
  const appSecret = process.env.WECHAT_APP_SECRET_1;

  if (!appId || !appSecret) {
    print("yellow", "⚠️ 未配置微信 API，跳过上传\n");
    print("gray", "提示: 设置 WECHAT_APP_ID_1 和 WECHAT_APP_SECRET_1\n");
    return [];
  }

  // 获取 access_token
  const tokenResponse = await fetch(
    `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appId}&secret=${appSecret}`
  );
  const tokenData = await tokenResponse.json();

  if (tokenData.errcode) {
    throw new Error(`获取 token 失败: ${tokenData.errmsg}`);
  }

  const accessToken = tokenData.access_token;
  const uploadedUrls: string[] = [];

  print("gray", `上传 ${imagePaths.length} 张图片 (使用 /media/uploadimg API)...\n`);

  for (let i = 0; i < imagePaths.length; i++) {
    const imagePath = imagePaths[i];

    print("yellow", `  [${i + 1}/${imagePaths.length}] 上传中...\n`);

    try {
      // 读取图片
      const imageBuffer = readFileSync(imagePath);

      // 构建 FormData - 使用原生 File 构造函数 (Node.js 20+)
      const formData = new FormData();
      const file = new File([imageBuffer], "image.png", { type: "image/png" });
      formData.append("media", file);

      // 上传图文消息图片
      const uploadResponse = await fetch(
        `https://api.weixin.qq.com/cgi-bin/media/uploadimg?access_token=${accessToken}`,
        {
          method: "POST",
          body: formData
          // 不设置 Content-Type，让 fetch 自动添加 boundary
        }
      );

      const uploadData = await uploadResponse.json();

      if (uploadData.errcode) {
        throw new Error(`${uploadData.errmsg}`);
      }

      uploadedUrls.push(uploadData.url);
      print("green", `    ✅ URL: ${uploadData.url?.substring(0, 50)}...\n`);
    } catch (error) {
      print("red", `    ❌ 失败: ${error}\n`);
    }
  }

  return uploadedUrls;
}

// ========== 步骤 3: MD + 图片URL → HTML ==========

async function step3_convertToHtml(markdown: string, imageUrls: string[]): Promise<string> {
  print("\n");
  print("cyan", "=".repeat(60) + "\n");
  print("cyan", "  步骤 3: Markdown + 图片 URL → HTML\n");
  print("cyan", "=".repeat(60) + "\n\n");

  print("gray", "图片 URL 数量: " + imageUrls.length + "\n");

  // 如果没有上传成功的图片，移除 Markdown 中的图片引用
  let processedMarkdown = markdown;
  if (imageUrls.length === 0) {
    print("yellow", "⚠️ 没有上传成功的图片，移除 Markdown 中的图片引用\n");
    processedMarkdown = markdown.replace(/!\[.*?\]\(.*?\)/g, "");
  }

  const tempDir = join(process.cwd(), "output", "html-flow-test");

  // 方案 1: 使用 md-to-wxhtml 技能（需要在 Claude Code 环境）
  print("yellow", "尝试调用 md-to-wxhtml 技能...\n");

  let html: string;

  try {
    const { execSync } = await import("child_process");
    const tempMdPath = join(tempDir, "_temp.md");
    writeFileSync(tempMdPath, processedMarkdown, "utf-8");

    const result = execSync(
      `claude skill run md-to-wxhtml "${tempMdPath}"`,
      { encoding: "utf-8", stdio: "pipe" }
    );

    // 检查是否返回了帮助信息
    if (result.includes("我理解你想要查看或使用某个 skill")) {
      throw new Error("Skill call failed");
    }

    print("green", "✅ 技能调用成功\n");
    html = result;
  } catch (error) {
    print("yellow", "⚠️ 技能不可用，使用改进的降级方案\n");

    // 改进的降级方案：更接近微信编辑器格式
    html = convertMarkdownToWxHtml(processedMarkdown, imageUrls);
  }

  // 保存 HTML
  const htmlPath = join(tempDir, "article.html");
  writeFileSync(htmlPath, html, "utf-8");
  print("gray", `HTML 长度: ${html.length} 字符\n`);

  return html;
}

/**
 * 改进的 Markdown → 微信 HTML 转换
 */
function convertMarkdownToWxHtml(markdown: string, imageUrls: string[]): string {
  const lines = markdown.split("\n");
  const output: string[] = [];

  let inCodeBlock = false;
  let inList = false;
  let imageIndex = 0;

  for (const line of lines) {
    // 代码块
    if (line.trim().startsWith("```")) {
      if (inCodeBlock) {
        output.push("</code></pre>");
        inCodeBlock = false;
      } else {
        if (inList) {
          output.push("</ol>");
          inList = false;
        }
        output.push("<pre><code>");
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      output.push(escapeHtml(line));
      continue;
    }

    // 标题
    if (line.startsWith("# ")) {
      if (inList) { output.push("</ol>"); inList = false; }
      output.push(`<h1 style="font-size: 24px; font-weight: bold; margin: 20px 0;">${line.slice(2)}</h1>`);
      continue;
    }
    if (line.startsWith("## ")) {
      if (inList) { output.push("</ol>"); inList = false; }
      output.push(`<h2 style="font-size: 20px; font-weight: bold; margin: 18px 0;">${line.slice(3)}</h2>`);
      continue;
    }
    if (line.startsWith("### ")) {
      if (inList) { output.push("</ol>"); inList = false; }
      output.push(`<h3 style="font-size: 18px; font-weight: bold; margin: 16px 0;">${line.slice(4)}</h3>`);
      continue;
    }

    // 列表
    if (line.match(/^\d+\.\s/)) {
      if (!inList) {
        output.push('<ol style="margin: 10px 0; padding-left: 20px;">');
        inList = true;
      }
      const content = line.replace(/^\d+\.\s*/, "");
      output.push(`<li style="margin: 5px 0;">${inlineFormat(content)}</li>`);
      continue;
    }

    // 引用
    if (line.startsWith("> ")) {
      if (inList) { output.push("</ol>"); inList = false; }
      const content = line.slice(2);
      output.push(`<blockquote style="border-left: 4px solid #ddd; margin: 10px 0; padding-left: 10px; color: #666;">${inlineFormat(content)}</blockquote>`);
      continue;
    }

    // 图片占位符（如果有上传的图片 URL）
    if (line.match(/^!\[.*\]\(.*\)/) && imageUrls.length > 0 && imageIndex < imageUrls.length) {
      if (inList) { output.push("</ol>"); inList = false; }
      const url = imageUrls[imageIndex++];
      output.push(`<img src="${url}" style="max-width: 100%; display: block; margin: 15px 0;" />`);
      continue;
    }

    // 普通段落
    if (line.trim()) {
      if (inList) { output.push("</ol>"); inList = false; }
      output.push(`<p style="margin: 10px 0; line-height: 1.6;">${inlineFormat(line)}</p>`);
    }
  }

  if (inList) output.push("</ol>");

  return `<section class="article-content" style="padding: 20px;">${output.join("\n")}</section>`;
}

/**
 * 行内格式化
 */
function inlineFormat(text: string): string {
  return text
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, '<code style="background: #f4f4f4; padding: 2px 4px; border-radius: 3px;">$1</code>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" style="color: #007bff;">$1</a>');
}

/**
 * HTML 转义
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ========== 步骤 4: 发布到草稿箱 ==========

async function step4_publishToDraftbox(html: string, title: string): Promise<void> {
  print("\n");
  print("cyan", "=".repeat(60) + "\n");
  print("cyan", "  步骤 4: 发布到微信草稿箱\n");
  print("cyan", "=".repeat(60) + "\n\n");

  const appId = process.env.WECHAT_APP_ID_1;
  const appSecret = process.env.WECHAT_APP_SECRET_1;

  if (!appId || !appSecret) {
    print("yellow", "⚠️ 未配置微信 API，跳过发布\n");
    return;
  }

  // 获取 access_token
  const tokenResponse = await fetch(
    `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appId}&secret=${appSecret}`
  );
  const tokenData = await tokenResponse.json();

  if (tokenData.errcode) {
    throw new Error(`获取 token 失败: ${tokenData.errmsg}`);
  }

  const accessToken = tokenData.access_token;

  // 提取摘要
  const digest = html.replace(/<[^>]*>/g, "").substring(0, 120);

  // 构建草稿数据
  const draftData = {
    articles: [{
      title,
      content: html,
      digest,
      author: "AI Assistant",
      show_cover_pic: 0
    }]
  };

  print("gray", "发布中...\n");

  const response = await fetch(
    `https://api.weixin.qq.com/cgi-bin/draft/add?access_token=${accessToken}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draftData)
    }
  );

  const result = await response.json();

  print("gray", `API 响应: ${JSON.stringify(result, null, 2)}\n`);

  if (result.errcode) {
    print("red", `❌ 发布失败 (errcode: ${result.errcode}): ${result.errmsg}\n`);
  } else {
    print("green", `✅ 发布成功！\n`);
    print("gray", `media_id: ${result.media_id}\n`);
  }
}

// ========== 主函数 ==========

async function main() {
  print("cyan", "\n╔═══════════════════════════════════════════════════════════════╗\n");
  print("cyan", "║       HTML 流程验证测试                                           ║\n");
  print("║       生图 → 上传 → HTML → 草稿箱                                     ║\n");
  print("cyan", "╚═════════════════════════════════════════════════════════════╝\n\n");

  // 环境检查
  const hasArkKey = !!(process.env.ARK_API_KEY || process.env.VOLCENGINE_API_KEY);
  const hasWechatKey = !!(process.env.WECHAT_APP_ID_1 && process.env.WECHAT_APP_SECRET_1);

  print("yellow", "环境检查:\n");
  print("gray", `  ARK_API_KEY: ${hasArkKey ? "✅" : "❌ 未设置"}\n`);
  print("gray", `  WECHAT_API: ${hasWechatKey ? "✅" : "❌ 未设置"}\n\n`);

  if (!hasArkKey) {
    print("red", "❌ 缺少 ARK_API_KEY，无法生图\n");
    process.exit(1);
  }

  try {
    // 步骤 1: 生图
    const imagePaths = await step1_generateImages(IMAGE_COUNT, IMAGE_STYLE);

    if (imagePaths.length === 0) {
      print("red", "\n❌ 生图失败，终止流程\n");
      process.exit(1);
    }

    // 步骤 2: 上传微信
    const imageUrls = await step2_uploadImages(imagePaths);

    // 步骤 3: 转 HTML
    const html = await step3_convertToHtml(TEST_MARKDOWN, imageUrls);

    print("gray", `\nHTML 长度: ${html.length} 字符\n`);

    // 步骤 4: 发布草稿箱
    if (hasWechatKey) {
      await step4_publishToDraftbox(html, "AI Agent 是什么？");
    }

    print("\n");
    print("green", "✅ 流程验证完成！\n");
    print("gray", "查看输出: output/html-flow-test/\n\n");

  } catch (error) {
    print("red", `\n❌ 错误: ${error}\n\n`);
    process.exit(1);
  }
}

main().catch(console.error);
