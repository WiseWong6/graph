"use strict";
/**
 * Firecrawl 适配器
 *
 * 提供网页搜索和抓取功能:
 * - search: 搜索相关网页
 * - scrape: 抓取单个网页内容
 * - crawl: 爬取整个网站
 *
 * 支持降级: MCP → Firecrawl HTTP API
 */
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
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
exports.FirecrawlAdapter = void 0;
exports.createFirecrawlAdapter = createFirecrawlAdapter;
var mcp_1 = require("./mcp");
/**
 * Firecrawl 适配器类
 *
 * 使用方式:
 * ```ts
 * const adapter = new FirecrawlAdapter({ apiKey: 'xxx' });
 * const result = await adapter.search('AI Agent 最新进展');
 * if (result.success) {
 *   console.log(result.data);
 * }
 * ```
 */
var FirecrawlAdapter = /** @class */ (function (_super) {
    __extends(FirecrawlAdapter, _super);
    function FirecrawlAdapter(config) {
        if (config === void 0) { config = {}; }
        var _this = _super.call(this) || this;
        // Firecrawl API 端点
        _this.DEFAULT_API_URL = "https://api.firecrawl.dev/v1";
        _this.SEARCH_ENDPOINT = "/search";
        _this.SCRAPE_ENDPOINT = "/scrape";
        _this.config = {
            apiKey: config.apiKey || process.env.FIRECRAWL_API_KEY,
            apiUrl: config.apiUrl || _this.DEFAULT_API_URL
        };
        return _this;
    }
    /**
     * 搜索网页
     *
     * @param query - 搜索查询
     * @param options - 搜索选项
     */
    FirecrawlAdapter.prototype.search = function (query_1) {
        return __awaiter(this, arguments, void 0, function (query, options) {
            var _this = this;
            if (options === void 0) { options = {}; }
            return __generator(this, function (_a) {
                return [2 /*return*/, this.callMCP("firecrawl_search", __assign({ query: query }, options), function () { return _this.searchFallback(query, options); })];
            });
        });
    };
    /**
     * 抓取单个网页
     *
     * @param url - 要抓取的 URL
     */
    FirecrawlAdapter.prototype.scrape = function (url) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, this.callMCP("firecrawl_scrape", { url: url }, function () { return _this.scrapeFallback(url); })];
            });
        });
    };
    /**
     * 降级: 通过 HTTP API 搜索
     */
    FirecrawlAdapter.prototype.searchFallback = function (query, options) {
        return __awaiter(this, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.config.apiKey) {
                            throw new Error("Firecrawl API key not configured");
                        }
                        return [4 /*yield*/, (0, mcp_1.httpPost)("".concat(this.config.apiUrl).concat(this.SEARCH_ENDPOINT), {
                                query: query,
                                limit: options.limit || 10
                            }, {
                                Authorization: "Bearer ".concat(this.config.apiKey)
                            })];
                    case 1:
                        response = _a.sent();
                        if (!response.success) {
                            throw new Error(response.error || "Firecrawl search failed");
                        }
                        return [2 /*return*/, response.data || []];
                }
            });
        });
    };
    /**
     * 降级: 通过 HTTP API 抓取
     */
    FirecrawlAdapter.prototype.scrapeFallback = function (url) {
        return __awaiter(this, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.config.apiKey) {
                            throw new Error("Firecrawl API key not configured");
                        }
                        return [4 /*yield*/, (0, mcp_1.httpPost)("".concat(this.config.apiUrl).concat(this.SCRAPE_ENDPOINT), {
                                url: url,
                                formats: ["markdown", "html"]
                            }, {
                                Authorization: "Bearer ".concat(this.config.apiKey)
                            })];
                    case 1:
                        response = _a.sent();
                        if (!response.success) {
                            throw new Error(response.error || "Firecrawl scrape failed");
                        }
                        if (!response.data) {
                            throw new Error("No data returned from Firecrawl");
                        }
                        return [2 /*return*/, response.data];
                }
            });
        });
    };
    /**
     * 原生 MCP 调用（在 Claude Code 中）
     *
     * 注意: 这是占位实现。在 Claude Code 中，
     * 实际的 MCP 调用由系统处理，不需要手动实现。
     */
    FirecrawlAdapter.prototype.callNativeMCP = function (toolName, _params) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                // 在 Claude Code 中，MCP 工具会自动被系统调用
                // 这里我们抛出错误，让 callMCP 使用降级方案
                throw new Error("Native MCP call for ".concat(toolName, " not available in standalone mode"));
            });
        });
    };
    return FirecrawlAdapter;
}(mcp_1.MCPAdapter));
exports.FirecrawlAdapter = FirecrawlAdapter;
/**
 * 创建默认的 Firecrawl 适配器实例
 */
function createFirecrawlAdapter() {
    return new FirecrawlAdapter({
        apiKey: process.env.FIRECRAWL_API_KEY
    });
}
