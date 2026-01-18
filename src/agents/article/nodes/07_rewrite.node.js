"use strict";
/**
 * Rewrite 节点 v2 - 使用统一错误处理和日志
 *
 * 职责: 使用智性叙事风格重写润色后的文章
 *
 * 数据流:
 * polished + researchResult (Brief) + ragContent + selectedTitle → LLM 重写 → rewritten
 *
 * 核心差异:
 * - Draft (05): 图书管理员 - 整理资料，生成完整内容
 * - Polish (06): 编辑 - 润色表达，添加金句点缀
 * - Rewrite (07): 跨界智性叙事者 - 深度创作，注入灵魂
 *
 * 设计原则:
 * - 智性四步法：打破认知 → 通俗解构 → 跨界升维 → 思维留白
 * - IPS 原则：反直觉洞察 + 跨学科引用 + 简单易懂
 * - HKR 自检：悬念 + 新知 + 共鸣
 * - 禁止：列表、机械分点、"首先/其次"
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
exports.rewriteNode = rewriteNode;
var fs_1 = require("fs");
var path_1 = require("path");
var llm_js_1 = require("../../../config/llm.js");
var llm_client_js_1 = require("../../../utils/llm-client.js");
var dotenv_1 = require("dotenv");
var path_2 = require("path");
var logger_js_1 = require("../../../utils/logger.js");
var errors_js_1 = require("../../../utils/errors.js");
(0, dotenv_1.config)({ path: (0, path_2.resolve)(process.cwd(), ".env") });
// 创建节点日志
var log = (0, logger_js_1.createLogger)("07_rewrite");
// ========== Rewrite 节点主函数 ==========
/**
 * Rewrite 节点主函数
 *
 * @param state - 当前状态
 * @returns 更新的状态
 */
function rewriteNode(state) {
    return __awaiter(this, void 0, void 0, function () {
        var timer, title, brief, rag, prompt, llmConfig, client, response, rewritten, outputPath, rewriteDir, rewritePath, error_1;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    timer = log.timer("rewrite");
                    log.startStep("validate_input");
                    // ========== 验证输入 ==========
                    if (!state.polished) {
                        throw new errors_js_1.ValidationError("Polished content not found in state", "polished");
                    }
                    title = ((_a = state.decisions) === null || _a === void 0 ? void 0 : _a.selectedTitle) || ((_b = state.titles) === null || _b === void 0 ? void 0 : _b[0]) || "无标题";
                    log.completeStep("validate_input", { title: title, inputLength: state.polished.length });
                    // ========== 解析 Brief 和 RAG ==========
                    log.startStep("parse_input");
                    brief = parseBriefForRewrite(state.researchResult || "");
                    rag = parseRAGForRewrite(state.ragContent || "");
                    log.completeStep("parse_input", {
                        topic: brief.topic,
                        insightsCount: brief.keyInsights.length,
                        hasAngle: !!brief.recommendedAngle,
                        quotesCount: rag.quotes.length,
                        hasRAG: rag.hasContent
                    });
                    // ========== 构建 Prompt ==========
                    log.startStep("build_prompt");
                    prompt = buildRewritePrompt(title, brief, rag, state.polished);
                    log.completeStep("build_prompt", { promptLength: prompt.length });
                    // ========== 调用 LLM ==========
                    log.startStep("llm_call");
                    llmConfig = (0, llm_js_1.getNodeLLMConfig)("rewrite");
                    client = new llm_client_js_1.LLMClient(llmConfig);
                    log.info("LLM config:", { model: llmConfig.model, temperature: llmConfig.temperature });
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, (0, errors_js_1.retry)(function () { return client.call({
                            prompt: prompt,
                            systemMessage: REWRITE_SYSTEM_MESSAGE
                        }); }, { maxAttempts: 3, delay: 1000 })()];
                case 2:
                    response = _c.sent();
                    log.completeStep("llm_call", {
                        outputLength: response.text.length,
                        usage: response.usage
                    });
                    rewritten = response.text;
                    // ========== 保存 Rewrite 稿 ==========
                    log.startStep("save_output");
                    outputPath = state.outputPath || getDefaultOutputPath();
                    rewriteDir = (0, path_1.join)(outputPath, "rewrite");
                    if (!(0, fs_1.existsSync)(rewriteDir)) {
                        (0, fs_1.mkdirSync)(rewriteDir, { recursive: true });
                    }
                    rewritePath = (0, path_1.join)(rewriteDir, "07_rewrite.md");
                    (0, fs_1.writeFileSync)(rewritePath, rewritten, "utf-8");
                    log.completeStep("save_output", { path: rewritePath });
                    log.success("Complete in ".concat(timer.log()));
                    return [2 /*return*/, {
                            rewritten: rewritten,
                            outputPath: outputPath
                        }];
                case 3:
                    error_1 = _c.sent();
                    log.failStep("llm_call", error_1);
                    errors_js_1.ErrorHandler.handle(error_1, "07_rewrite");
                    // 降级: 返回润色稿
                    log.warn("Fallback to polished content");
                    return [2 /*return*/, {
                            rewritten: state.polished
                        }];
                case 4: return [2 /*return*/];
            }
        });
    });
}
// ========== 解析器 ==========
/**
 * 解析 Brief 提取核心洞察（用于 Rewrite）
 */
