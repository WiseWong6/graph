"use strict";
/**
 * Gate B: 确认图片配置
 *
 * 触发时机: 图片提示词生成前执行
 * 功能: 让用户配置图片生成参数（风格、数量）
 *
 * 交互 UI:
 * ```
 * === 图片风格推荐 ===
 * 基于文章内容分析，推荐使用: [扁平化科普图]
 *
 * 理由: 文章包含"解释"、"原理"等科普关键词
 *
 * ? 请选择图片风格:
 *   1. 扁平化科普图 (推荐) - Flat vector style, white background
 *   2. 治愈系插画 - Warm pastel color, soft light
 *   3. 粗线条插画 - Pixar style, bold lines
 *   4. 描边插画 - Minimalist, clean lines
 *   5. 方格纸手绘 - Hand-drawn notebook style
 *
 * ? 生成数量: 4
 *
 * === 配置确认 ===
 * 风格: 扁平化科普图
 * 数量: 4 张
 * 模型: doubao-seedream-4-5-251128
 * 分辨率: 2k
 *
 * ? 确认以上配置? (Y/n)
 * ```
 *
 * 存储位置: state.decisions.images
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
exports.confirmImagesNodeInfo = void 0;
exports.setPromptFn = setPromptFn;
exports.confirmImagesNode = confirmImagesNode;
/**
 * 默认交互提示函数
 *
 * 使用真实的 inquirer 模块
 */
var promptFn = null;
function setPromptFn(fn) {
    promptFn = fn;
}
function getPromptFn() {
    return __awaiter(this, void 0, void 0, function () {
        var inquirerModule;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!!promptFn) return [3 /*break*/, 2];
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("inquirer"); })];
                case 1:
                    inquirerModule = _a.sent();
                    promptFn = inquirerModule.default.prompt;
                    _a.label = 2;
                case 2: return [2 /*return*/, promptFn];
            }
        });
    });
}
/**
 * 风格关键词映射
 */
var STYLE_KEYWORDS = {
    infographic: ["解释", "原理", "是什么", "如何", "步骤", "科普", "说明"],
    healing: ["故事", "情绪", "场景", "温暖", "治愈", "叙事", "氛围"],
    pixar: ["卡通", "可爱", "童趣", "活力", "鲜艳", "3d", "动画"],
    sokamono: ["清新", "简洁", "文艺", "淡雅", "描边", "治愈", "清新"],
    handdrawn: ["笔记", "手绘", "草图", "学习", "手写", "方格", "马克笔"]
};
/**
 * 风格名称映射（中文）
 */
var STYLE_NAMES = {
    infographic: "扁平化科普图",
    healing: "治愈系插画",
    pixar: "粗线条插画",
    sokamono: "描边插画",
    handdrawn: "方格纸手绘"
};
/**
 * 风格描述映射
 */
var STYLE_DESCRIPTIONS = {
    infographic: "Flat vector style, white background, simple thin-outline icons",
    healing: "Warm pastel color, soft light, cozy healing illustration",
    pixar: "Pixar style, sharpie illustration, bold lines and solid colors",
    sokamono: "Cartoon illustration, minimalist, simple and vivid lines",
    handdrawn: "Hand-drawn notebook style on grid paper, marker pen"
};
/**
 * 智能推荐风格
 *
 * 基于文章内容关键词分析
 */
function recommendStyle(content) {
    var scores = {
        infographic: 0,
        healing: 0,
        pixar: 0,
        sokamono: 0,
        handdrawn: 0
    };
    // 统计每种风格的关键词出现次数
    for (var _i = 0, _a = Object.entries(STYLE_KEYWORDS); _i < _a.length; _i++) {
        var _b = _a[_i], style = _b[0], keywords = _b[1];
        for (var _c = 0, keywords_1 = keywords; _c < keywords_1.length; _c++) {
            var keyword = keywords_1[_c];
            var regex = new RegExp(keyword, "gi");
            var matches = content.match(regex);
            if (matches) {
                scores[style] += matches.length;
            }
        }
    }
    // 返回得分最高的风格
    var maxScore = 0;
    var recommendedStyle = "infographic";
    for (var _d = 0, _e = Object.entries(scores); _d < _e.length; _d++) {
        var _f = _e[_d], style = _f[0], score = _f[1];
        if (score > maxScore) {
            maxScore = score;
            recommendedStyle = style;
        }
    }
    return recommendedStyle;
}
/**
 * 智能解析图片配置
 *
 * 支持的输入格式:
 * - "4张"
 * - "扁平化，4张"
 * - "healing 4"
 * - "科普图，3张"
 *
 * @param input - 用户输入
 * @param recommendedStyle - 推荐的风格
 */
function parseImageConfig(input, recommendedStyle) {
    var config = {
        confirmed: false,
        count: 4,
        style: recommendedStyle,
        model: "doubao-seedream-4-5-251128",
        resolution: "2k"
    };
    var text = input.toLowerCase();
    // 解析风格（简写或中文）
    var styleAliases = {
        "扁平": "infographic",
        "科普": "infographic",
        "infographic": "infographic",
        "治愈": "healing",
        "healing": "healing",
        "粗线": "pixar",
        "pixar": "pixar",
        "描边": "sokamono",
        "sokamono": "sokamono",
        "手绘": "handdrawn",
        "方格": "handdrawn",
        "handdrawn": "handdrawn"
    };
    for (var _i = 0, _a = Object.entries(styleAliases); _i < _a.length; _i++) {
        var _b = _a[_i], alias = _b[0], style = _b[1];
        if (text.includes(alias)) {
            config.style = style;
            break;
        }
    }
    // 解析数量
    var countMatch = text.match(/(\d+)\s*[张张]/);
    if (countMatch) {
        config.count = parseInt(countMatch[1], 10);
    }
    return config;
}
/**
 * 确认图片配置节点
 *
 * 决策流程:
 * 1. 检查是否已确认 (state.decisions.images?.confirmed)
 * 2. 分析内容，推荐风格
 * 3. 弹出风格选择输入框
 * 4. 弹出数量输入框
 * 5. 显示确认信息
 * 6. 二次确认
 * 7. 保存决策到 state.decisions.images
 */
