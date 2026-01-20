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
  console.log("[12_html] humanized 文章存在:", !!state.humanized);
  console.log("[12_html] uploadedImageUrls 数量:", state.uploadedImageUrls?.length || 0);
  console.log("[12_html] current state keys:", Object.keys(state));

  if (!state.humanized) {
    console.error("[12_html] ❌ 错误：找不到 humanized 文章内容");
    throw new Error("缺少去机械化处理后的文章内容，请检查 09_humanize 节点");
  }

  const outputPath = state.outputPath || getDefaultOutputPath();
  const finalDir = join(outputPath, "final");

  if (!existsSync(finalDir)) {
    mkdirSync(finalDir, { recursive: true });
  }

  // 检查用户是否配置了图片
  const expectedImageCount = state.decisions?.images?.count || 0;

  // 处理 0 张图片的情况
  if (expectedImageCount === 0) {
    console.log("[12_html] 用户配置了 0 张图片，跳过图片处理");
    // 移除 Markdown 中的所有图片占位符
    state.humanized = state.humanized.replace(/!\[.*?\]\(.*?\)/g, "");
    // 直接生成 HTML（不需要图片 URL）
    return processMarkdown(state.humanized, [], outputPath, finalDir);
  }

  // 此时 expectedImageCount > 0，必须要有 uploadedImageUrls
  // 注意：此时 uploadedImageUrls 应该已经由 13_wait_for_upload 验证过
  if (!state.uploadedImageUrls || state.uploadedImageUrls.length === 0) {
    console.error("[12_html] ❌ 错误：找不到上传的图片 URL");
    console.error("[12_html] 这意味着 13_wait_for_upload 没有正确验证上传结果");
    throw new Error(`图片上传未完成：用户配置了 ${expectedImageCount} 张图片，但未找到上传结果`);
  }

  const uploadedUrls = state.uploadedImageUrls;
  console.log(`[12_html] 正在处理 ${uploadedUrls.length} 张上传的图片`);

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
  console.log("[12_html] HTML 已保存:", htmlPath);

  // ========== 步骤 5: 同时保存 Markdown ==========
  const mdPath = join(finalDir, "article.md");
  writeFileSync(mdPath, markdown, "utf-8");
  console.log("[12_html] Markdown 已保存:", mdPath);

  // 统计图片数量
  const finalImageCount = (markdown.match(/!\[.*?\]\(.*?\)/g) || []).length;
  console.log(`[12_html] 已转换 ${finalImageCount} 张图片为 CDN URL`);

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
      console.warn(`[12_html] ⚠️  无效的图片索引: ${index} (有效范围: 0-${uploadedUrls.length - 1})`);
      return _match;  // 保持原样
    }

    const cdnUrl = uploadedUrls[index];
    if (!cdnUrl) {
      console.warn(`[12_html] ⚠️  索引 ${index} 对应的 CDN URL 为空`);
      return _match;  // 保持原样
    }

    replacementCount++;
    console.log(`[12_html] 已替换图片 [${index}] → ${cdnUrl.substring(0, 50)}...`);

    // 替换为真实 URL
    return `![${alt}](${cdnUrl})`;
  });

  console.log(`[12_html] 已替换 ${replacementCount}/${uploadedUrls.length} 个图片占位符`);

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

/**
 * 处理 Markdown 并生成 HTML（用于 0 张图片的情况）
 *
 * @param markdown - Markdown 文本
 * @param uploadedUrls - 上传的图片 URL 列表
 * @param outputPath - 输出路径
 * @param finalDir - 最终输出目录
 */
function processMarkdown(
  markdown: string,
  uploadedUrls: string[],
  outputPath?: string,
  finalDir?: string
): { htmlPath: string } {
  const actualOutputPath = outputPath || getDefaultOutputPath();
  const actualFinalDir = finalDir || join(actualOutputPath, "final");

  if (!existsSync(actualFinalDir)) {
    mkdirSync(actualFinalDir, { recursive: true });
  }

  // 替换图片占位符（如果有）
  let processedMarkdown = markdown;
  if (uploadedUrls.length > 0) {
    processedMarkdown = replaceImagePlaceholders(markdown, uploadedUrls);
  }

  // 使用 markdown-it 解析 Markdown
  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true
  });

  const htmlContent = md.render(processedMarkdown);

  // 包装为微信编辑器格式
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

  // 保存 HTML
  const htmlPath = join(actualFinalDir, "article.html");
  writeFileSync(htmlPath, fullHtml, "utf-8");
  console.log("[12_html] HTML 已保存:", htmlPath);

  // 保存 Markdown
  const mdPath = join(actualFinalDir, "article.md");
  writeFileSync(mdPath, processedMarkdown, "utf-8");
  console.log("[12_html] Markdown 已保存:", mdPath);

  // 统计图片数量
  const finalImageCount = (processedMarkdown.match(/!\[.*?\]\(.*?\)/g) || []).length;
  console.log(`[12_html] 已转换 ${finalImageCount} 张图片为 CDN URL`);

  return { htmlPath };
}
