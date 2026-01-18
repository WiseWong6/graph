"use strict";
/**
 * Titles 节点 v2
 *
 * 职责: 基于调研结果生成多个吸引人的标题选项
 *
 * 数据流:
 * research → 解析 Brief → 检索参考标题 → LLM 标题生成 → titles[]
 *
 * 设计原则:
 * - 使用 Brief 的推荐角度
 * - 使用标题索引提供参考
 * - 生成 5-10 个标题选项
 * - 支持不同风格（疑问、数字、对比等）
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
exports.titlesNode = titlesNode;
var llm_js_1 = require("../../../config/llm.js");
var llm_client_js_1 = require("../../../utils/llm-client.js");
var index_manager_js_1 = require("../../../rag/index/index-manager.js");
var dotenv_1 = require("dotenv");
var path_1 = require("path");
(0, dotenv_1.config)({ path: (0, path_1.resolve)(process.cwd(), ".env") });
/**
 * Titles 节点主函数
 *
 * @param state - 当前状态
 * @returns 更新的状态
 */
function titlesNode(state) {
    return __awaiter(this, void 0, void 0, function () {
        var angle, referenceTitles, indexManager, query, retrieved, error_1, titleConfig, prompt, llmConfig, client, response, titles, error_2, fallbackTitles;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    console.log("[03_titles] Generating titles for topic:", state.topic);
                    angle = parseRecommendedAngle(state.researchResult || "");
                    console.log("[03_titles] Recommended angle:", (angle === null || angle === void 0 ? void 0 : angle.name) || "none");
                    referenceTitles = [];
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 4, , 5]);
                    indexManager = index_manager_js_1.default.getInstance();
                    return [4 /*yield*/, indexManager.loadIndices()];
                case 2:
                    _c.sent();
                    query = state.topic || state.prompt;
                    return [4 /*yield*/, indexManager.retrieveTitles(query, { topK: 5 })];
                case 3:
                    retrieved = _c.sent();
                    referenceTitles = retrieved.map(function (r) { return r.title; });
                    console.log("[03_titles] Retrieved ".concat(referenceTitles.length, " reference titles:"));
                    referenceTitles.forEach(function (title, i) {
                        console.log("  ".concat(i + 1, ". ").concat(title));
                    });
                    return [3 /*break*/, 5];
                case 4:
                    error_1 = _c.sent();
                    console.warn("[03_titles] Failed to retrieve reference titles:", error_1);
                    return [3 /*break*/, 5];
                case 5:
                    titleConfig = {
                        count: 8,
                        maxLength: 25,
                        platform: ((_b = (_a = state.decisions) === null || _a === void 0 ? void 0 : _a.wechat) === null || _b === void 0 ? void 0 : _b.account) ? ["wechat"] : ["wechat"],
                        style: undefined
                    };
                    prompt = buildTitlePrompt(state, titleConfig, angle, referenceTitles);
                    llmConfig = (0, llm_js_1.getNodeLLMConfig)("title_gen");
                    client = new llm_client_js_1.LLMClient(llmConfig);
                    console.log("[03_titles] Calling LLM with config:", llmConfig.model);
                    _c.label = 6;
                case 6:
                    _c.trys.push([6, 8, , 9]);
                    return [4 /*yield*/, client.call({
                            prompt: prompt,
                            systemMessage: TITLE_SYSTEM_MESSAGE
                        })];
                case 7:
                    response = _c.sent();
                    console.log("[03_titles] LLM response received, parsing titles...");
                    titles = parseTitles(response.text, titleConfig.count);
                    console.log("[03_titles] Generated ".concat(titles.length, " titles:"));
                    titles.forEach(function (title, i) {
                        console.log("  ".concat(i + 1, ". ").concat(title));
                    });
                    return [2 /*return*/, {
                            titles: titles
                        }];
                case 8:
                    error_2 = _c.sent();
                    console.error("[03_titles] Failed to generate titles: ".concat(error_2));
                    fallbackTitles = generateFallbackTitles(state.topic || state.prompt);
                    console.log("[03_titles] Using fallback titles");
                    return [2 /*return*/, {
                            titles: fallbackTitles
                        }];
                case 9: return [2 /*return*/];
            }
        });
    });
}
/**
 * 构建标题生成 Prompt
 */
function buildTitlePrompt(state, config, angle, referenceTitles) {
    var topic = state.topic || state.prompt;
    var lines = [];
    lines.push("\u8BF7\u4E3A\u4E3B\u9898\"".concat(topic, "\"\u751F\u6210 ").concat(config.count, " \u4E2A\u5438\u5F15\u4EBA\u7684\u6807\u9898\u3002\n"));
    // 推荐角度
    if (angle) {
        lines.push("## 推荐写作角度");
        lines.push("**".concat(angle.name, "**"));
        lines.push("- \u6838\u5FC3\u89C2\u70B9: ".concat(angle.coreArgument));
        if (angle.evidence && angle.evidence.length > 0) {
            lines.push("- \u8BBA\u636E: ".concat(angle.evidence.join("; ")));
        }
        lines.push("");
    }
    // 参考标题
    if (referenceTitles.length > 0) {
        lines.push("## 参考标题（同类优质标题）");
        referenceTitles.forEach(function (title, i) {
            lines.push("".concat(i + 1, ". ").concat(title));
        });
        lines.push("");
    }
    lines.push("## 标题要求");
    lines.push("  1. \u957F\u5EA6: ".concat(config.maxLength, " \u5B57\u4EE5\u5185"));
    lines.push("  2. 包含数字或疑问词,增加吸引力");
    lines.push("  3. 突出差异化价值");
    lines.push("  4. \u9002\u5408\u53D1\u5E03\u5728 ".concat(config.platform.join(" / ")));
    if (angle) {
        lines.push("  5. \u4F53\u73B0\"".concat(angle.name, "\"\u7684\u89D2\u5EA6"));
    }
    lines.push("");
    lines.push("## 标题风格参考");
    lines.push("  - 疑问式: XXX是什么?为什么XXX?");
    lines.push("  - 数字式: X个XXX技巧/方法");
    lines.push("  - 对比式: XXX vs YYY:哪个更好?");
    lines.push("  - 如何式: 如何XXX?XXX的完整指南");
    lines.push("  - 列表式: XXX必知/必做");
    lines.push("");
    lines.push("## 输出格式");
    lines.push("请直接输出标题列表,每行一个,不要编号。");
    lines.push("");
    return lines.join("\n");
}
/**
 * System Message
 */