function confirmImagesNode(state) {
    return __awaiter(this, void 0, void 0, function () {
        var existingConfig, content, recommendedStyle, prompt, styleInput, selectedStyle, countInput, config, confirmed;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    existingConfig = (_a = state.decisions) === null || _a === void 0 ? void 0 : _a.images;
                    // 已确认，跳过
                    if (existingConfig === null || existingConfig === void 0 ? void 0 : existingConfig.confirmed) {
                        console.log("[confirm_images] \u4F7F\u7528\u5DF2\u786E\u8BA4\u7684\u914D\u7F6E:");
                        console.log("  \u98CE\u683C: ".concat(STYLE_NAMES[existingConfig.style]));
                        console.log("  \u6570\u91CF: ".concat(existingConfig.count, " \u5F20"));
                        return [2 /*return*/, {}];
                    }
                    console.log("\n=== Gate B: 确认图片配置 ===\n");
                    content = state.humanized || state.rewritten || state.polished || state.draft || "";
                    recommendedStyle = recommendStyle(content);
                    console.log("=== 图片风格推荐 ===");
                    console.log("\u57FA\u4E8E\u6587\u7AE0\u5185\u5BB9\u5206\u6790\uFF0C\u63A8\u8350\u4F7F\u7528: [".concat(STYLE_NAMES[recommendedStyle], "]"));
                    console.log("\n\u98CE\u683C\u63CF\u8FF0: ".concat(STYLE_DESCRIPTIONS[recommendedStyle]));
                    console.log("");
                    return [4 /*yield*/, getPromptFn()];
                case 1:
                    prompt = _b.sent();
                    return [4 /*yield*/, prompt([
                            {
                                type: "list",
                                name: "styleInput",
                                message: "请选择图片风格:",
                                default: recommendedStyle,
                                choices: [
                                    { name: "1. \u6241\u5E73\u5316\u79D1\u666E\u56FE (\u63A8\u8350) - Flat vector style, white background", value: "infographic" },
                                    { name: "2. \u6CBB\u6108\u7CFB\u63D2\u753B - Warm pastel color, soft light", value: "healing" },
                                    { name: "3. \u7C97\u7EBF\u6761\u63D2\u753B - Pixar style, bold lines", value: "pixar" },
                                    { name: "4. \u63CF\u8FB9\u63D2\u753B - Minimalist, clean lines", value: "sokamono" },
                                    { name: "5. \u65B9\u683C\u7EB8\u624B\u7ED8 - Hand-drawn notebook style", value: "handdrawn" }
                                ]
                            }
                        ])];
                case 2:
                    styleInput = (_b.sent()).styleInput;
                    selectedStyle = styleInput;
                    return [4 /*yield*/, prompt([
                            {
                                type: "input",
                                name: "countInput",
                                message: "请输入生成数量（支持简写如 \"4张\"）:",
                                default: "4张",
                                validate: function (input) {
                                    var match = input.match(/(\d+)/);
                                    if (!match) {
                                        return "请输入有效的数字";
                                    }
                                    var count = parseInt(match[1], 10);
                                    if (count < 1 || count > 20) {
                                        return "数量必须在 1-20 之间";
                                    }
                                    return true;
                                }
                            }
                        ])];
                case 3:
                    countInput = (_b.sent()).countInput;
                    config = parseImageConfig(countInput, selectedStyle);
                    console.log("\n=== 配置确认 ===");
                    console.log("\u98CE\u683C: ".concat(STYLE_NAMES[config.style]));
                    console.log("\u63CF\u8FF0: ".concat(STYLE_DESCRIPTIONS[config.style]));
                    console.log("\u6570\u91CF: ".concat(config.count, " \u5F20"));
                    console.log("\u6A21\u578B: ".concat(config.model));
                    console.log("\u5206\u8FA8\u7387: ".concat(config.resolution));
                    console.log("\u6BD4\u4F8B: 16:9 (\u516C\u4F17\u53F7\u7EDF\u4E00\u6A2A\u5C4F)\n");
                    return [4 /*yield*/, prompt([
                            {
                                type: "confirm",
                                name: "confirmed",
                                message: "确认以上配置?",
                                default: true
                            }
                        ])];
                case 4:
                    confirmed = (_b.sent()).confirmed;
                    if (!confirmed) {
                        // 重新输入
                        console.log("\n请重新配置...\n");
                        return [2 /*return*/, confirmImagesNode(state)];
                    }
                    console.log("[confirm_images] \u914D\u7F6E\u5DF2\u4FDD\u5B58\n");
                    return [2 /*return*/, {
                            decisions: __assign(__assign({}, state.decisions), { images: __assign(__assign({}, config), { confirmed: true }) })
                        }];
            }
        });
    });
}
/**
 * 节点信息（用于文档和调试）
 */
exports.confirmImagesNodeInfo = {
    name: "confirm_images",
    type: "interactive",
    gate: "B",
    description: "确认图片生成配置（风格、数量）",
    writes: ["decisions.images"]
};
