/**
 * HTML 节点
 *
 * 职责: 将 Markdown 文章转换为微信公众号编辑器兼容的 HTML
 *
 * 数据流:
 * humanized + uploadedImageUrls → md-to-wxhtml 技能 → htmlPath
 *
 * 设计原则:
 * - 调用现有技能
 * - 保留 data-* 属性
 * - 兼容微信编辑器
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { ArticleState } from "../state";
import { execSync } from "child_process";

/**
 * HTML 节点主函数
 *
 * @param state - 当前状态
 * @returns 更新的状态
 */
export async function htmlNode(state: ArticleState): Promise<Partial<ArticleState>> {
  console.log("[12_html] Converting Markdown to HTML...");

  if (!state.humanized) {
    console.error("[12_html] No humanized article to convert");
    throw new Error("Humanized article not found in state");
  }

  const outputPath = state.outputPath || getDefaultOutputPath();
  const finalDir = join(outputPath, "final");

  if (!existsSync(finalDir)) {
    mkdirSync(finalDir, { recursive: true });
  }

  // ========== 方法 1: 调用 md-to-wxhtml 技能 ==========
  try {
    console.log("[12_html] Calling md-to-wxhtml skill...");

    // 将文章内容写入临时文件
    const tempMdPath = join(outputPath, "_temp.md");
    writeFileSync(tempMdPath, state.humanized, "utf-8");

    // 调用技能
    const html = await callMdToWxhtmlSkill(tempMdPath);

    // 保存 HTML
    const htmlPath = join(finalDir, "article.html");
    writeFileSync(htmlPath, html, "utf-8");
    console.log("[12_html] Saved HTML:", htmlPath);

    // 同时保存 Markdown
    const mdPath = join(finalDir, "article.md");
    writeFileSync(mdPath, state.humanized, "utf-8");

    return {
      htmlPath
    };
  } catch (error) {
    console.error(`[12_html] Failed to call skill: ${error}`);

    // ========== 方法 2: 降级 - 简单转换 ==========
    console.log("[12_html] Using fallback simple conversion...");
    return fallbackHtmlConversion(state, finalDir);
  }
}

/**
 * 调用 md-to-wxhtml 技能
 */
async function callMdToWxhtmlSkill(mdPath: string): Promise<string> {
  // 使用 Skill tool 调用 md-to-wxhtml
  // 在 Claude Code 环境中可以直接调用
  // 独立运行时需要降级处理

  try {
    // 尝试调用 claude code skill
    const result = execSync(
      `claude skill run md-to-wxhtml "${mdPath}"`,
      { encoding: "utf-8", stdio: "pipe" }
    );

    return result;
  } catch (error) {
    // 如果命令不存在,使用降级方案
    throw new Error("Skill not available");
  }
}

/**
 * 降级: 简单的 Markdown 到 HTML 转换
 */
function fallbackHtmlConversion(state: ArticleState, finalDir: string): Partial<ArticleState> {
  const markdown = state.humanized || "";

  // 简单的 Markdown 转换
  let html = markdown
    // 标题
    .replace(/^### (.*$)/gim, "<h3>$1</h3>")
    .replace(/^## (.*$)/gim, "<h2>$1</h2>")
    .replace(/^# (.*$)/gim, "<h1>$1</h1>")
    // 粗体
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    // 斜体
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    // 代码
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    // 引用
    .replace(/^> (.*$)/gim, "<blockquote>$1</blockquote>")
    // 段落
    .replace(/\n\n/g, "</p><p>")
    // 换行
    .replace(/\n/g, "<br>");

  // 包裹在段落中
  html = `<section class="article-content">${html}</section>`;

  // 保存 HTML
  const htmlPath = join(finalDir, "article.html");
  writeFileSync(htmlPath, html, "utf-8");
  console.log("[12_html] Saved fallback HTML:", htmlPath);

  // 同时保存 Markdown
  const mdPath = join(finalDir, "article.md");
  writeFileSync(mdPath, markdown, "utf-8");

  return {
    htmlPath
  };
}

/**
 * 获取默认输出路径
 */
function getDefaultOutputPath(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const runId = `article-${timestamp}`;
  return join(process.cwd(), "output", runId);
}
