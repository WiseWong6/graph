"use strict";
/**
 * Research 节点
 *
 * 职责: 基于用户输入进行深度调研,生成 Brief 和 Handoff
 *
 * 数据流:
 * prompt → 输入检测 → 网络搜索 → LLM 分析 → Brief/Handoff → 文件落盘
 *
 * 设计原则:
 * - 并行执行搜索和分析
 * - 优先使用 MCP,降级到 HTTP
 * - 置信度标签系统
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
exports.researchNode = researchNode;
var fs_1 = require("fs");
var path_1 = require("path");
var llm_js_1 = require("../../../config/llm.js");
var llm_client_js_1 = require("../../../utils/llm-client.js");
// 辅助工具
var input_detector_js_1 = require("../../../utils/input-detector.js");
var research_scorer_js_1 = require("../../../utils/research-scorer.js");
var brief_generator_js_1 = require("../../../utils/brief-generator.js");
var handoff_builder_js_1 = require("../../../utils/handoff-builder.js");
// 加载环境变量
var dotenv_1 = require("dotenv");
(0, dotenv_1.config)({ path: (0, path_1.resolve)(process.cwd(), ".env") });
/**
 * Research 节点主函数
 *
 * @param state - 当前状态
 * @returns 更新的状态
 */
function researchNode(state) {
    return __awaiter(this, void 0, void 0, function () {
        var startTime, inputDetection, complexity, _a, searchResults, trends, analysisResult, _i, _b, finding, anySourceWithDate, freshness, researchTimeMs, briefData, handoffData, briefMarkdown, handoffYaml, outputPath, researchDir, briefPath, handoffPath;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    startTime = Date.now();
                    console.log("[01_research] Starting research for:", state.prompt);
                    // ========== 步骤 1: 输入检测 ==========
                    console.log("[01_research] Step 1: Detecting input type...");
                    inputDetection = (0, input_detector_js_1.detectInputType)(state.prompt);
                    complexity = (0, input_detector_js_1.analyzeComplexity)(inputDetection);
                    console.log("[01_research] Input type: ".concat(inputDetection.type, ", complexity: ").concat(complexity));
                    console.log("[01_research] Detected topic: ".concat(inputDetection.topic));
                    // ========== 步骤 2: 并行执行搜索和分析 ==========
                    console.log("[01_research] Step 2: Running parallel research...");
                    return [4 /*yield*/, Promise.all([
                            performSearch(inputDetection.topic),
                            analyzeTrends(inputDetection.topic)
                        ])];
                case 1:
                    _a = _c.sent(), searchResults = _a[0], trends = _a[1];
                    console.log("[01_research] Found ".concat(searchResults.length, " search results"));
                    console.log("[01_research] Identified ".concat(trends.length, " trends"));
                    // ========== 步骤 3: 使用 LLM 分析结果（重构版） ==========
                    console.log("[01_research] Step 3: Analyzing with LLM...");
                    return [4 /*yield*/, analyzeWithLLM(inputDetection.topic, searchResults)];
                case 2:
                    analysisResult = _c.sent();
                    // 计算置信度
                    for (_i = 0, _b = analysisResult.findings; _i < _b.length; _i++) {
                        finding = _b[_i];
                        finding.confidence_score = (0, research_scorer_js_1.calculateConfidence)(finding);
                        finding.confidence_type = (0, research_scorer_js_1.inferConfidenceType)(finding);
                        finding.cross_verified = (0, research_scorer_js_1.needsCrossVerification)(finding.claim) && finding.sources.length >= 2;
                        anySourceWithDate = finding.sources.find(function (s) { return s.date; });
                        if (anySourceWithDate) {
                            freshness = (0, research_scorer_js_1.calculateFreshness)(finding);
                            finding.freshness_status = freshness >= 0.8 ? "current" : freshness >= 0.4 ? "needs_update" : "outdated";
                        }
                        else {
                            finding.freshness_status = "current"; // 无日期信息,默认为当前
                        }
                    }
                    console.log("[01_research] Generated ".concat(analysisResult.findings.length, " findings"));
                    console.log("[01_research] Average confidence: ".concat(analysisResult.findings.reduce(function (sum, f) { return sum + f.confidence_score; }, 0) / analysisResult.findings.length));
                    // ========== 步骤 4: 生成 Brief 和 Handoff（重构版） ==========
                    console.log("[01_research] Step 4: Generating Brief and Handoff...");
                    researchTimeMs = Date.now() - startTime;
                    briefData = {
                        input: state.prompt,
                        detected_topic: inputDetection.topic,
                        input_type: inputDetection.type,
                        platform: inputDetection.platform,
                        style: inputDetection.style,
                        angle: inputDetection.angle,
                        complexity: complexity,
                        trends: trends,
                        key_findings: analysisResult.findings,
                        // 新增：内容创作视角
                        key_insights: analysisResult.key_insights,
                        data_points: analysisResult.data_points,
                        framework: analysisResult.framework,
                        angles: analysisResult.angles,
                        recommended_angle: analysisResult.recommended_angle,
                        generated_at: new Date().toISOString(),
                        research_time_ms: researchTimeMs
                    };
                    handoffData = (0, handoff_builder_js_1.buildHandoff)(inputDetection, trends, analysisResult.findings, researchTimeMs);
                    briefMarkdown = (0, brief_generator_js_1.generateBriefMarkdown)(briefData);
                    handoffYaml = (0, handoff_builder_js_1.handoffToYaml)(handoffData);
                    console.log("[01_research] Brief summary:");
                    console.log("  ".concat((0, brief_generator_js_1.generateBriefSummary)(briefData).split("\n").join("\n  ")));
                    // ========== 步骤 5: 保存文件 ==========
                    console.log("[01_research] Step 5: Saving files...");
                    outputPath = state.outputPath || getDefaultOutputPath();
                    researchDir = (0, path_1.join)(outputPath, "research");
                    // 确保目录存在
                    if (!(0, fs_1.existsSync)(researchDir)) {
                        (0, fs_1.mkdirSync)(researchDir, { recursive: true });
                    }
                    briefPath = (0, path_1.join)(researchDir, "00_brief.md");
                    (0, fs_1.writeFileSync)(briefPath, briefMarkdown, "utf-8");
                    console.log("[01_research] Saved Brief: ".concat(briefPath));
                    handoffPath = (0, path_1.join)(researchDir, "00_handoff.yaml");
                    (0, fs_1.writeFileSync)(handoffPath, handoffYaml, "utf-8");
                    console.log("[01_research] Saved Handoff: ".concat(handoffPath));
                    console.log("[01_research] Total time: ".concat((researchTimeMs / 1000).toFixed(2), "s"));
                    return [2 /*return*/, {
                            researchResult: briefMarkdown,
                            topic: inputDetection.topic,
                            outputPath: outputPath
                        }];
            }
        });
    });
}
/**
 * 执行网络搜索
 *
 * 使用并行搜索管理器，自动协调多个搜索源
 *
 * 优先级:
 * 1. mcp-webresearch (Google 搜索，第一优先级)
 * 2. DuckDuckGo (免费搜索，第二优先级)
 * 3. Firecrawl (付费搜索，第三优先级)
 */