var TITLE_SYSTEM_MESSAGE = "\u4F60\u662F\u4E00\u4E2A\u4E13\u4E1A\u7684\u6807\u9898\u521B\u4F5C\u4E13\u5BB6,\u64C5\u957F\u4E3A\u4E0D\u540C\u5E73\u53F0\u521B\u4F5C\u9AD8\u70B9\u51FB\u7387\u7684\u6807\u9898\u3002\n\n\u4F60\u7684\u6838\u5FC3\u80FD\u529B:\n- \u6D1E\u5BDF\u7528\u6237\u5FC3\u7406,\u6293\u4F4F\u6CE8\u610F\u529B\n- \u5E73\u8861\u5438\u5F15\u529B\u548C\u51C6\u786E\u6027\n- \u9488\u5BF9\u4E0D\u540C\u5E73\u53F0\u4F18\u5316\u98CE\u683C\n- \u907F\u514D\u6807\u9898\u515A,\u4FDD\u6301\u4EF7\u503C\u5BFC\u5411\n\n\u521B\u4F5C\u539F\u5219:\n1. \u597D\u6807\u9898 = \u597D\u5947\u5FC3 + \u4EF7\u503C\u627F\u8BFA\n2. \u5F00\u59343\u4E2A\u5B57\u51B3\u5B9A\u70B9\u51FB\u7387\n3. \u6570\u5B57\u548C\u7591\u95EE\u8BCD\u63D0\u5347\u5438\u5F15\u529B\n4. \u907F\u514D\u5938\u5927\u548C\u8BEF\u5BFC";
/**
 * 解析 LLM 输出的标题
 */
function parseTitles(text, expectedCount) {
    var titles = [];
    // 按行分割
    var lines = text.split("\n").map(function (l) { return l.trim(); }).filter(function (l) { return l; });
    for (var _i = 0, lines_1 = lines; _i < lines_1.length; _i++) {
        var line = lines_1[_i];
        // 跳过非标题行
        if (line.match(/^(标题|输出|示例|Note|Comment)/i)) {
            continue;
        }
        // 移除编号
        var title = line.replace(/^\d+[\.\)]\s*/, "");
        title = title.replace(/^[-•*]\s*/, "");
        title = title.replace(/^第?\d+[、.]/, "");
        // 移除引号
        title = title.replace(/^["'「『]|["'」』]$/g, "");
        // 验证长度
        if (title.length > 5 && title.length < 50) {
            titles.push(title);
        }
        if (titles.length >= expectedCount) {
            break;
        }
    }
    // 如果解析失败,返回空数组,触发降级
    return titles.length > 0 ? titles : [];
}
/**
 * 生成降级标题
 */
function generateFallbackTitles(topic) {
    var templates = [
        "关于{topic}的全面解析",
        "{topic}是什么?一文读懂",
        "2026年{topic}发展趋势",
        "如何掌握{topic}?完整指南",
        "{topic}的5个关键要点",
        "{topic}实战:从入门到精通",
        "为什么{topic}如此重要?",
        "{topic} vs 传统方法:深度对比"
    ];
    return templates
        .map(function (t) { return t.replace("{topic}", topic); })
        .slice(0, 8);
}
/**
 * 从 Brief 中解析推荐角度
 */
function parseRecommendedAngle(briefText) {
    // 查找"推荐角度"部分
    var angleMatch = briefText.match(/##?\s*推荐角度\s*\n([\s\S]+?)(?=##|\n\n|$)/i);
    if (!angleMatch)
        return null;
    var angleText = angleMatch[1];
    // 提取角度名称（加粗文本）
    var nameMatch = angleText.match(/\*\*([^*]+)\*\*/);
    var name = nameMatch ? nameMatch[1].trim() : "默认角度";
    // 提取核心论点
    var argumentMatch = angleText.match(/核心论点[：:]\s*([^\n]+)/);
    var coreArgument = argumentMatch ? argumentMatch[1].trim() : "";
    // 提取论据
    var evidence = [];
    var evidenceLines = angleText.match(/^- .+/gm) || [];
    for (var _i = 0, evidenceLines_1 = evidenceLines; _i < evidenceLines_1.length; _i++) {
        var line = evidenceLines_1[_i];
        var evidenceText = line.replace(/^-\s*/, "").trim();
        if (evidenceText) {
            evidence.push(evidenceText);
        }
    }
    if (!name && !coreArgument) {
        return null;
    }
    return {
        name: name || "推荐角度",
        coreArgument: coreArgument || angleText.slice(0, 100),
        evidence: evidence.length > 0 ? evidence : undefined
    };
}
