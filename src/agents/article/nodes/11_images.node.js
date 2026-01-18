"use strict";
/**
 * Images 节点 v3 - 使用 OpenAI SDK 调用火山 Ark API
 *
 * 职责: 调用火山 Ark API 生成本地图片
 *
 * 数据流:
 * imagePrompts + imageConfig → Ark API → imagePaths[]
 *
 * 设计原则:
 * - 支持并行生成（并发限制）
 * - 保存到本地
 * - 错误重试和降级
 * - 进度跟踪
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
exports.imagesNode = imagesNode;
var fs_1 = require("fs");
var path_1 = require("path");
var openai_1 = require("openai");
var logger_js_1 = require("../../../utils/logger.js");
var errors_js_1 = require("../../../utils/errors.js");
var log = (0, logger_js_1.createLogger)("11_images");
/**
 * 并发控制 - 并行执行多个异步任务
 */
function parallelMap(items, fn, concurrency) {
    return __awaiter(this, void 0, void 0, function () {
        var results, executing, _loop_1, i;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    results = new Array(items.length);
                    executing = [];
                    _loop_1 = function (i) {
                        var promise;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    promise = fn(items[i], i).then(function (result) {
                                        results[i] = result;
                                    });
                                    executing.push(promise);
                                    if (!(executing.length >= concurrency)) return [3 /*break*/, 2];
                                    return [4 /*yield*/, Promise.race(executing)];
                                case 1:
                                    _b.sent();
                                    executing.splice(executing.findIndex(function (p) { return p === promise; }), 1);
                                    _b.label = 2;
                                case 2: return [2 /*return*/];
                            }
                        });
                    };
                    i = 0;
                    _a.label = 1;
                case 1:
                    if (!(i < items.length)) return [3 /*break*/, 4];
                    return [5 /*yield**/, _loop_1(i)];
                case 2:
                    _a.sent();
                    _a.label = 3;
                case 3:
                    i++;
                    return [3 /*break*/, 1];
                case 4: return [4 /*yield*/, Promise.all(executing)];
                case 5:
                    _a.sent();
                    return [2 /*return*/, results];
            }
        });
    });
}
/**
 * Images 节点主函数
 *
 * @param state - 当前状态
 * @returns 更新的状态
 */
