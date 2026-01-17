/**
 * RAG 结果格式化工具
 *
 * 将检索结果转换为 Markdown 格式
 */

import type { RAGContent } from "../index/schema.js";

/**
 * 格式化为 Markdown
 */
export function formatRAGContent(data: RAGContent): string {
  let md = `# RAG 检索结果\n\n`;
  md += `**主题**: ${data.topic}\n\n`;
  md += `**检索时间**: ${data.stats.retrievalTime}ms\n\n`;

  // 相关金句
  if (data.quotes.length > 0) {
    md += `## 相关金句 (${data.quotes.length})\n\n`;
    data.quotes.forEach((q, i) => {
      md += `### ${i + 1}. ${q.content}\n\n`;
      if (q.metadata.source_title) {
        md += `> 来源: ${q.metadata.source_title}`;
        if (q.metadata.author) {
          md += ` | ${q.metadata.author}`;
        }
        md += `\n\n`;
      }
    });
  }

  // 相关文章片段
  if (data.articles.length > 0) {
    md += `## 相关文章片段 (${data.articles.length})\n\n`;
    data.articles.forEach((a, i) => {
      md += `### ${i + 1}. ${a.metadata.title || "无标题"}\n\n`;

      // 截取前 500 字
      const preview = a.content.length > 500
        ? a.content.slice(0, 500) + "..."
        : a.content;

      md += `${preview}\n\n`;

      if (a.metadata.author) {
        md += `> 来源: ${a.metadata.author}\n\n`;
      }
    });
  }

  // 参考标题
  if (data.titles && data.titles.length > 0) {
    md += `## 参考标题 (${data.titles.length})\n\n`;
    data.titles.forEach((t, i) => {
      md += `${i + 1}. ${t.title}\n`;
    });
    md += `\n`;
  }

  // 统计信息
  md += `---\n\n`;
  md += `**统计**: 金句 ${data.stats.quotesCount} 条 | 文章 ${data.stats.articlesCount} 篇`;
  if (data.stats.titlesCount) {
    md += ` | 标题 ${data.stats.titlesCount} 个`;
  }
  md += `\n`;

  return md;
}

/**
 * 从 Brief 提取关键词
 */
export function extractKeywords(brief: string): string[] {
  // 简单实现：提取 2-4 字的中文词汇
  const matches = brief.match(/[\u4e00-\u9fa5]{2,4}/g) || [];

  // 去重并返回前 10 个
  return [...new Set(matches)].slice(0, 10);
}

/**
 * 构建查询字符串
 */
export function buildQuery(topic: string, keywords: string[]): string {
  return `${topic} ${keywords.join(" ")}`;
}