function performSearch(topic) {
    return __awaiter(this, void 0, void 0, function () {
        var createParallelSearchManager, searchManager, _a, results, sources, metadata;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    console.log("[01_research] 使用并行搜索管理器...");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../../../adapters/parallel-search.js"); })];
                case 1:
                    createParallelSearchManager = (_b.sent()).createParallelSearchManager;
                    searchManager = createParallelSearchManager();
                    return [4 /*yield*/, searchManager.parallelSearch(topic, {
                            limit: 10,
                            timeout: 8000,
                            minResults: 3,
                            enableFirecrawl: !!process.env.FIRECRAWL_API_KEY
                        })];
                case 2:
                    _a = _b.sent(), results = _a.results, sources = _a.sources, metadata = _a.metadata;
                    console.log("[01_research] \u641C\u7D22\u5B8C\u6210: ".concat(results.length, " \u4E2A\u7ED3\u679C"));
                    console.log("[01_research] \u6570\u636E\u6E90: ".concat(sources.join(", ")));
                    console.log("[01_research] \u8BE6\u60C5:", metadata.bySource);
                    return [2 /*return*/, results.map(function (r) { return ({
                            title: r.title,
                            url: r.url,
                            description: r.snippet
                        }); })];
            }
        });
    });
}
/**
 * 分析趋势
 *
 * 简化版: 使用关键词检测
 * TODO: 集成真实的趋势分析 API
 */
