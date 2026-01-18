"use strict";
/**
 * mcp-webresearch 适配器
 *
 * 职责: 使用 Playwright 进行 Google 搜索
 *
 * 优先级: 1 (第一优先级)
 *
 * 依赖:
 * - playwright (需要安装)
 *
 * 安装: npm install playwright
 * 初始化: npx playwright install chromium
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
exports.WebResearchAdapter = void 0;
exports.createWebResearchAdapter = createWebResearchAdapter;
var mcp_js_1 = require("./mcp.js");
/**
 * mcp-webresearch 适配器
 *
 * 使用 Playwright 驱动 Chromium 进行 Google 搜索
 */
var WebResearchAdapter = /** @class */ (function (_super) {
    __extends(WebResearchAdapter, _super);
    function WebResearchAdapter() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.browser = null;
        return _this;
    }
    /**
     * 执行 Google 搜索
     *
     * @param query - 搜索查询
     * @param limit - 结果数量限制
     * @returns 搜索结果
     */
    WebResearchAdapter.prototype.search = function (query_1) {
        return __awaiter(this, arguments, void 0, function (query, limit) {
            var _this = this;
            if (limit === void 0) { limit = 10; }
            return __generator(this, function (_a) {
                console.log("[WebResearch] \u5F00\u59CB Google \u641C\u7D22: \"".concat(query, "\""));
                return [2 /*return*/, this.callMCP("google_search", { query: query, limit: limit }, function () { return _this.searchViaPlaywright(query, limit); })];
            });
        });
    };
    /**
     * 使用 Playwright 进行 Google 搜索 (HTTP 降级)
     */
    WebResearchAdapter.prototype.searchViaPlaywright = function (query, limit) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, chromium, _a, context, page, searchUrl, results, duration, error_1, _b, errorMsg;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        startTime = Date.now();
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 11, , 17]);
                        return [4 /*yield*/, Promise.resolve().then(function () { return require("playwright"); })];
                    case 2:
                        chromium = (_c.sent()).chromium;
                        console.log("[WebResearch] 启动 Chromium...");
                        _a = this;
                        return [4 /*yield*/, chromium.launch({
                                headless: true,
                                args: ['--no-sandbox', '--disable-setuid-sandbox']
                            })];
                    case 3:
                        _a.browser = _c.sent();
                        return [4 /*yield*/, this.browser.newContext({
                                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                                viewport: { width: 1920, height: 1080 }
                            })];
                    case 4:
                        context = _c.sent();
                        return [4 /*yield*/, context.newPage()];
                    case 5:
                        page = _c.sent();
                        searchUrl = "https://www.google.com/search?q=".concat(encodeURIComponent(query));
                        console.log("[WebResearch] \u8BBF\u95EE: ".concat(searchUrl));
                        return [4 /*yield*/, page.goto(searchUrl, {
                                waitUntil: 'domcontentloaded',
                                timeout: 30000
                            })];
                    case 6:
                        _c.sent();
                        // 等待页面加载
                        return [4 /*yield*/, page.waitForTimeout(2000)];
                    case 7:
                        // 等待页面加载
                        _c.sent();
                        return [4 /*yield*/, page.evaluate(function () {
                                var items = [];
                                // 尝试多种选择器
                                var selectors = [
                                    "div.g", // 标准
                                    "div.tF2Cxc", // 新版
                                    "div.hlcw0c", // 另一种新版
                                    "div[data-hveid]" // 带属性的
                                ];
                                // @ts-ignore - Running in browser context
                                var doc = window.document;
                                for (var _i = 0, selectors_1 = selectors; _i < selectors_1.length; _i++) {
                                    var selector = selectors_1[_i];
                                    var elements = doc.querySelectorAll(selector);
                                    if (elements.length > 0) {
                                        elements.forEach(function (result) {
                                            var _a, _b;
                                            var titleEl = result.querySelector("h3") || result.querySelector("h2");
                                            var linkEl = result.querySelector("a");
                                            var snippetEl = result.querySelector(".VwiC3b") ||
                                                result.querySelector(".st") ||
                                                result.querySelector(".s") ||
                                                result.querySelector(".ITZIwc");
                                            if (titleEl && linkEl) {
                                                var title = ((_a = titleEl.textContent) === null || _a === void 0 ? void 0 : _a.trim()) || "";
                                                var url = linkEl.getAttribute("href") || "";
                                                var snippet = ((_b = snippetEl === null || snippetEl === void 0 ? void 0 : snippetEl.textContent) === null || _b === void 0 ? void 0 : _b.trim()) || "";
                                                if (title && url && !url.startsWith("#") && !url.startsWith("/search")) {
                                                    items.push({ title: title, url: url, snippet: snippet });
                                                }
                                            }
                                        });
                                        if (items.length > 0) {
                                            console.log("Found ".concat(items.length, " results with selector: ").concat(selector));
                                            break; // 找到结果就停止尝试其他选择器
                                        }
                                    }
                                }
                                return items;
                            })];
                    case 8:
                        results = _c.sent();
                        // 清理
                        return [4 /*yield*/, context.close()];
                    case 9:
                        // 清理
                        _c.sent();
                        return [4 /*yield*/, this.browser.close()];
                    case 10:
                        _c.sent();
                        this.browser = null;
                        duration = ((Date.now() - startTime) / 1000).toFixed(2);
                        console.log("[WebResearch] \u641C\u7D22\u5B8C\u6210: ".concat(results.length, " \u4E2A\u7ED3\u679C (").concat(duration, "s)"));
                        if (results.length === 0) {
                            console.warn("[WebResearch] 没有找到结果，可能被 Google 拦截或页面结构变化");
                        }
                        return [2 /*return*/, results.slice(0, limit)];
                    case 11:
                        error_1 = _c.sent();
                        if (!this.browser) return [3 /*break*/, 16];
                        _c.label = 12;
                    case 12:
                        _c.trys.push([12, 14, , 15]);
                        return [4 /*yield*/, this.browser.close()];
                    case 13:
                        _c.sent();
                        return [3 /*break*/, 15];
                    case 14:
                        _b = _c.sent();
                        return [3 /*break*/, 15];
                    case 15:
                        this.browser = null;
                        _c.label = 16;
                    case 16:
                        errorMsg = this.errorMessage(error_1);
                        console.error("[WebResearch] \u641C\u7D22\u5931\u8D25: ".concat(errorMsg));
                        throw new Error("Playwright search failed: ".concat(errorMsg));
                    case 17: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * 提取页面内容
     *
     * @param url - 页面 URL
     * @returns 页面 Markdown 内容
     */
    WebResearchAdapter.prototype.fetchPage = function (url) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                console.log("[WebResearch] \u6293\u53D6\u9875\u9762: ".concat(url));
                return [2 /*return*/, this.callMCP("fetch_page", { url: url }, function () { return _this.fetchPageViaPlaywright(url); })];
            });
        });
    };
    /**
     * 使用 Playwright 抓取页面内容
     */
    WebResearchAdapter.prototype.fetchPageViaPlaywright = function (url) {
        return __awaiter(this, void 0, void 0, function () {
            var chromium, browser, context, page, content, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 9, , 10]);
                        return [4 /*yield*/, Promise.resolve().then(function () { return require("playwright"); })];
                    case 1:
                        chromium = (_a.sent()).chromium;
                        return [4 /*yield*/, chromium.launch({ headless: true })];
                    case 2:
                        browser = _a.sent();
                        return [4 /*yield*/, browser.newContext()];
                    case 3:
                        context = _a.sent();
                        return [4 /*yield*/, context.newPage()];
                    case 4:
                        page = _a.sent();
                        return [4 /*yield*/, page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })];
                    case 5:
                        _a.sent();
                        return [4 /*yield*/, page.evaluate(function () {
                                var _a;
                                // @ts-ignore - Running in browser context
                                var doc = window.document;
                                // 移除脚本和样式
                                doc.querySelectorAll('script, style, nav, footer').forEach(function (el) { return el.remove(); });
                                return ((_a = doc.body) === null || _a === void 0 ? void 0 : _a.innerText) || "";
                            })];
                    case 6:
                        content = _a.sent();
                        return [4 /*yield*/, context.close()];
                    case 7:
                        _a.sent();
                        return [4 /*yield*/, browser.close()];
                    case 8:
                        _a.sent();
                        return [2 /*return*/, content];
                    case 9:
                        error_2 = _a.sent();
                        throw new Error("Failed to fetch page: ".concat(this.errorMessage(error_2)));
                    case 10: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * 健康检查
     */
    WebResearchAdapter.prototype.healthCheck = function () {
        return __awaiter(this, void 0, void 0, function () {
            var baseCheck, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, _super.prototype.healthCheck.call(this)];
                    case 1:
                        baseCheck = _b.sent();
                        _b.label = 2;
                    case 2:
                        _b.trys.push([2, 4, , 5]);
                        // 检查 playwright 是否可用
                        return [4 /*yield*/, Promise.resolve().then(function () { return require("playwright"); })];
                    case 3:
                        // 检查 playwright 是否可用
                        _b.sent();
                        return [2 /*return*/, {
                                success: true,
                                data: __assign(__assign({}, baseCheck.data), { playwright: true })
                            }];
                    case 4:
                        _a = _b.sent();
                        return [2 /*return*/, {
                                success: true,
                                data: __assign(__assign({}, baseCheck.data), { playwright: false })
                            }];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    return WebResearchAdapter;
}(mcp_js_1.MCPAdapter));
exports.WebResearchAdapter = WebResearchAdapter;
/**
 * 创建默认实例
 */
function createWebResearchAdapter() {
    return new WebResearchAdapter();
}
