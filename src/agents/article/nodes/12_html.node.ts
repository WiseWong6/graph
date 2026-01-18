/**
 * HTML 节点 v2 - 修复版
 *
 * 职责: 将 Markdown 文章转换为微信公众号编辑器兼容的 HTML
 *
 * 数据流:
 * humanized + uploadedImageUrls → markdown-it → 图片替换 → HTML
 *
 * 设计原则:
 * - 使用 markdown-it 进行 Markdown 解析
 * - 替换图片索引为真实 CDN URL
 * - 兼容微信编辑器格式
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { ArticleState } from "../state";
import MarkdownIt from "markdown-it";

/**
 * 微信编辑器样式
 */
const WECHAT_STYLES = `
<style>
  .article-content {
    font-size: 16px;
    line-height: 1.8;
    color: #333;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  }
  .article-content h1 {
    font-size: 24px;
    font-weight: bold;
    margin: 20px 0;
    text-align: center;
  }
  .article-content h2 {
    font-size: 20px;
    font-weight: bold;
    margin: 18px 0;
  }
  .article-content h3 {
    font-size: 18px;
    font-weight: bold;
    margin: 16px 0;
  }
  .article-content p {
    margin: 12px 0;
    text-indent: 2em;
  }
  .article-content img {
    max-width: 100%;
    height: auto;
    display: block;
    margin: 15px auto;
  }
  .article-content strong {
    font-weight: bold;
    color: #1a1a1a;
  }
  .article-content em {
    font-style: italic;
  }
  .article-content code {
    background: #f5f5f5;
    padding: 2px 6px;
    border-radius: 3px;
    font-family: Consolas, Monaco, "Courier New", monospace;
  }
  .article-content pre {
    background: #f5f5f5;
    padding: 12px;
    border-radius: 5px;
    overflow-x: auto;
  }
  .article-content blockquote {
    border-left: 4px solid #ddd;
    padding-left: 12px;
    color: #666;
    margin: 12px 0;
  }
  .article-content a {
    color: #576b95;
    text-decoration: none;
  }
  .article-content ul, .article-content ol {
    margin: 12px 0;
    padding-left: 2em;
  }
  .article-content li {
    margin: 6px 0;
  }
</style>
`;

/**
 * HTML 节点主函数
 *
 * @param state - 当前状态
 * @returns 更新的状态
 */
