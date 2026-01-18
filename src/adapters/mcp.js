"use strict";
/**
 * MCP (Model Context Protocol) 适配器基类
 *
 * 职责:
 * - 检测运行环境（Claude Code vs 独立运行）
 * - 提供统一的 MCP 调用接口
 * - 自动降级到 HTTP API
 *
 * 设计原则:
 * - 优先使用原生 MCP（在 Claude Code 中）
 * - 降级到直接 HTTP 调用（独立运行）
 * - 统一错误处理
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
exports.MCPAdapter = void 0;
exports.httpGet = httpGet;
exports.httpPost = httpPost;
exports.httpPostFormData = httpPostFormData;
/**
 * MCP 适配器基类
 *
 * 提供环境检测和统一的调用接口
 */
var MCPAdapter = /** @class */ (function () {
    function MCPAdapter() {
    }
    /**
     * 检测是否在 Claude Code 环境中运行
     *
     * 判断依据:
     * - 环境变量 CLAUDE_CODE_MCP_AVAILABLE
     * - process.env 中是否有 MCP 相关配置
     */
    MCPAdapter.prototype.isInClaudeCode = function () {
        return (process.env.CLAUDE_CODE_MCP_AVAILABLE === "true" ||
            !!process.env.MCP_SERVERS ||
            // 可以添加更多检测逻辑
            false);
    };
    /**
     * 调用 MCP 工具
     *
     * 自动选择:
     * - Claude Code 中: 使用原生 MCP
     * - 独立运行: 使用 HTTP 降级
     *
     * @param toolName - 工具名称
     * @param params - 调用参数
     * @param fallbackFn - 降级函数（HTTP 调用）
     */
    MCPAdapter.prototype.callMCP = function (toolName, params, fallbackFn) {
        return __awaiter(this, void 0, void 0, function () {
            var result, error_1, data, fallbackError_1, data, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.isInClaudeCode()) return [3 /*break*/, 8];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 8]);
                        return [4 /*yield*/, this.callNativeMCP(toolName, params)];
                    case 2:
                        result = _a.sent();
                        return [2 /*return*/, { success: true, data: result, fallback: false }];
                    case 3:
                        error_1 = _a.sent();
                        if (!fallbackFn) return [3 /*break*/, 7];
                        _a.label = 4;
                    case 4:
                        _a.trys.push([4, 6, , 7]);
                        return [4 /*yield*/, fallbackFn()];
                    case 5:
                        data = _a.sent();
                        return [2 /*return*/, { success: true, data: data, fallback: true }];
                    case 6:
                        fallbackError_1 = _a.sent();
                        return [2 /*return*/, {
                                success: false,
                                error: "MCP and fallback both failed: ".concat(this.errorMessage(error_1), " / ").concat(this.errorMessage(fallbackError_1))
                            }];
                    case 7: return [2 /*return*/, { success: false, error: this.errorMessage(error_1) }];
                    case 8:
                        if (!fallbackFn) return [3 /*break*/, 12];
                        _a.label = 9;
                    case 9:
                        _a.trys.push([9, 11, , 12]);
                        return [4 /*yield*/, fallbackFn()];
                    case 10:
                        data = _a.sent();
                        return [2 /*return*/, { success: true, data: data, fallback: true }];
                    case 11:
                        error_2 = _a.sent();
                        return [2 /*return*/, { success: false, error: this.errorMessage(error_2) }];
                    case 12: return [2 /*return*/, {
                            success: false,
                            error: "No fallback available for tool: ".concat(toolName)
                        }];
                }
            });
        });
    };
    /**
     * 调用原生 MCP（在 Claude Code 中）
     *
     * 子类应该重写此方法以实现具体的 MCP 调用
     */
    MCPAdapter.prototype.callNativeMCP = function (_toolName, _params) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                throw new Error("callNativeMCP not implemented");
            });
        });
    };
    /**
     * 提取错误信息
     */
    MCPAdapter.prototype.errorMessage = function (error) {
        if (error instanceof Error) {
            return error.message;
        }
        return String(error);
    };
    /**
     * 健康检查
     *
     * 检查 MCP 服务是否可用
     */
    MCPAdapter.prototype.healthCheck = function () {
        return __awaiter(this, void 0, void 0, function () {
            var available;
            return __generator(this, function (_a) {
                available = this.isInClaudeCode();
                return [2 /*return*/, {
                        success: true,
                        data: {
                            available: available,
                            mode: available ? "mcp" : "http"
                        }
                    }];
            });
        });
    };
    return MCPAdapter;
}());
exports.MCPAdapter = MCPAdapter;
/**
 * 创建一个简单的 HTTP GET 请求（用于降级）
 */
function httpGet(url, headers) {
    return __awaiter(this, void 0, void 0, function () {
        var response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, fetch(url, {
                        method: "GET",
                        headers: __assign({ "Content-Type": "application/json" }, headers)
                    })];
                case 1:
                    response = _a.sent();
                    if (!response.ok) {
                        throw new Error("HTTP ".concat(response.status, ": ").concat(response.statusText));
                    }
                    return [2 /*return*/, response.json()];
            }
        });
    });
}
/**
 * 创建一个简单的 HTTP POST 请求（用于降级）
 */
function httpPost(url, body, headers) {
    return __awaiter(this, void 0, void 0, function () {
        var response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, fetch(url, {
                        method: "POST",
                        headers: __assign({ "Content-Type": "application/json" }, headers),
                        body: JSON.stringify(body)
                    })];
                case 1:
                    response = _a.sent();
                    if (!response.ok) {
                        throw new Error("HTTP ".concat(response.status, ": ").concat(response.statusText));
                    }
                    return [2 /*return*/, response.json()];
            }
        });
    });
}
/**
 * HTTP POST 请求支持 form-data 文件上传
 *
 * @param url - 请求 URL
 * @param formData - FormData 对象
 * @returns 响应数据
 */
function httpPostFormData(url, formData) {
    return __awaiter(this, void 0, void 0, function () {
        var response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, fetch(url, {
                        method: "POST",
                        body: formData
                        // 不设置 Content-Type，让浏览器自动设置并添加 boundary
                    })];
                case 1:
                    response = _a.sent();
                    if (!response.ok) {
                        throw new Error("HTTP ".concat(response.status, ": ").concat(response.statusText));
                    }
                    return [2 /*return*/, response.json()];
            }
        });
    });
}