function analyzeTrends(topic) {
    return __awaiter(this, void 0, void 0, function () {
        var trends, growthKeywords, hasGrowth;
        return __generator(this, function (_a) {
            trends = [];
            growthKeywords = ["AI", "人工智能", "机器学习", "LLM", "大模型", "Agent"];
            hasGrowth = growthKeywords.some(function (kw) { return topic.toLowerCase().includes(kw.toLowerCase()); });
            if (hasGrowth) {
                trends.push({
                    topic: "".concat(topic, " \u76F8\u5173\u6280\u672F"),
                    signal_strength: "high",
                    growth_rate: "+65%",
                    time_window: "过去 60 天",
                    confidence_score: 0.85
                });
            }
            return [2 /*return*/, trends];
        });
    });
}
/**
 * 使用 LLM 分析搜索结果（重构版 - 内容创作视角）
 */
function analyzeWithLLM(topic, searchResults) {
    return __awaiter(this, void 0, void 0, function () {
        var llmConfig, client, searchResultsText, prompt, response, analysisResult, error_1;
        var _a, _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    if (searchResults.length === 0) {
                        console.log("[01_research] No search results to analyze");
                        return [2 /*return*/, { findings: [] }];
                    }
                    llmConfig = (0, llm_js_1.getNodeLLMConfig)("research");
                    client = new llm_client_js_1.LLMClient(llmConfig);
                    searchResultsText = searchResults
                        .map(function (r, i) { return "".concat(i + 1, ". ").concat(r.title, "\n   URL: ").concat(r.url, "\n   \u6458\u8981: ").concat(r.description || "无摘要", "\n"); })
                        .join("\n");
                    prompt = "\u4F60\u662F\u4E00\u4F4D\u4E13\u4E1A\u7684\u5185\u5BB9\u521B\u4F5C\u7814\u7A76\u5458\uFF0C\u64C5\u957F\u4ECE\u641C\u7D22\u7ED3\u679C\u4E2D\u63D0\u53D6\u521B\u4F5C\u7D20\u6750\u548C\u6D1E\u5BDF\u3002\n\n\u4E3B\u9898: ".concat(topic, "\n\n\u641C\u7D22\u7ED3\u679C (").concat(searchResults.length, " \u6761):\n").concat(searchResultsText, "\n\n\u8BF7\u4ECE**\u5185\u5BB9\u521B\u4F5C\u89C6\u89D2**\u5206\u6790\u8FD9\u4E9B\u7ED3\u679C\uFF0C\u8F93\u51FA\u4EE5\u4E0B\u5185\u5BB9\uFF1A\n\n1. **\u5173\u952E\u53D1\u73B0** (3-5\u4E2A)\n   - \u6838\u5FC3\u89C2\u70B9\uFF08claim\uFF09\n   - \u652F\u6301\u6765\u6E90\u6570\u91CF\n\n2. **\u5173\u952E\u6D1E\u5BDF** (3-5\u4E2A)\n   - \u4ECE\u641C\u7D22\u7ED3\u679C\u4E2D\u63D0\u70BC\u7684\u6838\u5FC3\u6D1E\u5BDF\n   - \u6BCF\u4E2A\u6D1E\u5BDF\u7528\"\u6D1E\u5BDF\u540D\u79F0\uFF1A\u8BE6\u7EC6\u8BF4\u660E\"\u7684\u683C\u5F0F\n\n3. **\u6570\u636E\u652F\u6491**\n   - \u63D0\u53D6\u6240\u6709\u5177\u4F53\u6570\u5B57\u3001\u767E\u5206\u6BD4\u3001\u5BF9\u6BD4\u6570\u636E\n   - \u683C\u5F0F\uFF1A{\"\u5173\u952E\u6307\u6807\": \"\u5177\u4F53\u6570\u503C\"}\n\n4. **\u5206\u6790\u6846\u67B6** (\u5982\u679C\u9002\u7528)\n   - \u6784\u5EFA\u4E00\u4E2A\u5206\u6790\u6846\u67B6\u6765\u7EC4\u7EC7\u5185\u5BB9\n   - \u683C\u5F0F\uFF1A\u7528\u5206\u5C42\u7ED3\u6784\u8868\u793A\uFF08\u5982\"\u7B2C\u4E00\u5C42\uFF1A... \u7B2C\u4E8C\u5C42\uFF1A...\"\uFF09\n\n5. **\u5DEE\u5F02\u5316\u89D2\u5EA6\u5EFA\u8BAE** (3\u4E2A)\n   - \u4E3A\u8FD9\u4E2A\u4E3B\u9898\u8BBE\u8BA13\u4E2A\u4E0D\u540C\u7684\u5199\u4F5C\u89D2\u5EA6\n   - \u6BCF\u4E2A\u89D2\u5EA6\u5305\u542B\uFF1A\u540D\u79F0\u3001\u6838\u5FC3\u8BBA\u70B9\u3001\u8BBA\u636E\u652F\u6491\u3001\u5DEE\u5F02\u5316\u8BF4\u660E\u3001\u53EF\u884C\u6027\u8BC4\u5206(0-10)\n\n6. **\u63A8\u8350\u5199\u4F5C\u89D2\u5EA6**\n   - \u4ECE3\u4E2A\u89D2\u5EA6\u4E2D\u9009\u62E9\u6700\u4F18\u7684\u4E00\u4E2A\n   - \u7ED9\u51FA\u63A8\u8350\u7406\u7531\uFF083\u6761\u4EE5\u4E0A\uFF09\n\n\u8F93\u51FA\u683C\u5F0F(JSON):\n{\n  \"findings\": [\n    {\"claim\": \"\u89C2\u70B9\", \"sources_count\": 2}\n  ],\n  \"key_insights\": [\n    \"\u89C4\u6A21\u9677\u9631\u4E0E\u6548\u7387\u56F0\u5883\uFF1A\u8FDE\u9501\u9910\u996E\u5728\u6269\u5F20\u8FC7\u7A0B\u4E2D\u9762\u4E34\u5355\u5E97\u6548\u7387\u4E0E\u89C4\u6A21\u8131\u94A9\u7684\u95EE\u9898\"\n  ],\n  \"data_points\": {\n    \"\u6D77\u5E95\u635E2020\u5E74\u5BA2\u5355\u4EF7\": \"110\u5143\",\n    \"\u6D77\u5E95\u635E2024\u5E74\u5BA2\u5355\u4EF7\": \"97.5\u5143\"\n  },\n  \"framework\": \"\u7B2C\u4E00\u5C42\uFF1A\u8DEF\u5F84\u4F9D\u8D56\n\u7B2C\u4E8C\u5C42\uFF1A\u4F53\u7CFB\u6210\u672C\u521A\u6027\n...\",\n  \"angles\": [\n    {\n      \"name\": \"\u7EC4\u7EC7\u7BA1\u7406\u89C6\u89D2\",\n      \"core_argument\": \"\u897F\u8D1D\u7684\u56F0\u5883\u662F\u7EC4\u7EC7\u80FD\u529B\u9677\u9631\uFF0C\u4E0D\u662F\u4E2A\u4EBA\u5FC3\u7406\u95EE\u9898\",\n      \"evidence\": [\"\u4E2D\u592E\u53A8\u623F\u6A21\u5F0F\u7684\u6548\u7387\u6096\u8BBA\", \"\u4F53\u7CFB\u6210\u672C\u521A\u6027\"],\n      \"differentiation\": \"\u4E0E\u300A\u8D3E\u56FD\u9F99\u7684\u5FC3\u9B54\u300B\uFF08\u4E2A\u4EBA\u5FC3\u7406\uFF09\u5F62\u6210\u4E92\u8865\",\n      \"feasibility\": 9\n    }\n  ],\n  \"recommended_angle\": {\n    \"name\": \"\u7EC4\u7EC7\u7BA1\u7406\u89C6\u89D2\",\n    \"core_argument\": \"\u897F\u8D1D\u7684\u56F0\u5883\u662F\u7EC4\u7EC7\u80FD\u529B\u9677\u9631\",\n    \"evidence\": [\"\u8BC1\u636E1\", \"\u8BC1\u636E2\"],\n    \"differentiation\": \"\u4E0E\u53C2\u8003\u6587\u7AE0\u5F62\u6210\u4E92\u8865\",\n    \"feasibility\": 9\n  }\n}");
                    _d.label = 1;
                case 1:
                    _d.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, client.call({
                            prompt: prompt,
                            systemMessage: "你是一位专业的内容创作研究员，擅长从搜索结果中提炼创作素材、洞察和框架。你的输出必须严格符合 JSON 格式。"
                        })];
                case 2:
                    response = _d.sent();
                    analysisResult = parseLLMAnalysisOutput(response.text, searchResults);
                    console.log("[01_research] LLM \u5206\u6790\u5B8C\u6210:");
                    console.log("  - ".concat(analysisResult.findings.length, " \u4E2A\u5173\u952E\u53D1\u73B0"));
                    console.log("  - ".concat(((_a = analysisResult.key_insights) === null || _a === void 0 ? void 0 : _a.length) || 0, " \u4E2A\u5173\u952E\u6D1E\u5BDF"));
                    console.log("  - ".concat(((_b = analysisResult.angles) === null || _b === void 0 ? void 0 : _b.length) || 0, " \u4E2A\u5199\u4F5C\u89D2\u5EA6"));
                    console.log("  - \u63A8\u8350\u89D2\u5EA6: ".concat(((_c = analysisResult.recommended_angle) === null || _c === void 0 ? void 0 : _c.name) || "未定"));
                    return [2 /*return*/, analysisResult];
                case 3:
                    error_1 = _d.sent();
                    console.error("[01_research] LLM analysis failed: ".concat(error_1));
                    // 降级: 为每个搜索结果创建一个简单的 finding
                    return [2 /*return*/, {
                            findings: searchResults.slice(0, 5).map(function (result) { return ({
                                claim: result.description || result.title,
                                confidence_type: "BELIEF",
                                confidence_score: 0.5,
                                sources: [{
                                        url: result.url,
                                        title: result.title,
                                        domain: new URL(result.url).hostname
                                    }],
                                cross_verified: false,
                                freshness_status: "current"
                            }); })
                        }];
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * 解析 LLM 分析输出（重构版 - 更健壮的 JSON 解析）
 */
function parseLLMAnalysisOutput(text, searchResults) {
    var result = {
        findings: [],
        key_insights: [],
        data_points: {},
        framework: "",
        angles: [],
        recommended_angle: null
    };
    try {
        // 尝试多种方式提取 JSON
        var jsonStr = "";
        // 方法 1: 尝试直接解析整个文本
        try {
            JSON.parse(text);
            jsonStr = text;
        }
        catch (_a) {
            // 方法 2: 提取 JSON 代码块
            var codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
            if (codeBlockMatch) {
                jsonStr = codeBlockMatch[1];
            }
            else {
                // 方法 3: 查找 {...}
                var braceMatch = text.match(/\{[\s\S]*\}/);
                if (braceMatch) {
                    jsonStr = braceMatch[0];
                }
                else {
                    throw new Error("No JSON found");
                }
            }
        }
        var parsed = JSON.parse(jsonStr);
        // 解析 findings
        if (parsed.findings && Array.isArray(parsed.findings)) {
            result.findings = parsed.findings.map(function (item) { return ({
                claim: item.claim,
                confidence_type: "BELIEF",
                confidence_score: 0.7,
                sources: searchResults.slice(0, item.sources_count || 1).map(function (r) { return ({
                    url: r.url,
                    title: r.title,
                    domain: new URL(r.url).hostname
                }); }),
                cross_verified: (item.sources_count || 1) >= 2,
                freshness_status: "current"
            }); });
        }
        // 复制其他字段
        if (parsed.key_insights && Array.isArray(parsed.key_insights)) {
            result.key_insights = parsed.key_insights;
        }
        if (parsed.data_points) {
            result.data_points = parsed.data_points;
        }
        if (parsed.framework) {
            result.framework = parsed.framework;
        }
        if (parsed.angles && Array.isArray(parsed.angles)) {
            result.angles = parsed.angles;
        }
        if (parsed.recommended_angle) {
            result.recommended_angle = parsed.recommended_angle;
        }
        console.log("[01_research] LLM JSON \u89E3\u6790\u6210\u529F");
    }
    catch (error) {
        console.error("[01_research] Failed to parse LLM analysis output: ".concat(error));
        console.log("[01_research] LLM \u539F\u59CB\u8F93\u51FA\u957F\u5EA6: ".concat(text.length));
        // 调试：显示前 500 个字符
        console.log("[01_research] LLM \u8F93\u51FA\u9884\u89C8: ".concat(text.substring(0, 500), "..."));
    }
    // 如果解析失败或没有 findings，使用降级方案
    if (result.findings.length === 0) {
        console.log("[01_research] \u4F7F\u7528\u964D\u7EA7\u65B9\u6848\u751F\u6210 findings");
        result.findings = searchResults.slice(0, 5).map(function (result) { return ({
            claim: result.description || result.title,
            confidence_type: "BELIEF",
            confidence_score: 0.5,
            sources: [{
                    url: result.url,
                    title: result.title,
                    domain: new URL(result.url).hostname
                }],
            cross_verified: false,
            freshness_status: "current"
        }); });
    }
    return result;
}
/**
 * 获取默认输出路径
 */
function getDefaultOutputPath() {
    var timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    var runId = "article-".concat(timestamp);
    return (0, path_1.join)(process.cwd(), "output", runId);
}
