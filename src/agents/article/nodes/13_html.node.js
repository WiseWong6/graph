"use strict";
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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.htmlNode = htmlNode;
var fs_1 = require("fs");
var path_1 = require("path");
var markdown_it_1 = require("markdown-it");
/**
 * 微信编辑器样式
 */
var WECHAT_STYLES = "\n<style>\n  .article-content {\n    font-size: 16px;\n    line-height: 1.8;\n    color: #333;\n    font-family: -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif;\n  }\n  .article-content h1 {\n    font-size: 24px;\n    font-weight: bold;\n    margin: 20px 0;\n    text-align: center;\n  }\n  .article-content h2 {\n    font-size: 20px;\n    font-weight: bold;\n    margin: 18px 0;\n  }\n  .article-content h3 {\n    font-size: 18px;\n    font-weight: bold;\n    margin: 16px 0;\n  }\n  .article-content p {\n    margin: 12px 0;\n    text-indent: 2em;\n  }\n  .article-content img {\n    max-width: 100%;\n    height: auto;\n    display: block;\n    margin: 15px auto;\n  }\n  .article-content strong {\n    font-weight: bold;\n    color: #1a1a1a;\n  }\n  .article-content em {\n    font-style: italic;\n  }\n  .article-content code {\n    background: #f5f5f5;\n    padding: 2px 6px;\n    border-radius: 3px;\n    font-family: Consolas, Monaco, \"Courier New\", monospace;\n  }\n  .article-content pre {\n    background: #f5f5f5;\n    padding: 12px;\n    border-radius: 5px;\n    overflow-x: auto;\n  }\n  .article-content blockquote {\n    border-left: 4px solid #ddd;\n    padding-left: 12px;\n    color: #666;\n    margin: 12px 0;\n  }\n  .article-content a {\n    color: #576b95;\n    text-decoration: none;\n  }\n  .article-content ul, .article-content ol {\n    margin: 12px 0;\n    padding-left: 2em;\n  }\n  .article-content li {\n    margin: 6px 0;\n  }\n</style>\n";
/**
 * HTML 节点主函数
 *
 * @param state - 当前状态
 * @returns 更新的状态
 */
function htmlNode(state) {
    return __awaiter(this, void 0, void 0, function () {
        var outputPath, finalDir, markdown, md, htmlContent, fullHtml, htmlPath, mdPath, imageCount;
        var _a;
        return __generator(this, function (_b) {
            console.log("[12_html] Converting Markdown to HTML...");
            if (!state.humanized) {
                console.error("[12_html] No humanized article to convert");
                throw new Error("Humanized article not found in state");
            }
            outputPath = state.outputPath || getDefaultOutputPath();
            finalDir = (0, path_1.join)(outputPath, "final");
            if (!(0, fs_1.existsSync)(finalDir)) {
                (0, fs_1.mkdirSync)(finalDir, { recursive: true });
            }
            console.log("[12_html] Processing article with ".concat(((_a = state.uploadedImageUrls) === null || _a === void 0 ? void 0 : _a.length) || 0, " images..."));
            markdown = state.humanized;
            markdown = replaceImagePlaceholders(markdown, state.uploadedImageUrls || []);
            md = new markdown_it_1.default({
                html: true, // 允许 HTML 标签
                linkify: true, // 自动转换 URL 为链接
                typographer: true
            });
            htmlContent = md.render(markdown);
            fullHtml = "<!DOCTYPE html>\n<html>\n<head>\n  <meta charset=\"UTF-8\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n  <title>\u6587\u7AE0</title>\n  ".concat(WECHAT_STYLES, "\n</head>\n<body>\n  <section class=\"article-content\">\n    ").concat(htmlContent, "\n  </section>\n</body>\n</html>");
            htmlPath = (0, path_1.join)(finalDir, "article.html");
            (0, fs_1.writeFileSync)(htmlPath, fullHtml, "utf-8");
            console.log("[12_html] Saved HTML:", htmlPath);
            mdPath = (0, path_1.join)(finalDir, "article.md");
            (0, fs_1.writeFileSync)(mdPath, markdown, "utf-8");
            console.log("[12_html] Saved Markdown:", mdPath);
            imageCount = (markdown.match(/!\[.*?\]\(.*?\)/g) || []).length;
            console.log("[12_html] Converted ".concat(imageCount, " images to CDN URLs"));
            return [2 /*return*/, {
                    htmlPath: htmlPath
                }];
        });
    });
}
/**
 * 替换图片索引为 CDN URL
 *
 * 匹配格式: ![描述](索引)
 * 例如: ![配图1](0) → ![配图1](http://mmbiz.qpic.cn/...)
 */
function replaceImagePlaceholders(markdown, uploadedUrls) {
    if (uploadedUrls.length === 0) {
        console.log("[12_html] No uploaded URLs, skipping image replacement");
        return markdown;
    }
    // 匹配图片占位符: ![描述](索引)
    var imagePattern = /!\[(.*?)\]\((\d+)\)/g;
    var replacementCount = 0;
    var result = markdown.replace(imagePattern, function (match, alt, indexStr) {
        var index = parseInt(indexStr, 10);
        // 检查索引是否有效
        if (index < 0 || index >= uploadedUrls.length) {
            console.warn("[12_html] Invalid image index: ".concat(index, " (available: 0-").concat(uploadedUrls.length - 1, ")"));
            // 保持原样或使用占位符
            return match;
        }
        var cdnUrl = uploadedUrls[index];
        if (!cdnUrl) {
            console.warn("[12_html] No CDN URL for index ".concat(index));
            return match;
        }
        replacementCount++;
        console.log("[12_html] Replaced [".concat(index, "] \u2192 ").concat(cdnUrl));
        // 替换为真实 URL
        return "![".concat(alt, "](").concat(cdnUrl, ")");
    });
    console.log("[12_html] Replaced ".concat(replacementCount, " image placeholders"));
    return result;
}
/**
 * 获取默认输出路径
 */
function getDefaultOutputPath() {
    var timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    var runId = "article-".concat(timestamp);
    return (0, path_1.join)(process.cwd(), "output", runId);
}