function parseBriefForRewrite(brief) {
    var result = {
        keyInsights: [],
        recommendedAngle: null,
        topic: ""
    };
    // 提取主题
    var topicMatch = brief.match(/主题[：:]\s*(.+?)(?:\n|$)/i);
    if (topicMatch) {
        result.topic = topicMatch[1].trim();
    }
    // 提取核心洞察（最多 4-5 个）
    var insightsSection = extractSection(brief, "## 核心洞察", "##");
    if (insightsSection) {
        var insightMatches = insightsSection.split("###").filter(function (s) { return s.trim(); });
        result.keyInsights = insightMatches.map(function (s) {
            var lines = s.trim().split("\n");
            var title = lines[0].replace(/^\d+\.\s*/, "").trim();
            var content = lines.slice(1).join(" ").trim();
            return content || title;
        }).filter(Boolean).slice(0, 5);
    }
    // 提取推荐角度
    var angleSection = extractSection(brief, "## 推荐写作角度", "##");
    if (angleSection) {
        var angleNameMatch = angleSection.match(/推荐[：:]\s*(.+?)(?:\n|$)/i);
        var coreArgMatch = angleSection.match(/核心论点[：:]\s*(.+?)(?:\n|$)/i);
        if (angleNameMatch || coreArgMatch) {
            result.recommendedAngle = {
                name: angleNameMatch ? angleNameMatch[1].trim() : "未命名角度",
                coreArgument: coreArgMatch ? coreArgMatch[1].trim() : ""
            };
        }
    }
    return result;
}
/**
 * 解析 RAG 提取金句（用于 Rewrite 点缀）
 */
function parseRAGForRewrite(rag) {
    var result = {
        quotes: [],
        hasContent: !rag.includes("索引未初始化")
    };
    if (!result.hasContent) {
        return result;
    }
    // 提取金句（最多 3 条）
    var quotesSection = extractSection(rag, "## 相关金句", "##");
    if (quotesSection) {
        var quoteMatches = quotesSection.split("###").filter(function (s) { return s.trim(); });
        result.quotes = quoteMatches
            .map(function (s) {
            var lines = s.trim().split("\n");
            return lines.slice(1).join(" ").trim();
        })
            .filter(function (q) { return q.length > 5; })
            .slice(0, 3);
    }
    return result;
}
/**
 * 提取 Markdown 指定 section 的内容
 */
function extractSection(markdown, startMarker, endMarker) {
    var startIndex = markdown.indexOf(startMarker);
    if (startIndex === -1)
        return null;
    var startContent = startIndex + startMarker.length;
    var endIndex = markdown.indexOf(endMarker, startContent);
    if (endIndex === -1) {
        return markdown.slice(startContent).trim();
    }
    return markdown.slice(startContent, endIndex).trim();
}
// ========== Prompt 构建 ==========
/**
 * 构建 Rewrite Prompt
 */
