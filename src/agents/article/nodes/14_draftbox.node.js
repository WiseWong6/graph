"use strict";
/**
 * Draftbox 节点
 *
 * 职责: 发布文章到微信公众号草稿箱
 *
 * 数据流:
 * htmlPath + selectedTitle + wechatConfig → 微信 API → draftbox URL
 *
 * 设计原则:
 * - 调用微信 API
 * - 返回草稿箱链接
 * - 错误处理
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
exports.draftboxNode = draftboxNode;
var fs_1 = require("fs");
var mcp_js_1 = require("../../../adapters/mcp.js");
/**
 * Draftbox 节点主函数
 *
 * @param state - 当前状态
 * @returns 更新的状态
 */
function draftboxNode(state) {
    return __awaiter(this, void 0, void 0, function () {
        var title, htmlContent, result, error_1;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    console.log("[13_draftbox] Publishing to WeChat draftbox...");
                    if (!state.htmlPath) {
                        console.error("[13_draftbox] No HTML path found");
                        throw new Error("HTML path not found in state");
                    }
                    title = ((_a = state.decisions) === null || _a === void 0 ? void 0 : _a.selectedTitle) || ((_b = state.titles) === null || _b === void 0 ? void 0 : _b[0]) || "未命名文章";
                    // 读取 HTML 内容
                    if (!(0, fs_1.existsSync)(state.htmlPath)) {
                        console.error("[13_draftbox] HTML file not found: ".concat(state.htmlPath));
                        throw new Error("HTML file not found: ".concat(state.htmlPath));
                    }
                    htmlContent = (0, fs_1.readFileSync)(state.htmlPath, "utf-8");
                    console.log("[13_draftbox] Title: ".concat(title));
                    console.log("[13_draftbox] HTML length: ".concat(htmlContent.length, " chars"));
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, publishToDraftbox(title, htmlContent)];
                case 2:
                    result = _c.sent();
                    console.log("[13_draftbox] Published successfully!");
                    console.log("[13_draftbox] Draft URL: ".concat(result.draft_url));
                    console.log("[13_draftbox] Media ID: ".concat(result.media_id));
                    return [2 /*return*/, {
                            status: "completed"
                        }];
                case 3:
                    error_1 = _c.sent();
                    console.error("[13_draftbox] Failed to publish: ".concat(error_1));
                    throw error_1;
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * 发布到草稿箱
 */
function publishToDraftbox(title, htmlContent) {
    return __awaiter(this, void 0, void 0, function () {
        var config, token, draftData, response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    config = getWechatConfig();
                    return [4 /*yield*/, getAccessToken(config)];
                case 1:
                    token = _a.sent();
                    draftData = {
                        articles: [{
                                title: title,
                                content: htmlContent,
                                digest: extractDigest(htmlContent), // 摘要
                                author: "AI Assistant",
                                show_cover_pic: 0
                            }]
                    };
                    return [4 /*yield*/, (0, mcp_js_1.httpPost)("".concat(config.apiUrl, "/cgi-bin/draft/add?access_token=").concat(token), draftData, {
                            "Content-Type": "application/json"
                        })];
                case 2:
                    response = _a.sent();
                    if (!response.success || !response.data) {
                        throw new Error(response.error || "Failed to publish to draftbox");
                    }
                    return [2 /*return*/, {
                            draft_url: response.data.draft_url,
                            media_id: response.data.media_id
                        }];
            }
        });
    });
}
/**
 * 获取 access_token
 */
function getAccessToken(config) {
    return __awaiter(this, void 0, void 0, function () {
        var response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, mcp_js_1.httpPost)("".concat(config.apiUrl, "/cgi-bin/token"), {
                        grant_type: "client_credential",
                        appid: config.appId,
                        secret: config.appSecret
                    })];
                case 1:
                    response = _a.sent();
                    return [2 /*return*/, response.access_token];
            }
        });
    });
}
/**
 * 提取摘要
 */
function extractDigest(html) {
    // 移除 HTML 标签
    var text = html.replace(/<[^>]*>/g, "");
    // 取前 120 字作为摘要
    return text.length > 120
        ? text.substring(0, 120) + "..."
        : text;
}
/**
 * 获取微信配置
 */
function getWechatConfig() {
    var appId = process.env.WECHAT_APP_ID;
    var appSecret = process.env.WECHAT_APP_SECRET;
    if (!appId || !appSecret) {
        throw new Error("WECHAT_APP_ID and WECHAT_APP_SECRET must be set");
    }
    return {
        appId: appId,
        appSecret: appSecret,
        apiUrl: process.env.WECHAT_API_URL || "https://api.weixin.qq.com"
    };
}
