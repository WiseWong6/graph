"use strict";
/**
 * 索引管理器（单例模式）
 *
 * 职责：
 * 1. 加载/创建索引
 * 2. 提供统一的检索接口
 * 3. 持久化索引到本地
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
var llamaindex_1 = require("llamaindex");
var lancedb_js_1 = require("../vector-store/lancedb.js");
var path_1 = require("path");
var fs_1 = require("fs");
var IndexManager = /** @class */ (function () {
    function IndexManager() {
        this.quotesIndex = null;
        this.articlesIndex = null;
        this.titlesData = [];
        this.indicesLoaded = false; // 防止重复加载
        this.loadPromise = null; // 防止并发加载
        // 默认路径
        this.indicesDir = (0, path_1.join)(process.cwd(), ".index");
        this.dataDir = (0, path_1.join)(process.cwd(), "data");
    }
    IndexManager.getInstance = function () {
        if (!IndexManager.instance) {
            IndexManager.instance = new IndexManager();
        }
        return IndexManager.instance;
    };
    /**
     * 设置路径
     */
    IndexManager.prototype.setPaths = function (indicesDir, dataDir) {
        this.indicesDir = indicesDir;
        this.dataDir = dataDir;
    };
    /**
     * 加载所有索引
     *
     * 幂等性保证：
     * - 已加载时直接返回
     * - 正在加载时等待同一 Promise
     * - 防止并发节点重复加载
     */
    IndexManager.prototype.loadIndices = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                // 如果已加载，直接返回
                if (this.indicesLoaded) {
                    return [2 /*return*/];
                }
                // 如果正在加载，等待同一个 Promise
                if (this.loadPromise) {
                    return [2 /*return*/, this.loadPromise];
                }
                // 开始加载
                this.loadPromise = (function () { return __awaiter(_this, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                console.log("[IndexManager] 开始加载索引...");
                                // 加载金句库索引
                                return [4 /*yield*/, this.loadQuotesIndex()];
                            case 1:
                                // 加载金句库索引
                                _a.sent();
                                // 加载文章库索引
                                return [4 /*yield*/, this.loadArticlesIndex()];
                            case 2:
                                // 加载文章库索引
                                _a.sent();
                                // 加载标题库数据（BM25 不需要向量索引）
                                return [4 /*yield*/, this.loadTitlesData()];
                            case 3:
                                // 加载标题库数据（BM25 不需要向量索引）
                                _a.sent();
                                this.indicesLoaded = true;
                                this.loadPromise = null;
                                console.log("[IndexManager] ✅ 所有索引加载完成");
                                return [2 /*return*/];
                        }
                    });
                }); })();
                return [2 /*return*/, this.loadPromise];
            });
        });
    };
    /**
     * 加载金句库索引
     */
    IndexManager.prototype.loadQuotesIndex = function () {
        return __awaiter(this, void 0, void 0, function () {
            var indexDir, storageContext, _a, error_1;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        indexDir = (0, path_1.join)(this.indicesDir, "golden_quotes");
                        if (!(0, fs_1.existsSync)(indexDir)) {
                            console.warn("[IndexManager] \u26A0\uFE0F \u91D1\u53E5\u5E93\u7D22\u5F15\u4E0D\u5B58\u5728: ".concat(indexDir));
                            console.warn("[IndexManager] \u8BF7\u5148\u8FD0\u884C: npm run build-indices");
                            return [2 /*return*/];
                        }
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 4, , 5]);
                        return [4 /*yield*/, (0, llamaindex_1.storageContextFromDefaults)({
                                persistDir: indexDir
                            })];
                    case 2:
                        storageContext = _b.sent();
                        _a = this;
                        return [4 /*yield*/, llamaindex_1.VectorStoreIndex.init({
                                storageContext: storageContext
                            })];
                    case 3:
                        _a.quotesIndex = _b.sent();
                        console.log("[IndexManager] ✅ 金句库索引加载成功");
                        return [3 /*break*/, 5];
                    case 4:
                        error_1 = _b.sent();
                        console.error("[IndexManager] \u274C \u91D1\u53E5\u5E93\u7D22\u5F15\u52A0\u8F7D\u5931\u8D25: ".concat(error_1));
                        return [3 /*break*/, 5];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * 加载文章库索引
     */
    IndexManager.prototype.loadArticlesIndex = function () {
        return __awaiter(this, void 0, void 0, function () {
            var indexDir, lanceDbUri, useLanceDB, storageContext, vectorStore, _a, error_2;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        indexDir = (0, path_1.join)(this.indicesDir, "articles");
                        lanceDbUri = (0, path_1.join)(indexDir, "lancedb");
                        if (!(0, fs_1.existsSync)(indexDir)) {
                            console.warn("[IndexManager] \u26A0\uFE0F \u6587\u7AE0\u5E93\u7D22\u5F15\u4E0D\u5B58\u5728: ".concat(indexDir));
                            console.warn("[IndexManager] \u8BF7\u5148\u8FD0\u884C: npm run build-indices");
                            return [2 /*return*/];
                        }
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 8, , 9]);
                        useLanceDB = (0, fs_1.existsSync)(lanceDbUri);
                        storageContext = void 0;
                        if (!useLanceDB) return [3 /*break*/, 4];
                        console.log("[IndexManager] 检测到 LanceDB，正在加载...");
                        vectorStore = new lancedb_js_1.LanceDBVectorStore({
                            uri: lanceDbUri,
                            tableName: "articles"
                        });
                        return [4 /*yield*/, vectorStore.init()];
                    case 2:
                        _b.sent();
                        return [4 /*yield*/, (0, llamaindex_1.storageContextFromDefaults)({
                                persistDir: indexDir,
                                vectorStore: vectorStore
                            })];
                    case 3:
                        storageContext = _b.sent();
                        return [3 /*break*/, 6];
                    case 4: return [4 /*yield*/, (0, llamaindex_1.storageContextFromDefaults)({
                            persistDir: indexDir
                        })];
                    case 5:
                        storageContext = _b.sent();
                        _b.label = 6;
                    case 6:
                        _a = this;
                        return [4 /*yield*/, llamaindex_1.VectorStoreIndex.init({
                                storageContext: storageContext
                            })];
                    case 7:
                        _a.articlesIndex = _b.sent();
                        console.log("[IndexManager] \u2705 \u6587\u7AE0\u5E93\u7D22\u5F15\u52A0\u8F7D\u6210\u529F (".concat(useLanceDB ? "LanceDB" : "SimpleVectorStore", ")"));
                        return [3 /*break*/, 9];
                    case 8:
                        error_2 = _b.sent();
                        console.error("[IndexManager] \u274C \u6587\u7AE0\u5E93\u7D22\u5F15\u52A0\u8F7D\u5931\u8D25: ".concat(error_2));
                        return [3 /*break*/, 9];
                    case 9: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * 加载标题库数据（简单 JSONL，用于关键词匹配）
     */
    IndexManager.prototype.loadTitlesData = function () {
        return __awaiter(this, void 0, void 0, function () {
            var titlesFile, readFileSync, content, lines, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        titlesFile = (0, path_1.join)(this.dataDir, "article_titles.jsonl");
                        if (!(0, fs_1.existsSync)(titlesFile)) {
                            console.warn("[IndexManager] \u26A0\uFE0F \u6807\u9898\u5E93\u6587\u4EF6\u4E0D\u5B58\u5728: ".concat(titlesFile));
                            return [2 /*return*/];
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, Promise.resolve().then(function () { return require("fs"); })];
                    case 2:
                        readFileSync = (_a.sent()).readFileSync;
                        content = readFileSync(titlesFile, "utf-8");
                        lines = content.split("\n").filter(function (line) { return line.trim(); });
                        this.titlesData = lines.map(function (line) {
                            var data = JSON.parse(line);
                            return {
                                title: data.title,
                                source: data.source_file
                            };
                        });
                        console.log("[IndexManager] \u2705 \u6807\u9898\u5E93\u52A0\u8F7D\u6210\u529F: ".concat(this.titlesData.length, " \u4E2A\u6807\u9898"));
                        return [3 /*break*/, 4];
                    case 3:
                        error_3 = _a.sent();
                        console.error("[IndexManager] \u274C \u6807\u9898\u5E93\u52A0\u8F7D\u5931\u8D25: ".concat(error_3));
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * 检索金句（向量检索）
     */
    IndexManager.prototype.retrieveQuotes = function (query, options) {
        return __awaiter(this, void 0, void 0, function () {
            var topK, retriever, results, error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.quotesIndex) {
                            console.warn("[IndexManager] 金句库未加载，返回空结果");
                            return [2 /*return*/, []];
                        }
                        topK = (options === null || options === void 0 ? void 0 : options.topK) || 5;
                        retriever = this.quotesIndex.asRetriever({ similarityTopK: topK });
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, retriever.retrieve(query)];
                    case 2:
                        results = _a.sent();
                        return [2 /*return*/, results.map(function (r) { return ({
                                content: r.node.text || r.node.getContent(llamaindex_1.MetadataMode.ALL),
                                metadata: r.node.metadata,
                                score: r.score
                            }); })];
                    case 3:
                        error_4 = _a.sent();
                        console.error("[IndexManager] \u91D1\u53E5\u68C0\u7D22\u5931\u8D25: ".concat(error_4));
                        return [2 /*return*/, []];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * 检索文章（向量检索）
     */
    IndexManager.prototype.retrieveArticles = function (query, options) {
        return __awaiter(this, void 0, void 0, function () {
            var topK, retriever, results, error_5;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.articlesIndex) {
                            console.warn("[IndexManager] 文章库未加载，返回空结果");
                            return [2 /*return*/, []];
                        }
                        topK = (options === null || options === void 0 ? void 0 : options.topK) || 3;
                        retriever = this.articlesIndex.asRetriever({ similarityTopK: topK });
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, retriever.retrieve(query)];
                    case 2:
                        results = _a.sent();
                        return [2 /*return*/, results.map(function (r) { return ({
                                content: r.node.text || r.node.getContent(llamaindex_1.MetadataMode.ALL),
                                metadata: r.node.metadata,
                                score: r.score
                            }); })];
                    case 3:
                        error_5 = _a.sent();
                        console.error("[IndexManager] \u6587\u7AE0\u68C0\u7D22\u5931\u8D25: ".concat(error_5));
                        return [2 /*return*/, []];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * 检索标题（关键词匹配）
     */
    IndexManager.prototype.retrieveTitles = function (query, options) {
        return __awaiter(this, void 0, void 0, function () {
            var topK, keywords, scored;
            return __generator(this, function (_a) {
                if (this.titlesData.length === 0) {
                    console.warn("[IndexManager] 标题库未加载，返回空结果");
                    return [2 /*return*/, []];
                }
                topK = (options === null || options === void 0 ? void 0 : options.topK) || 10;
                keywords = this.extractKeywords(query);
                scored = this.titlesData.map(function (title) {
                    var score = 0;
                    for (var _i = 0, keywords_1 = keywords; _i < keywords_1.length; _i++) {
                        var keyword = keywords_1[_i];
                        if (title.title.includes(keyword)) {
                            score += 1;
                        }
                    }
                    return __assign(__assign({}, title), { score: score });
                }).filter(function (t) { return t.score > 0; });
                scored.sort(function (a, b) { return b.score - a.score; });
                return [2 /*return*/, scored.slice(0, topK)];
            });
        });
    };
    /**
     * 提取中文关键词
     */
    IndexManager.prototype.extractKeywords = function (text) {
        // 简单实现：提取 2-4 字的中文词汇
        var matches = text.match(/[\u4e00-\u9fa5]{2,4}/g) || [];
        return __spreadArray([], new Set(matches), true);
    };
    /**
     * 检查索引是否已加载
     */
    IndexManager.prototype.isReady = function () {
        return this.quotesIndex !== null ||
            this.articlesIndex !== null ||
            this.titlesData.length > 0;
    };
    return IndexManager;
}());
exports.default = IndexManager;
