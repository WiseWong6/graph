"use strict";
/**
 * 并行搜索管理器
 *
 * 职责: 协调多个搜索源，实现并行搜索和智能降级
 *
 * 优先级顺序:
 * 1. mcp-webresearch (Google 搜索，第一优先级)
 * 2. Firecrawl (付费搜索，第二优先级)
 *
 * 策略:
 * - 并行执行所有搜索
 * - 按优先级顺序合并结果
 * - 如果优先级高的结果不足，补充低优先级结果
 * - 去重基于 URL
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParallelSearchManager = void 0;
exports.createParallelSearchManager = createParallelSearchManager;
var mcp_webresearch_js_1 = require("./mcp-webresearch.js");
var firecrawl_js_1 = require("./firecrawl.js");
/**
 * 并行搜索管理器
 */
var ParallelSearchManager = /** @class */ (function () {
    function ParallelSearchManager() {
        this.strategies = this.buildStrategies();
    }
    /**
     * 构建搜索策略
     */
    ParallelSearchManager.prototype.buildStrategies = function () {
        var _this = this;
        var strategies = [
            {
                name: "webresearch",
                priority: 1,
                search: function (query, limit) { return __awaiter(_this, void 0, void 0, function () {
                    var adapter, result;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                adapter = new mcp_webresearch_js_1.WebResearchAdapter();
                                return [4 /*yield*/, adapter.search(query, limit)];
                            case 1:
                                result = _a.sent();
                                if (result.success && result.data) {
                                    return [2 /*return*/, result.data.map(function (r) { return (__assign(__assign({}, r), { source: "webresearch" })); })];
                                }
                                return [2 /*return*/, []];
                        }
                    });
                }); }
            }
        ];
        // 仅在有 API Key 时启用 Firecrawl
        if (process.env.FIRECRAWL_API_KEY) {
            strategies.push({
                name: "firecrawl",
                priority: 2,
                search: function (query, limit) { return __awaiter(_this, void 0, void 0, function () {
                    var adapter, result;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                adapter = new firecrawl_js_1.FirecrawlAdapter();
                                return [4 /*yield*/, adapter.search(query, { limit: limit })];
                            case 1:
                                result = _a.sent();
                                if (result.success && result.data) {
                                    return [2 /*return*/, result.data.map(function (r) { return ({
                                            title: r.title,
                                            url: r.url,
                                            snippet: r.description || r.snippet || "",
                                            source: "firecrawl",
                                            score: r.score
                                        }); })];
                                }
                                return [2 /*return*/, []];
                        }
                    });
                }); }
            });
        }
        return strategies.sort(function (a, b) { return a.priority - b.priority; });
    };
    /**
     * 并行搜索
     *
     * @param query - 搜索查询
     * @param options - 搜索选项
     * @returns 搜索结果
     */
    ParallelSearchManager.prototype.parallelSearch = function (query_1) {
        return __awaiter(this, arguments, void 0, function (query, options) {
            var _a, limit, _b, timeout, _c, minResults, _d, enableFirecrawl, startTime, promises, outcomes, merged, duration;
            var _this = this;
            if (options === void 0) { options = {}; }
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        _a = options.limit, limit = _a === void 0 ? 10 : _a, _b = options.timeout, timeout = _b === void 0 ? 8000 : _b, _c = options.minResults, minResults = _c === void 0 ? 3 : _c, _d = options.enableFirecrawl, enableFirecrawl = _d === void 0 ? !!process.env.FIRECRAWL_API_KEY : _d;
                        console.log("[ParallelSearch] \u5F00\u59CB\u5E76\u884C\u641C\u7D22: \"".concat(query, "\""));
                        console.log("[ParallelSearch] \u914D\u7F6E: limit=".concat(limit, ", timeout=").concat(timeout, "ms, minResults=").concat(minResults));
                        console.log("[ParallelSearch] \u53EF\u7528\u7B56\u7565: ".concat(this.strategies.map(function (s) { return s.name; }).join(", ")));
                        startTime = Date.now();
                        promises = this.strategies
                            .filter(function (s) { return s.name !== "firecrawl" || enableFirecrawl; })
                            .map(function (strategy) { return __awaiter(_this, void 0, void 0, function () {
                            var searchPromise, timeoutPromise, results, error_1;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        _a.trys.push([0, 2, , 3]);
                                        searchPromise = strategy.search(query, limit);
                                        timeoutPromise = new Promise(function (_, reject) {
                                            return setTimeout(function () { return reject(new Error("Timeout after ".concat(timeout, "ms"))); }, timeout);
                                        });
                                        return [4 /*yield*/, Promise.race([searchPromise, timeoutPromise])];
                                    case 1:
                                        results = _a.sent();
                                        return [2 /*return*/, {
                                                strategy: strategy.name,
                                                results: results,
                                                success: true
                                            }];
                                    case 2:
                                        error_1 = _a.sent();
                                        console.warn("[ParallelSearch] ".concat(strategy.name, " \u641C\u7D22\u5931\u8D25:"), this.errorMessage(error_1));
                                        return [2 /*return*/, {
                                                strategy: strategy.name,
                                                results: [],
                                                success: false
                                            }];
                                    case 3: return [2 /*return*/];
                                }
                            });
                        }); });
                        return [4 /*yield*/, Promise.all(promises)];
                    case 1:
                        outcomes = _e.sent();
                        merged = this.mergeResults(outcomes, minResults, limit);
                        duration = Date.now() - startTime;
                        console.log("[ParallelSearch] \u641C\u7D22\u5B8C\u6210: ".concat(merged.results.length, " \u4E2A\u7ED3\u679C (").concat(duration, "ms)"));
                        console.log("[ParallelSearch] \u6570\u636E\u6E90: ".concat(merged.sources.join(", ")));
                        return [2 /*return*/, {
                                results: merged.results,
                                sources: merged.sources,
                                metadata: {
                                    total: merged.results.length,
                                    bySource: merged.bySource,
                                    duration: duration
                                }
                            }];
                }
            });
        });
    };
    /**
     * 合并搜索结果
     *
     * 按优先级顺序合并，当高优先级结果不足时，补充低优先级结果
     */
    ParallelSearchManager.prototype.mergeResults = function (outcomes, minResults, limit) {
        var allResults = [];
        var sources = [];
        var bySource = {};
        // 按优先级顺序处理
        var priorityOrder = ["webresearch", "firecrawl"];
        var _loop_1 = function (name_1) {
            var outcome = outcomes.find(function (o) { return o.strategy === name_1; });
            if ((outcome === null || outcome === void 0 ? void 0 : outcome.success) && outcome.results.length > 0) {
                // 只有当现有结果不足时，才添加低优先级结果
                if (allResults.length < minResults || name_1 === "webresearch") {
                    allResults.push.apply(allResults, outcome.results);
                    sources.push(name_1);
                    bySource[name_1] = outcome.results.length;
                }
                else {
                    console.log("[ParallelSearch] ".concat(name_1, " \u7ED3\u679C\u5DF2\u8DB3\u591F\uFF0C\u8DF3\u8FC7"));
                    bySource[name_1] = 0;
                }
            }
        };
        for (var _i = 0, priorityOrder_1 = priorityOrder; _i < priorityOrder_1.length; _i++) {
            var name_1 = priorityOrder_1[_i];
            _loop_1(name_1);
        }
        // 去重 (基于 URL)
        var seen = new Set();
        var deduplicated = allResults.filter(function (r) {
            if (seen.has(r.url))
                return false;
            seen.add(r.url);
            return true;
        });
        return {
            results: deduplicated.slice(0, limit),
            sources: sources,
            bySource: bySource
        };
    };
    /**
     * 提取错误信息
     */
    ParallelSearchManager.prototype.errorMessage = function (error) {
        if (error instanceof Error) {
            return error.message;
        }
        return String(error);
    };
    /**
     * 健康检查
     *
     * 检查所有搜索策略的可用性
     */
    ParallelSearchManager.prototype.healthCheck = function () {
        return __awaiter(this, void 0, void 0, function () {
            var checks;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, Promise.allSettled([
                            new mcp_webresearch_js_1.WebResearchAdapter().healthCheck(),
                            process.env.FIRECRAWL_API_KEY
                                ? new firecrawl_js_1.FirecrawlAdapter().healthCheck()
                                : Promise.resolve({ success: true, data: { available: false, mode: "http" } })
                        ])];
                    case 1:
                        checks = _b.sent();
                        return [2 /*return*/, {
                                webresearch: checks[0].status === "fulfilled" && checks[0].value.success,
                                firecrawl: checks[1].status === "fulfilled" && !!((_a = checks[1].value.data) === null || _a === void 0 ? void 0 : _a.available)
                            }];
                }
            });
        });
    };
    return ParallelSearchManager;
}());
exports.ParallelSearchManager = ParallelSearchManager;
/**
 * 创建默认实例
 */
function createParallelSearchManager() {
    return new ParallelSearchManager();
}
