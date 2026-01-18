"use strict";
/**
 * Draft 节点 v2
 *
 * 职责: 基于选定的标题、调研结果和 RAG 内容撰写初稿
 *
 * 数据流:
 * title + researchResult (Brief) + ragContent → LLM 撰写 → draft (Markdown)
 *
 * 改进点:
 * - 解析 Brief 提取核心洞察、框架、推荐角度
 * - 解析 RAG 提取金句、参考文章
 * - 结构化 Prompt 指导 LLM 撰写
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
exports.draftNode = draftNode;
var fs_1 = require("fs");
var path_1 = require("path");
var llm_js_1 = require("../../../config/llm.js");
var llm_client_js_1 = require("../../../utils/llm-client.js");
var dotenv_1 = require("dotenv");
var path_2 = require("path");
(0, dotenv_1.config)({ path: (0, path_2.resolve)(process.cwd(), ".env") });
// ========== Draft 节点主函数 ==========
/**
 * Draft 节点主函数
 *
 * @param state - 当前状态
 * @returns 更新的状态
 */
function draftNode(state) {
    return __awaiter(this, void 0, void 0, function () {
        var title, brief, rag, prompt, llmConfig, client, response, draft, outputPath, draftsDir, draftPath, error_1;
        var _a, _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    console.log("[05_draft] Writing draft for title:", ((_a = state.decisions) === null || _a === void 0 ? void 0 : _a.selectedTitle) || ((_b = state.titles) === null || _b === void 0 ? void 0 : _b[0]));
                    title = ((_c = state.decisions) === null || _c === void 0 ? void 0 : _c.selectedTitle) || ((_d = state.titles) === null || _d === void 0 ? void 0 : _d[0]) || state.topic || "无标题";
                    brief = parseBrief(state.researchResult || "");
                    rag = parseRAG(state.ragContent || "");
                    console.log("[05_draft] Parsed Brief:", {
                        topic: brief.topic,
                        insightsCount: brief.keyInsights.length,
                        hasAngle: !!brief.recommendedAngle,
                        dataPointsCount: brief.dataPoints.length
                    });
                    console.log("[05_draft] Parsed RAG:", {
                        quotesCount: rag.quotes.length,
                        articleSnippets: rag.articleSnippets.length,
                        titlesCount: rag.referenceTitles.length
                    });
                    prompt = buildDraftPrompt(title, brief, rag);
                    llmConfig = (0, llm_js_1.getNodeLLMConfig)("draft");
                    client = new llm_client_js_1.LLMClient(llmConfig);
                    console.log("[05_draft] Calling LLM with config:", llmConfig.model);
                    _e.label = 1;
                case 1:
                    _e.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, client.call({
                            prompt: prompt,
                            systemMessage: DRAFT_SYSTEM_MESSAGE
                        })];
                case 2:
                    response = _e.sent();
                    console.log("[05_draft] Draft generated, length:", response.text.length);
                    console.log("[05_draft] Usage:", response.usage);
                    draft = response.text;
                    outputPath = state.outputPath || getDefaultOutputPath();
                    draftsDir = (0, path_1.join)(outputPath, "drafts");
                    if (!(0, fs_1.existsSync)(draftsDir)) {
                        (0, fs_1.mkdirSync)(draftsDir, { recursive: true });
                    }
                    draftPath = (0, path_1.join)(draftsDir, "05_draft.md");
                    (0, fs_1.writeFileSync)(draftPath, draft, "utf-8");
                    console.log("[05_draft] Saved draft:", draftPath);
                    return [2 /*return*/, {
                            draft: draft,
                            outputPath: outputPath
                        }];
                case 3:
                    error_1 = _e.sent();
                    console.error("[05_draft] Failed to generate draft: ".concat(error_1));
                    throw error_1;
                case 4: return [2 /*return*/];
            }
        });
    });
}
// ========== 解析器 ==========
/**
 * 解析 Brief Markdown 提取关键信息
 *
 * Brief 结构 (参考 brief-generator.ts):
 * - 核心洞察 (## 核心洞察)
 * - 关键概念框架 (## 关键概念框架)
 * - 数据引用清单 (## 数据引用清单)
 * - 推荐写作角度 (## 推荐写作角度)
 */
