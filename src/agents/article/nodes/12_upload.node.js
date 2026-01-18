"use strict";
/**
 * Upload Images 节点 v2 - 修复版
 *
 * 职责: 上传本地图片到微信 CDN (图文消息图片)
 *
 * 数据流:
 * imagePaths + wechatConfig → 微信 API → uploadedImageUrls[]
 *
 * 设计原则:
 * - 使用正确的 API: /media/uploadimg (图文消息图片)
 * - 使用 form-data 上传
 * - 返回 CDN URL
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
exports.uploadImagesNode = uploadImagesNode;
var fs_1 = require("fs");
var mcp_js_1 = require("../../../adapters/mcp.js");
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
 * Upload Images 节点主函数
 *
 * @param state - 当前状态
 * @returns 更新的状态
 */
function uploadImagesNode(state) {
    return __awaiter(this, void 0, void 0, function () {
        var config, concurrency, uploadResults, uploadedUrls, _i, uploadResults_1, result;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("[11.5_upload] Uploading images to WeChat CDN...");
                    if (!state.imagePaths || state.imagePaths.length === 0) {
                        console.log("[11.5_upload] No images to upload");
                        return [2 /*return*/, {
                                uploadedImageUrls: []
                            }];
                    }
                    config = getWechatConfig();
                    console.log("[11.5_upload] Uploading ".concat(state.imagePaths.length, " images..."));
                    concurrency = parseInt(process.env.UPLOAD_CONCURRENCY || "5");
                    console.log("[11.5_upload] Starting parallel upload (concurrency: ".concat(concurrency, ")..."));
                    return [4 /*yield*/, parallelMap(state.imagePaths, function (imagePath, index) { return __awaiter(_this, void 0, void 0, function () {
                            var imageBuffer, result, error_1;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        console.log("[11.5_upload] Uploading ".concat(index + 1, "/").concat(state.imagePaths.length, ": ").concat(imagePath));
                                        _a.label = 1;
                                    case 1:
                                        _a.trys.push([1, 4, , 5]);
                                        // 读取图片
                                        if (!(0, fs_1.existsSync)(imagePath)) {
                                            console.error("[11.5_upload] File not found: ".concat(imagePath));
                                            return [2 /*return*/, { index: index, url: null }];
                                        }
                                        imageBuffer = (0, fs_1.readFileSync)(imagePath);
                                        return [4 /*yield*/, uploadImage(imageBuffer, config)];
                                    case 2:
                                        result = _a.sent();
                                        // 避免频率限制
                                        return [4 /*yield*/, delay(300)];
                                    case 3:
                                        // 避免频率限制
                                        _a.sent();
                                        return [2 /*return*/, { index: index, url: result }];
                                    case 4:
                                        error_1 = _a.sent();
                                        console.error("[11.5_upload] Failed to upload ".concat(imagePath, ": ").concat(error_1));
                                        return [2 /*return*/, { index: index, url: null }];
                                    case 5: return [2 /*return*/];
                                }
                            });
                        }); }, concurrency)];
                case 1:
                    uploadResults = _a.sent();
                    uploadedUrls = [];
                    for (_i = 0, uploadResults_1 = uploadResults; _i < uploadResults_1.length; _i++) {
                        result = uploadResults_1[_i];
                        if (result.url) {
                            uploadedUrls[result.index] = result.url;
                            console.log("[11.5_upload] Uploaded: ".concat(result.url));
                        }
                    }
                    console.log("[11.5_upload] Uploaded ".concat(uploadedUrls.length, " images successfully"));
                    return [2 /*return*/, {
                            uploadedImageUrls: uploadedUrls
                        }];
            }
        });
    });
}
/**
 * 上传单张图片 (图文消息图片)
 *
 * API: /cgi-bin/media/uploadimg
 * Doc: https://developers.weixin.qq.com/doc/offiaccount/Asset_Management/New_temp_materials_library.html
 */
function uploadImage(imageBuffer, config) {
    return __awaiter(this, void 0, void 0, function () {
        var token, formData, blob, response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getAccessToken(config)];
                case 1:
                    token = _a.sent();
                    formData = new FormData();
                    blob = new Blob([imageBuffer]);
                    formData.append("media", blob);
                    formData.append("type", "image");
                    return [4 /*yield*/, (0, mcp_js_1.httpPostFormData)("".concat(config.apiUrl, "/cgi-bin/media/uploadimg?access_token=").concat(token), formData)];
                case 2:
                    response = _a.sent();
                    if (response.errcode && response.errcode !== 0) {
                        throw new Error("Upload failed: ".concat(response.errmsg, " (errcode: ").concat(response.errcode, ")"));
                    }
                    if (!response.url) {
                        throw new Error("Upload failed: no URL returned");
                    }
                    return [2 /*return*/, response.url];
            }
        });
    });
}
/**
 * 获取 access_token
 */
function getAccessToken(config) {
    return __awaiter(this, void 0, void 0, function () {
        var response, data;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, fetch("".concat(config.apiUrl, "/cgi-bin/token?grant_type=client_credential&appid=").concat(config.appId, "&secret=").concat(config.appSecret))];
                case 1:
                    response = _a.sent();
                    if (!response.ok) {
                        throw new Error("Failed to get access_token: ".concat(response.statusText));
                    }
                    return [4 /*yield*/, response.json()];
                case 2:
                    data = _a.sent();
                    if (!data.access_token) {
                        throw new Error("Failed to get access_token: no token returned");
                    }
                    return [2 /*return*/, data.access_token];
            }
        });
    });
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
/**
 * 延迟函数
 */
function delay(ms) {
    return new Promise(function (resolve) { return setTimeout(resolve, ms); });
}