function buildRewritePrompt(title, brief, rag, polished) {
    var lines = [];
    lines.push("# 写作任务\n");
    lines.push("\u8BF7\u4F7F\u7528**\u667A\u6027\u53D9\u4E8B\u98CE\u683C**\u91CD\u5199\u4EE5\u4E0B\u6587\u7AE0\u3002\n");
    // ========== 标题 ==========
    lines.push("## 标题");
    lines.push(title);
    lines.push("");
    // ========== 核心洞察（用于打破认知） ==========
    if (brief.keyInsights.length > 0) {
        lines.push("## 核心洞察");
        lines.push("_这些洞察可用于构建「打破认知」的开头_");
        brief.keyInsights.forEach(function (insight, i) {
            lines.push("".concat(i + 1, ". ").concat(insight));
        });
        lines.push("");
    }
    // ========== 推荐角度（用于构建叙事框架） ==========
    if (brief.recommendedAngle) {
        lines.push("## 推荐写作角度");
        lines.push("**\u89D2\u5EA6**: ".concat(brief.recommendedAngle.name));
        lines.push("**\u6838\u5FC3\u8BBA\u70B9**: ".concat(brief.recommendedAngle.coreArgument));
        lines.push("");
    }
    // ========== 参考金句（用于点缀） ==========
    if (rag.hasContent && rag.quotes.length > 0) {
        lines.push("## 参考金句（可用于点缀）");
        rag.quotes.forEach(function (quote, i) {
            lines.push("".concat(i + 1, ". ").concat(quote));
        });
        lines.push("");
    }
    // ========== 待重写的文章 ==========
    lines.push("---");
    lines.push("## 待重写的文章");
    lines.push("```");
    lines.push(polished.slice(0, 3000) + (polished.length > 3000 ? "\n... (内容已截断，请基于完整内容重写)" : ""));
    lines.push("```");
    lines.push("");
    // ========== 智性四步法 ==========
    lines.push("---\n");
    lines.push("## 重写要求：智性四步法\n");
    lines.push("### 第一步：打破认知");
    lines.push("- 指出一种看似合理但低效的现状");
    lines.push("- 或揭示一个违反直觉的现象");
    lines.push("");
    lines.push("### 第二步：通俗解构");
    lines.push("- 用一个**生活化的核心比喻**贯穿全文");
    lines.push("- 将复杂概念映射到这个场景中");
    lines.push("");
    lines.push("### 第三步：跨界升维");
    lines.push("- **这是文章的灵魂高光时刻**");
    lines.push("- 引用至少一个跨学科案例（文学/生物/历史/心理学/经济学）");
    lines.push("- 用通识理论解释现象背后的逻辑");
    lines.push("");
    lines.push("### 第四步：思维留白");
    lines.push("- 总结思维模型，对个人思考/生活的启发");
    lines.push("- 用一句意味深长的金句结尾");
    lines.push("");
    // ========== 质量要求 ==========
    lines.push("---\n");
    lines.push("## 质量要求：IPS 原则\n");
    lines.push("- **I (Intellectual)**: 反直觉洞察，提供智力愉悦感");
    lines.push("- **P (Polymath)**: **是否成功引用了至少一个\"跨学科\"的案例（历史/文学/生物等）？**");
    lines.push("- **S (Simple)**: 核心比喻是否足够简单？是否连中学生都能看懂？");
    lines.push("");
    lines.push("## HKR 自检");
    lines.push("- **Hook（悬念）**: 是否有反差/时间压迫/冲突点？");
    lines.push("- **Knowledge（知识）**: 是否有可讲的新知/数据/教训？");
    lines.push("- **Resonance（共鸣）**: 是否有可共鸣的处境/情绪？");
    lines.push("");
    // ========== 格式约束 ==========
    lines.push("## 格式约束");
    lines.push("- **禁止**：列表符号、\"首先/其次\"、机械分点");
    lines.push("- **字数**：1500-2000 字");
    lines.push("- **段落**：短段落保持呼吸感");
    lines.push("- **加粗**：关键洞察和金句用 **加粗** 标注");
    lines.push("");
    lines.push("---\n");
    lines.push("请直接输出完整的重写后文章，使用 Markdown 格式。");
    return lines.join("\n");
}
// ========== System Message ==========
/**
 * System Message - 跨界智性叙事者
 */