export async function htmlNode(state: ArticleState): Promise<Partial<ArticleState>> {
  console.log("[12_html] ========== START ==========");
  console.log("[12_html] humanized exists:", !!state.humanized);
  console.log("[12_html] uploadedImageUrls:", state.uploadedImageUrls);
  console.log("[12_html] uploadedImageUrls.length:", state.uploadedImageUrls?.length || 0);
  console.log("[12_html] current state keys:", Object.keys(state));

  if (!state.humanized) {
    console.error("[12_html] No humanized article to convert");
    throw new Error("Humanized article not found in state");
  }

  // ========== 防御性检查 ==========
  if (!state.uploadedImageUrls) {
    console.error("[12_html] ========== ERROR ==========");
    console.error("[12_html] uploadedImageUrls is MISSING in state!");
    console.error("[12_html] This means 11_upload node was not executed or failed.");
    console.error("[12_html] State keys:", Object.keys(state));
    throw new Error("uploadedImageUrls not found - 11_upload node may have been skipped");
  }

  // 检查用户是否配置了图片
  const expectedImageCount = state.decisions?.images?.count || 0;

  if (expectedImageCount > 0 && state.uploadedImageUrls.length === 0) {
    console.error("[12_html] ========== ERROR ==========");
    console.error(`[12_html] User configured ${expectedImageCount} images, but uploadedImageUrls is EMPTY!`);
    console.error("[12_html] This means 11_upload node failed or was skipped.");
    console.error("[12_html] State keys:", Object.keys(state));
    throw new Error(`Expected ${expectedImageCount} uploaded URLs, but got 0 - 11_upload node may have failed`);
  }

  if (expectedImageCount === 0 && state.uploadedImageUrls.length === 0) {
    console.log("[12_html] User configured 0 images, skipping image processing");
    // 移除 Markdown 中的所有图片占位符
    state.humanized = state.humanized.replace(/!\[.*?\]\(.*?\)/g, "");
  }

  const uploadedUrls = state.uploadedImageUrls;
  console.log(`[12_html] Processing ${uploadedUrls.length} uploaded images (user configured ${expectedImageCount})`);

  const outputPath = state.outputPath || getDefaultOutputPath();
  const finalDir = join(outputPath, "final");

  if (!existsSync(finalDir)) {
    mkdirSync(finalDir, { recursive: true });
  }

  console.log(`[12_html] Processing article with ${uploadedUrls.length} images...`);

  // ========== 步骤 1: 替换图片索引为 CDN URL ==========
  let markdown = state.humanized;
  markdown = replaceImagePlaceholders(markdown, state.uploadedImageUrls);

  // ========== 步骤 2: 使用 markdown-it 解析 Markdown ==========
  const md = new MarkdownIt({
    html: true,      // 允许 HTML 标签
    linkify: true,   // 自动转换 URL 为链接
    typographer: true
  });

  const htmlContent = md.render(markdown);

  // ========== 步骤 3: 包装为微信编辑器格式 ==========
  const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>文章</title>
  ${WECHAT_STYLES}
</head>
<body>
  <section class="article-content">
    ${htmlContent}
  </section>
</body>
</html>`;

  // ========== 步骤 4: 保存 HTML ==========
  const htmlPath = join(finalDir, "article.html");
  writeFileSync(htmlPath, fullHtml, "utf-8");
  console.log("[12_html] Saved HTML:", htmlPath);

  // ========== 步骤 5: 同时保存 Markdown ==========
  const mdPath = join(finalDir, "article.md");
  writeFileSync(mdPath, markdown, "utf-8");
  console.log("[12_html] Saved Markdown:", mdPath);

  // 统计图片数量
  const finalImageCount = (markdown.match(/!\[.*?\]\(.*?\)/g) || []).length;
  console.log(`[12_html] Converted ${finalImageCount} images to CDN URLs`);

  return {
    htmlPath
  };
}

/**
 * 替换图片索引为 CDN URL
 *
 * 匹配格式: ![描述](索引)
 * 例如: ![配图1](0) → ![配图1](http://mmbiz.qpic.cn/...)
 */
function replaceImagePlaceholders(
  markdown: string,
  uploadedUrls: string[]
): string {
  // 匹配图片占位符: ![描述](索引)
  const imagePattern = /!\[(.*?)\]\((\d+)\)/g;

  let replacementCount = 0;

  const result = markdown.replace(imagePattern, (_match, alt, indexStr) => {
    const index = parseInt(indexStr, 10);

    // 检查索引是否有效
    if (index < 0 || index >= uploadedUrls.length) {
      console.warn(`[12_html] Invalid image index: ${index} (available: 0-${uploadedUrls.length - 1})`);
      return _match;  // 保持原样
    }

    const cdnUrl = uploadedUrls[index];
    if (!cdnUrl) {
      console.warn(`[12_html] No CDN URL for index ${index} (URL is null/undefined)`);
      return _match;  // 保持原样
    }

    replacementCount++;
    console.log(`[12_html] Replaced [${index}] → ${cdnUrl.substring(0, 50)}...`);

    // 替换为真实 URL
    return `![${alt}](${cdnUrl})`;
  });

  console.log(`[12_html] Replaced ${replacementCount}/${uploadedUrls.length} image placeholders`);

  return result;
}

/**
 * 获取默认输出路径
 */
function getDefaultOutputPath(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const runId = `article-${timestamp}`;
  return join(process.cwd(), "output", runId);
}