function imagesNode(state) {
    return __awaiter(this, void 0, void 0, function () {
        var timer, config, imageConfig, size, outputPath, imagesDir, prompts, progress, results, imagePaths, errors, _i, results_1, result;
        var _this = this;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    timer = log.timer("images");
                    log.startStep("validate_input");
                    // ========== 验证输入 ==========
                    if (!state.imagePrompts || state.imagePrompts.length === 0) {
                        throw new Error("Image prompts not found in state");
                    }
                    log.completeStep("validate_input", { promptCount: state.imagePrompts.length });
                    // ========== 获取配置 ==========
                    log.startStep("setup_config");
                    config = getArkConfig();
                    imageConfig = (_a = state.decisions) === null || _a === void 0 ? void 0 : _a.images;
                    size = "2k";
                    log.info("Config:", {
                        model: config.model,
                        size: size,
                        count: state.imagePrompts.length,
                        style: (imageConfig === null || imageConfig === void 0 ? void 0 : imageConfig.style) || "infographic"
                    });
                    log.completeStep("setup_config");
                    // ========== 准备输出目录 ==========
                    log.startStep("generate_images");
                    outputPath = state.outputPath || getDefaultOutputPath();
                    imagesDir = (0, path_1.join)(outputPath, "images");
                    if (!(0, fs_1.existsSync)(imagesDir)) {
                        (0, fs_1.mkdirSync)(imagesDir, { recursive: true });
                    }
                    prompts = state.imagePrompts;
                    progress = log.progress(prompts.length, "generate");
                    return [4 /*yield*/, parallelMap(prompts, function (prompt, index) { return __awaiter(_this, void 0, void 0, function () {
                            var filename, filepath, imageData, imgResponse, arrayBuffer, buffer, error_1;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        filename = "image_".concat(String(index + 1).padStart(2, "0"), ".png");
                                        filepath = (0, path_1.join)(imagesDir, filename);
                                        _a.label = 1;
                                    case 1:
                                        _a.trys.push([1, 7, , 8]);
                                        return [4 /*yield*/, (0, errors_js_1.retry)(function () { return generateImage(prompt, config, size); }, { maxAttempts: 2, delay: 500 })()];
                                    case 2:
                                        imageData = _a.sent();
                                        if (!imageData.url) return [3 /*break*/, 5];
                                        return [4 /*yield*/, fetch(imageData.url)];
                                    case 3:
                                        imgResponse = _a.sent();
                                        return [4 /*yield*/, imgResponse.arrayBuffer()];
                                    case 4:
                                        arrayBuffer = _a.sent();
                                        buffer = Buffer.from(arrayBuffer);
                                        (0, fs_1.writeFileSync)(filepath, buffer);
                                        progress.increment("image_".concat(index + 1));
                                        return [2 /*return*/, { index: index, path: filepath }];
                                    case 5: return [2 /*return*/, { index: index, error: "No image data returned" }];
                                    case 6: return [3 /*break*/, 8];
                                    case 7:
                                        error_1 = _a.sent();
                                        log.error("Failed to generate image ".concat(index + 1, ":"), error_1);
                                        return [2 /*return*/, { index: index, error: String(error_1) }];
                                    case 8: return [2 /*return*/];
                                }
                            });
                        }); }, parseInt(process.env.IMAGE_CONCURRENCY || "5") // 并发限制（可配置）
                        )];
                case 1:
                    results = _b.sent();
                    progress.complete();
                    imagePaths = [];
                    errors = [];
                    for (_i = 0, results_1 = results; _i < results_1.length; _i++) {
                        result = results_1[_i];
                        if (!result)
                            continue;
                        if (result.path) {
                            imagePaths[result.index] = result.path;
                        }
                        else if (result.error) {
                            errors.push("Image ".concat(result.index + 1, ": ").concat(result.error));
                        }
                    }
                    log.completeStep("generate_images", {
                        success: imagePaths.filter(Boolean).length,
                        failed: errors.length
                    });
                    if (errors.length > 0) {
                        log.warn("Some images failed:", errors);
                    }
                    log.success("Complete in ".concat(timer.log()));
                    return [2 /*return*/, {
                            imagePaths: imagePaths.filter(Boolean)
                        }];
            }
        });
    });
}
/**
 * 生成单张图片（使用 OpenAI SDK）
 */
function generateImage(prompt, config, size) {
    return __awaiter(this, void 0, void 0, function () {
        var client, response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    client = new openai_1.default({
                        baseURL: config.baseUrl + "/api/v3",
                        apiKey: config.apiKey
                    });
                    return [4 /*yield*/, client.images.generate({
                            model: config.model,
                            prompt: prompt,
                            size: size, // Ark 支持 "2k" 等自定义尺寸
                            response_format: "url"
                            // watermark: false - Ark API 不支持此参数，已默认关闭水印
                        })];
                case 1:
                    response = _a.sent();
                    if (!response.data || !response.data[0] || !response.data[0].url) {
                        throw new Error("No image URL in response");
                    }
                    return [2 /*return*/, {
                            url: response.data[0].url
                        }];
            }
        });
    });
}
/**
 * 获取 Ark 配置
 */
function getArkConfig() {
    var apiKey = process.env.ARK_API_KEY || process.env.VOLCENGINE_API_KEY;
    if (!apiKey) {
        throw new Error("ARK_API_KEY or VOLCENGINE_API_KEY not set");
    }
    return {
        apiKey: apiKey,
        baseUrl: process.env.ARK_BASE_URL || "https://ark.cn-beijing.volces.com",
        model: process.env.ARK_MODEL || "doubao-seedream-4-5-251128"
    };
}
/**
 * 获取默认输出路径
 */
function getDefaultOutputPath() {
    var timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    var runId = "article-".concat(timestamp);
    return (0, path_1.join)(process.cwd(), "output", runId);
}