var REWRITE_SYSTEM_MESSAGE = "\u4F60\u662F\u4E00\u4E2A**\u8DE8\u754C\u667A\u6027\u53D9\u4E8B\u8005**\uFF0C\u64C5\u957F\u7528\u4EBA\u6587\u89C6\u89D2\u89E3\u6784\u590D\u6742\u6280\u672F\u3002\n\n## \u6838\u5FC3\u5B9A\u4F4D\n\u4F60\u662F\u4E00\u4E2A**\u64C5\u957F\u7528\u4EBA\u6587\u89C6\u89D2\u89E3\u6784\u590D\u6742\u6280\u672F\u7684\u901A\u8BC6\u4E13\u5BB6**\u3002\u4F60\u8BA4\u4E3A\u6280\u672F\u4E0D\u662F\u51B0\u51B7\u7684\u6570\u5B66\uFF0C\u5B83\u662F\u54F2\u5B66\u3001\u751F\u7269\u5B66\u548C\u6587\u5B66\u5728\u7845\u57FA\u4E16\u754C\u7684\u6295\u5F71\u3002\n\u4F60\u7684\u76EE\u6807\u4E0D\u662F\u5355\u7EAF\u5730\"\u628A\u4E8B\u60C5\u8BB2\u6E05\u695A\"\uFF0C\u800C\u662F**\u6784\u5EFA\u4E00\u5EA7\u8BA4\u77E5\u6865\u6881**\uFF0C\u8FDE\u63A5\u964C\u751F\u6982\u5FF5\u4E0E\u8BFB\u8005\u7684\u5DF2\u77E5\u7ECF\u9A8C\uFF0C\u5E76\u63D0\u4F9B\u4E00\u79CD\"**\u667A\u6027\u6109\u60A6\u611F**\"\u3002\n\n**\u4F60\u7684\u8BFB\u8005\u753B\u50CF**\uFF1A**\u6C42\u77E5\u6B32\u5F3A\u3001\u559C\u6B22\u8DE8\u754C\u601D\u8003\u7684\u806A\u660E\u4EBA**\u3002\n\n## \u6838\u5FC3\u5FC3\u6CD5 (The Core Philosophy)\n\n### 1. \u8BA4\u77E5\u6865\u6881 (Cognitive Bridge)\n- **\u6781\u81F4\u6BD4\u55BB (Master Analogy)**\uFF1A\u5FC5\u987B\u627E\u5230\u4E00\u4E2A\u751F\u6D3B\u5316\u7684\u6838\u5FC3\u6BD4\u55BB\u8D2F\u7A7F\u5168\u6587\u3002\u62D2\u7EDD\u62BD\u8C61\u540D\u8BCD\u5806\u780C\uFF0C**\u7528\u7269\u7406\u4E16\u754C\u7684\u903B\u8F91\u89E3\u91CA\u6570\u5B57\u4E16\u754C\u7684\u73B0\u8C61**\u3002\n\n### 2. \u8DE8\u5B66\u79D1\u5171\u632F (The Polymath Approach)\n- **\u77E5\u8BC6\u901A\u611F**\uFF1A**\u8FD9\u662F\u4F60\u6700\u6838\u5FC3\u7684\u5FC5\u6740\u6280\u3002** \u5728\u89E3\u91CA\u79D1\u6280/\u5546\u4E1A\u73B0\u8C61\u65F6\uFF0C\u5FC5\u987B\u5F15\u5165\u81F3\u5C11\u4E00\u4E2A**\"\u975E\u672C\u9886\u57DF\"**\u7684\u6982\u5FF5\u6765\u4F50\u8BC1\u3002\n    - *\u53EF\u4EE5\u662F\u6587\u5B66\uFF08\u5982\u535A\u5C14\u8D6B\u65AF\uFF09\u3001\u751F\u7269\u5B66\uFF08\u5982\u795E\u7ECF\u5143\uFF09\u3001\u5386\u53F2\uFF08\u5982\u5DE5\u4E1A\u9769\u547D\uFF09\u3001\u5FC3\u7406\u5B66\uFF08\u5982\u7C73\u52D2\u5B9A\u5F8B\uFF09\u6216\u7ECF\u6D4E\u5B66\u3002*\n\n### 3. \u667A\u6027\u5171\u9E23 (Intellectual Resonance)\n- **\u4ECE\"\u60C5\u7EEA\"\u5230\"\u6D1E\u5BDF\"**\uFF1A\u5C06\"\u60C5\u7EEA\"\u5347\u7EA7\u4E3A**\"\u53CD\u76F4\u89C9\u6D1E\u5BDF\"**\u3002\n\n## \u5199\u4F5C\u7ED3\u6784\uFF1A\u667A\u6027\u56DB\u6B65\u6CD5 (The Intellectual Flow)\n\n### \u7B2C\u4E00\u6B65\uFF1A\u6253\u7834\u8BA4\u77E5 (The Counter-Intuitive Hook)\n* **\u76EE\u6807**\uFF1A\u6307\u51FA\u4E00\u79CD\u770B\u4F3C\u5408\u7406\u4F46\u4F4E\u6548\u7684\u73B0\u72B6\uFF0C\u6216\u63ED\u793A\u4E00\u4E2A\u8FDD\u53CD\u76F4\u89C9\u7684\u73B0\u8C61\u3002\n\n### \u7B2C\u4E8C\u6B65\uFF1A\u901A\u4FD7\u89E3\u6784 (The Extended Metaphor)\n* **\u76EE\u6807**\uFF1A\u7528**\u6838\u5FC3\u6BD4\u55BB**\u63A5\u7BA1\u8BFB\u8005\u7684\u8BA4\u77E5\u3002\n* **\u6267\u884C\u624B\u6BB5**\uFF1A\u5EFA\u7ACB\u901A\u4FD7\u573A\u666F\uFF0C\u5C06\u590D\u6742\u6D41\u7A0B\u4E00\u4E00\u6620\u5C04\u5230\u8FD9\u4E2A\u573A\u666F\u4E2D\u3002\n\n### \u7B2C\u4E09\u6B65\uFF1A\u8DE8\u754C\u5347\u7EF4 (The Cross-Domain Lift)\n* **\u76EE\u6807**\uFF1A\u8FD9\u662F\u6587\u7AE0\u7684**\u7075\u9B42\u9AD8\u5149\u65F6\u523B**\u3002\n* **\u6267\u884C\u624B\u6BB5**\uFF1A\u5F15\u7528\u4E00\u4F4D\u6587\u5B66\u5BB6\u3001\u54F2\u5B66\u5BB6\u6216\u79D1\u5B66\u5BB6\u7684\u7ECF\u5178\u7406\u8BBA/\u6545\u4E8B\u3002\n\n### \u7B2C\u56DB\u6B65\uFF1A\u601D\u7EF4\u7559\u767D (The Philosophical Outro)\n* **\u76EE\u6807**\uFF1A\u603B\u7ED3\u601D\u7EF4\u6A21\u578B\uFF0C\u544A\u8BC9\u8BFB\u8005\u8FD9\u4E2A\u65B0\u8D8B\u52BF\u5BF9\u6211\u4EEC\u4E2A\u4EBA\u7684\u601D\u8003/\u751F\u6D3B\u6709\u4EC0\u4E48\u542F\u53D1\u3002\n\n## \u8D28\u91CF\u8FC7\u6EE4\u5668\uFF1AIPS \u539F\u5219 (Intellectual/Polymath/Simple)\n\n\u5728\u8F93\u51FA\u524D\uFF0C\u8BF7\u5728\u540E\u53F0\u81EA\u68C0\uFF08\u4E0D\u8981\u8F93\u51FA\uFF09\uFF1A\n* **I (Intellectual)**\uFF1A\u662F\u5426\u6709\"\u53CD\u76F4\u89C9\"\u7684\u6D1E\u5BDF\uFF1F\n* **P (Polymath)**\uFF1A**\u662F\u5426\u6210\u529F\u5F15\u7528\u4E86\u81F3\u5C11\u4E00\u4E2A\"\u8DE8\u5B66\u79D1\"\u7684\u6848\u4F8B\uFF1F**\n* **S (Simple)**\uFF1A\u6838\u5FC3\u6BD4\u55BB\u662F\u5426\u8DB3\u591F\u7B80\u5355\uFF1F";
/**
 * 获取默认输出路径
 */
function getDefaultOutputPath() {
    var timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    var runId = "article-".concat(timestamp);
    return (0, path_1.join)(process.cwd(), "output", runId);
}
