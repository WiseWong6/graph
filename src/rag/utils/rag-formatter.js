"use strict";
/**
 * RAG 结果格式化工具
 *
 * 将检索结果转换为 Markdown 格式
 */
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatRAGContent = formatRAGContent;
exports.extractKeywords = extractKeywords;
exports.buildQuery = buildQuery;
/**
 * 格式化为 Markdown
 */
function formatRAGContent(data) {
    var md = "# RAG \u68C0\u7D22\u7ED3\u679C\n\n";
    md += "**\u4E3B\u9898**: ".concat(data.topic, "\n\n");
    md += "**\u68C0\u7D22\u65F6\u95F4**: ".concat(data.stats.retrievalTime, "ms\n\n");
    // 相关金句
    if (data.quotes.length > 0) {
        md += "## \u76F8\u5173\u91D1\u53E5 (".concat(data.quotes.length, ")\n\n");
        data.quotes.forEach(function (q, i) {
            md += "### ".concat(i + 1, ". ").concat(q.content, "\n\n");
            if (q.metadata.source_title) {
                md += "> \u6765\u6E90: ".concat(q.metadata.source_title);
                if (q.metadata.author) {
                    md += " | ".concat(q.metadata.author);
                }
                md += "\n\n";
            }
        });
    }
    // 相关文章片段
    if (data.articles.length > 0) {
        md += "## \u76F8\u5173\u6587\u7AE0\u7247\u6BB5 (".concat(data.articles.length, ")\n\n");
        data.articles.forEach(function (a, i) {
            md += "### ".concat(i + 1, ". ").concat(a.metadata.title || "无标题", "\n\n");
            // 截取前 500 字
            var preview = a.content.length > 500
                ? a.content.slice(0, 500) + "..."
                : a.content;
            md += "".concat(preview, "\n\n");
            if (a.metadata.author) {
                md += "> \u6765\u6E90: ".concat(a.metadata.author, "\n\n");
            }
        });
    }
    // 参考标题
    if (data.titles && data.titles.length > 0) {
        md += "## \u53C2\u8003\u6807\u9898 (".concat(data.titles.length, ")\n\n");
        data.titles.forEach(function (t, i) {
            md += "".concat(i + 1, ". ").concat(t.title, "\n");
        });
        md += "\n";
    }
    // 统计信息
    md += "---\n\n";
    md += "**\u7EDF\u8BA1**: \u91D1\u53E5 ".concat(data.stats.quotesCount, " \u6761 | \u6587\u7AE0 ").concat(data.stats.articlesCount, " \u7BC7");
    if (data.stats.titlesCount) {
        md += " | \u6807\u9898 ".concat(data.stats.titlesCount, " \u4E2A");
    }
    md += "\n";
    return md;
}
/**
 * 从 Brief 提取关键词
 */
function extractKeywords(brief) {
    // 简单实现：提取 2-4 字的中文词汇
    var matches = brief.match(/[\u4e00-\u9fa5]{2,4}/g) || [];
    // 去重并返回前 10 个
    return __spreadArray([], new Set(matches), true).slice(0, 10);
}
/**
 * 构建查询字符串
 */
function buildQuery(topic, keywords) {
    return "".concat(topic, " ").concat(keywords.join(" "));
}
