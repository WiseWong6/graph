"use strict";
/**
 * RAG 节点
 *
 * 职责: 基于调研 Brief，从本地知识库检索相关素材
 *
 * 数据流:
 * researchResult (Brief) → 提取关键词 → 并行检索 → 生成 RAG 内容 → 文件落盘
 *
 * 设计原则:
 * - 并行检索多个库（金句、文章、标题）
 * - 统一格式化输出
 * - 不破坏现有数据
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
exports.ragNode = ragNode;
var fs_1 = require("fs");
var path_1 = require("path");
var index_manager_js_1 = require("../../../rag/index/index-manager.js");
var rag_formatter_js_1 = require("../../../rag/utils/rag-formatter.js");
/**
 * RAG 节点主函数
 *
 * @param state - 当前状态
 * @returns 更新的状态
 */
function ragNode(state) {
    return __awaiter(this, void 0, void 0, function () {
        var startTime, manager, keywords, query, _a, quotes, articles, titles, retrievalTime, ragData, ragMarkdown, outputPath, researchDir, ragPath;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    startTime = Date.now();
                    console.log("[02_rag] Starting RAG retrieval for:", state.topic);
                    // ========== 步骤 1: 加载索引 ==========
                    console.log("[02_rag] Step 1: Loading indices...");
                    manager = index_manager_js_1.default.getInstance();
                    return [4 /*yield*/, manager.loadIndices()];
                case 1:
                    _b.sent();
                    if (!manager.isReady()) {
                        console.warn("[02_rag] ⚠️ 索引未就绪，返回空内容");
                        return [2 /*return*/, {
                                ragContent: "# RAG 检索结果\n\n⚠️ 索引未初始化，请先运行: npm run build-indices"
                            }];
                    }
                    // ========== 步骤 2: 提取关键词 ==========
                    console.log("[02_rag] Step 2: Extracting keywords from Brief...");
                    keywords = (0, rag_formatter_js_1.extractKeywords)(state.researchResult || "");
                    console.log("[02_rag] Extracted ".concat(keywords.length, " keywords: ").concat(keywords.slice(0, 5).join(", "), "..."));
                    query = (0, rag_formatter_js_1.buildQuery)(state.topic, keywords);
                    console.log("[02_rag] Query: ".concat(query));
                    // ========== 步骤 3: 并行检索 ==========
                    console.log("[02_rag] Step 3: Parallel retrieval...");
                    return [4 /*yield*/, Promise.all([
                            manager.retrieveQuotes(query, { topK: 3 }),
                            manager.retrieveArticles(query, { topK: 2 }),
                            manager.retrieveTitles(query, { topK: 10 })
                        ])];
                case 2:
                    _a = _b.sent(), quotes = _a[0], articles = _a[1], titles = _a[2];
                    console.log("[02_rag] Retrieved:");
                    console.log("  - ".concat(quotes.length, " quotes"));
                    console.log("  - ".concat(articles.length, " articles"));
                    console.log("  - ".concat(titles.length, " titles"));
                    // ========== 步骤 4: 生成 RAG 内容 ==========
                    console.log("[02_rag] Step 4: Generating RAG content...");
                    retrievalTime = Date.now() - startTime;
                    ragData = {
                        topic: state.topic,
                        quotes: quotes,
                        articles: articles,
                        titles: titles,
                        stats: {
                            quotesCount: quotes.length,
                            articlesCount: articles.length,
                            titlesCount: titles.length,
                            retrievalTime: retrievalTime
                        }
                    };
                    ragMarkdown = (0, rag_formatter_js_1.formatRAGContent)(ragData);
                    console.log("[02_rag] RAG content generated:");
                    console.log("  ".concat(quotes.length, " quotes, ").concat(articles.length, " articles, ").concat(titles.length, " titles"));
                    console.log("  Time: ".concat(retrievalTime, "ms"));
                    // ========== 步骤 5: 保存文件 ==========
                    console.log("[02_rag] Step 5: Saving files...");
                    outputPath = state.outputPath || getDefaultOutputPath();
                    researchDir = (0, path_1.join)(outputPath, "research");
                    // 确保目录存在
                    (0, fs_1.mkdirSync)(researchDir, { recursive: true });
                    ragPath = (0, path_1.join)(researchDir, "01_rag_content.md");
                    (0, fs_1.writeFileSync)(ragPath, ragMarkdown, "utf-8");
                    console.log("[02_rag] Saved RAG content: ".concat(ragPath));
                    console.log("[02_rag] Total time: ".concat(((Date.now() - startTime) / 1000).toFixed(2), "s"));
                    return [2 /*return*/, {
                            ragContent: ragMarkdown,
                            outputPath: outputPath
                        }];
            }
        });
    });
}
/**
 * 获取默认输出路径
 */
function getDefaultOutputPath() {
    var timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    var runId = "article-".concat(timestamp);
    return (0, path_1.join)(process.cwd(), "output", runId);
}