function parseBrief(brief) {
    var result = {
        keyInsights: [],
        framework: "",
        recommendedAngle: null,
        dataPoints: [],
        topic: ""
    };
    // 提取主题
    var topicMatch = brief.match(/主题[：:]\s*(.+?)(?:\n|$)/i);
    if (topicMatch) {
        result.topic = topicMatch[1].trim();
    }
    // 提取核心洞察
    var insightsSection = extractSection(brief, "## 核心洞察", "##");
    if (insightsSection) {
        // 提取所有 ### 开头的子标题内容
        var insightMatches = insightsSection.split("###").filter(function (s) { return s.trim(); });
        result.keyInsights = insightMatches.map(function (s) {
            var lines = s.trim().split("\n");
            // 第一行是标题，后续是内容
            var title = lines[0].replace(/^\d+\.\s*/, "").trim();
            var content = lines.slice(1).join(" ").trim();
            return content || title;
        }).filter(Boolean);
    }
    // 提取概念框架
    var frameworkSection = extractSection(brief, "## 关键概念框架", "##");
    if (frameworkSection) {
        // 提取代码块内容
        var codeMatch = frameworkSection.match(/```([\s\S]*?)```/);
        if (codeMatch) {
            result.framework = codeMatch[1].trim();
        }
        else {
            // 没有代码块，取整个 section
            result.framework = frameworkSection
                .replace(/###\s*[^\n]*/g, "") // 移除子标题
                .trim();
        }
    }
    // 提取推荐角度
    var angleSection = extractSection(brief, "## 推荐写作角度", "##");
    if (angleSection) {
        var angleNameMatch = angleSection.match(/推荐[：:]\s*(.+?)(?:\n|$)/i);
        var coreArgMatch = angleSection.match(/核心论点[：:]\s*(.+?)(?:\n|$)/i);
        var evidenceMatch = angleSection.match(/论据支撑[：:]\s*(.+?)(?:\n|$)/i);
        var diffMatch = angleSection.match(/差异化价值[：:]\s*(.+?)(?:\n|$)/i);
        if (angleNameMatch || coreArgMatch) {
            result.recommendedAngle = {
                name: angleNameMatch ? angleNameMatch[1].trim() : "未命名角度",
                coreArgument: coreArgMatch ? coreArgMatch[1].trim() : "",
                evidence: evidenceMatch ? evidenceMatch[1].split(/[、,，]/).map(function (s) { return s.trim(); }).filter(Boolean) : [],
                differentiation: diffMatch ? diffMatch[1].trim() : ""
            };
        }
    }
    // 提取数据支撑
    var dataSection = extractSection(brief, "## 数据引用清单", "##");
    if (dataSection) {
        // 每行一个数据点
        result.dataPoints = dataSection
            .split("\n")
            .map(function (line) { return line.replace(/^\d+\.\s*/, "").trim(); })
            .filter(function (line) { return line.length > 10; }); // 过滤太短的行
    }
    return result;
}
/**
 * 解析 RAG Markdown 提取有用内容
 *
 * RAG 结构 (参考 rag-formatter.ts):
 * - 相关金句 (## 相关金句)
 * - 相关文章片段 (## 相关文章片段)
 * - 参考标题 (## 参考标题)
 */
function parseRAG(rag) {
    var result = {
        quotes: [],
        articleSnippets: [],
        referenceTitles: [],
        hasContent: !rag.includes("索引未初始化")
    };
    if (!result.hasContent) {
        return result;
    }
    // 提取金句
    var quotesSection = extractSection(rag, "## 相关金句", "##");
    if (quotesSection) {
        // 提取 ### 开头的内容
        var quoteMatches = quotesSection.split("###").filter(function (s) { return s.trim(); });
        result.quotes = quoteMatches
            .map(function (s) {
            var lines = s.trim().split("\n");
            // 第一行通常是序号，取实际内容
            var content = lines.slice(1).join(" ").trim();
            return content;
        })
            .filter(function (q) { return q.length > 5; })
            .slice(0, 3); // 最多取 3 条金句
    }
    // 提取文章片段
    var articlesSection = extractSection(rag, "## 相关文章片段", "##");
    if (articlesSection) {
        // 提取 ### 开头的内容
        var articleMatches = articlesSection.split("###").filter(function (s) { return s.trim(); });
        result.articleSnippets = articleMatches
            .map(function (s) {
            var lines = s.trim().split("\n");
            // 第一行是标题，后续是内容
            return lines.slice(1).join("\n").trim();
        })
            .filter(function (s) { return s.length > 20; })
            .slice(0, 2); // 最多取 2 个片段
    }
    // 提取参考标题
    var titlesSection = extractSection(rag, "## 参考标题", "##");
    if (titlesSection) {
        result.referenceTitles = titlesSection
            .split("\n")
            .map(function (line) { return line.replace(/^\d+\.\s*/, "").trim(); })
            .filter(function (line) { return line.length > 2; })
            .slice(0, 5); // 最多取 5 个标题
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
 * 构建初稿 Prompt
 */
function buildDraftPrompt(title, brief, rag) {
    var lines = [];
    lines.push("# 写作任务\n");
    lines.push("\u8BF7\u57FA\u4E8E\u4EE5\u4E0B\u7D20\u6750\u64B0\u5199\u4E00\u7BC7\u6587\u7AE0\u3002\n");
    // ========== 标题 ==========
    lines.push("## 标题");
    lines.push(title);
    lines.push("");
    // ========== 推荐角度 (核心) ==========
    if (brief.recommendedAngle) {
        lines.push("## 推荐写作角度");
        lines.push("**\u89D2\u5EA6**: ".concat(brief.recommendedAngle.name));
        lines.push("**\u6838\u5FC3\u8BBA\u70B9**: ".concat(brief.recommendedAngle.coreArgument));
        if (brief.recommendedAngle.evidence.length > 0) {
            lines.push("**论据支撑**:");
            brief.recommendedAngle.evidence.forEach(function (ev) {
                lines.push("  - ".concat(ev));
            });
        }
        if (brief.recommendedAngle.differentiation) {
            lines.push("**\u5DEE\u5F02\u5316**: ".concat(brief.recommendedAngle.differentiation));
        }
        lines.push("");
    }
    // ========== 核心洞察 ==========
    if (brief.keyInsights.length > 0) {
        lines.push("## 核心洞察");
        brief.keyInsights.forEach(function (insight, i) {
            lines.push("".concat(i + 1, ". ").concat(insight));
        });
        lines.push("");
    }
    // ========== 分析框架 ==========
    if (brief.framework) {
        lines.push("## 分析框架");
        lines.push("```");
        lines.push(brief.framework);
        lines.push("```");
        lines.push("");
    }
    // ========== 数据支撑 ==========
    if (brief.dataPoints.length > 0) {
        lines.push("## 数据支撑");
        brief.dataPoints.slice(0, 5).forEach(function (point, i) {
            lines.push("".concat(i + 1, ". ").concat(point));
        });
        lines.push("");
    }
    // ========== RAG 内容 ==========
    if (rag.hasContent) {
        if (rag.quotes.length > 0) {
            lines.push("## 参考金句 (可用于开头/结尾)");
            rag.quotes.forEach(function (quote, i) {
                lines.push("".concat(i + 1, ". ").concat(quote));
            });
            lines.push("");
        }
        if (rag.articleSnippets.length > 0) {
            lines.push("## 参考文章片段 (论据补充)");
            rag.articleSnippets.forEach(function (snippet, i) {
                lines.push("### \u7247\u6BB5 ".concat(i + 1));
                lines.push(snippet.slice(0, 300) + (snippet.length > 300 ? "..." : ""));
                lines.push("");
            });
        }
    }
    // ========== 写作要求 ==========
    lines.push("---\n");
    lines.push("## 写作要求");
    lines.push("");
    lines.push("### 结构要求");
    lines.push("1. **开头**: 用金句/数据/场景引入，吸引读者");
    lines.push("2. **正文**: 基于核心论点展开，每个论点有数据或案例支撑");
    lines.push("3. **结尾**: 总结要点 + 延伸思考 + 行动建议");
    lines.push("");
    lines.push("### 风格要求");
    lines.push("- 适合微信公众号阅读 (1500-2500字)");
    lines.push("- 段落简短 (3-5句话)");
    lines.push("- 使用过渡词连接段落");
    lines.push("- 适度使用列表和引用");
    lines.push("");
    lines.push("### 格式要求");
    lines.push("- 使用 Markdown 标题结构 (##, ###)");
    lines.push("- 重点内容用 **加粗** 标注");
    lines.push("- 避免过度使用格式");
    lines.push("");
    lines.push("---\n");
    lines.push("请直接输出完整的文章内容，使用 Markdown 格式。");
    return lines.join("\n");
}
// ========== System Message ==========
/**
 * System Message
 */
var DRAFT_SYSTEM_MESSAGE = "\u4F60\u662F\u4E00\u4E2A\u4E13\u4E1A\u7684\u516C\u4F17\u53F7\u4F5C\u8005\uFF0C\u64C5\u957F\u64B0\u5199\u6DF1\u5EA6\u5206\u6790\u548C\u6280\u672F\u79D1\u666E\u5185\u5BB9\u3002\n\n## \u6838\u5FC3\u80FD\u529B\n- \u6E05\u6670\u7684\u903B\u8F91\u7ED3\u6784\u548C\u8BBA\u8BC1\u6846\u67B6\n- \u4E30\u5BCC\u7684\u6848\u4F8B\u548C\u7C7B\u6BD4\n- \u901A\u4FD7\u800C\u7CBE\u51C6\u7684\u8BED\u8A00\u8868\u8FBE\n- \u6570\u636E\u652F\u6491\u7684\u89C2\u70B9\n\n## \u5199\u4F5C\u98CE\u683C\n1. **\u5F00\u5934\u5438\u5F15\u6CE8\u610F**: \u7528\u91D1\u53E5\u3001\u95EE\u9898\u3001\u573A\u666F\u6216\u6570\u636E\u5F15\u5165\n2. **\u8BBA\u70B9\u6E05\u6670\u660E\u786E**: \u6BCF\u4E2A\u6BB5\u843D\u4E00\u4E2A\u6838\u5FC3\u89C2\u70B9\n3. **\u8FC7\u6E21\u81EA\u7136\u6D41\u7545**: \u4F7F\u7528\u8FC7\u6E21\u8BCD\u8FDE\u63A5\u6BB5\u843D\n4. **\u7ED3\u5C3E\u6709\u529B\u5347\u534E**: \u603B\u7ED3\u8981\u70B9 + \u5EF6\u4F38\u601D\u8003 + \u884C\u52A8\u5EFA\u8BAE\n\n## \u7ED3\u6784\u53C2\u8003\n- \u5F15\u8A00: \u4E3A\u4EC0\u4E48\u8FD9\u4E2A\u8BDD\u9898\u91CD\u8981\uFF1F\n- \u8BBA\u70B91: \u6838\u5FC3\u6982\u5FF5\u89E3\u91CA (\u7C7B\u6BD4/\u4E3E\u4F8B)\n- \u8BBA\u70B92: \u5B9E\u9645\u5E94\u7528/\u4EF7\u503C\n- \u8BBA\u70B93: \u5E38\u89C1\u95EE\u9898/\u6CE8\u610F\u4E8B\u9879\n- \u8BBA\u70B94: \u672A\u6765\u8D8B\u52BF/\u53D1\u5C55\n- \u7ED3\u5C3E: \u603B\u7ED3 + \u884C\u52A8\u5EFA\u8BAE\n\n## \u683C\u5F0F\u8981\u6C42\n- \u4F7F\u7528 Markdown \u6807\u9898\u7ED3\u6784 (##, ###)\n- \u6BB5\u843D\u4E0D\u8981\u592A\u957F (3-5\u53E5\u8BDD)\n- \u9002\u5EA6\u4F7F\u7528\u5217\u8868\u548C\u5F15\u7528\n- \u907F\u514D\u8FC7\u5EA6\u4F7F\u7528\u683C\u5F0F";
// ========== 辅助函数 ==========
/**
 * 获取默认输出路径
 */
function getDefaultOutputPath() {
    var timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    var runId = "article-".concat(timestamp);
    return (0, path_1.join)(process.cwd(), "output", runId);
}
