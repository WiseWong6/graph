"use strict";
/**
 * Image Prompts 节点
 *
 * 职责: 基于初稿文章生成图片提示词
 *
 * 数据流:
 * draft + imageConfig → LLM 生成提示词 → imagePrompts[]
 *
 * 设计原则:
 * - 每个核心段落生成一个提示词
 * - 根据选定风格使用对应的 Style Prefix
 * - 统一使用 16:9 比例（公众号）
 * - 使用英文提示词
 * - 基于 draft（与 humanize 并行，不依赖 humanized）
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
exports.promptsNodeInfo = void 0;
exports.promptsNode = promptsNode;
var llm_js_1 = require("../../../config/llm.js");
var llm_client_js_1 = require("../../../utils/llm-client.js");
var dotenv_1 = require("dotenv");
var path_1 = require("path");
(0, dotenv_1.config)({ path: (0, path_1.resolve)(process.cwd(), ".env") });
/**
 * 风格 Prefix 映射
 *
 * 参考 image-prompter 技能的五风格定义
 * 统一使用 16:9 横屏比例
 */
var STYLE_PREFIXES = {
    infographic: "Create a clean 16:9 horizontal infographic. Flat vector style, white background, simple thin-outline icons, single bright accent color. Minimal text: a large Chinese title + 3-4 ultra-short labels max. No gradients, no heavy shadows.",
    healing: "Warm pastel color, soft light, cozy healing illustration, clean lineart, gentle shading. Clean 16:9 horizontal layout.",
    pixar: "Pixar style, sharpie illustration, bold lines and solid colors, simple details, minimalist, 3D cartoon style, vibrant colors. Cartoon, energetic, concise, childlike wonder. Clean 16:9 horizontal layout.",
    sokamono: "Cartoon illustration, minimalist, simple and vivid lines, calm healing atmosphere, clean and fresh color, light blue background, style by sokamono. Clean 16:9 horizontal layout.",
    handdrawn: "Hand-drawn notebook style on grid paper, marker pen and ballpoint pen, light gray background with paper texture and grid lines, rough ink lines, uneven width 2px-4px, high saturation colors at 90% transparency for highlights and decorative elements only. Use bright green for positive accents, alert red for attention markers, calm blue for structural elements, warm yellow for emphasis. Clean 16:9 horizontal layout."
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
 * Image Prompts 节点主函数
 *
 * @param state - 当前状态
 * @returns 更新的状态
 */
function promptsNode(state) {
    return __awaiter(this, void 0, void 0, function () {
        var imageConfig, count, style, prompt, llmConfig, client, response, prompts, promptStrings, error_1, fallbackPrompts;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    console.log("[10_prompts] Generating image prompts...");
                    if (!state.draft) {
                        console.error("[10_prompts] No draft article to generate prompts for");
                        throw new Error("Draft article not found in state");
                    }
                    imageConfig = (_a = state.decisions) === null || _a === void 0 ? void 0 : _a.images;
                    count = (imageConfig === null || imageConfig === void 0 ? void 0 : imageConfig.count) || 4;
                    style = (imageConfig === null || imageConfig === void 0 ? void 0 : imageConfig.style) || "infographic";
                    console.log("[10_prompts] Config: ".concat(count, " images, style: ").concat(STYLE_NAMES[style]));
                    prompt = buildPromptPrompt(state.draft, count, style);
                    llmConfig = (0, llm_js_1.getNodeLLMConfig)("image_prompt");
                    client = new llm_client_js_1.LLMClient(llmConfig);
                    console.log("[10_prompts] Calling LLM with config:", llmConfig.model);
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, client.call({
                            prompt: prompt,
                            systemMessage: PROMPT_SYSTEM_MESSAGE
                        })];
                case 2:
                    response = _b.sent();
                    console.log("[10_prompts] Prompts generated");
                    prompts = parsePrompts(response.text);
                    promptStrings = prompts.map(function (p) { return p.prompt; });
                    console.log("[10_prompts] Generated ".concat(promptStrings.length, " prompts:"));
                    prompts.forEach(function (p, i) {
                        console.log("  ".concat(i + 1, ". ").concat(p.paragraph_summary));
                        console.log("     ".concat(p.prompt.substring(0, 80), "..."));
                    });
                    return [2 /*return*/, {
                            imagePrompts: promptStrings
                        }];
                case 3:
                    error_1 = _b.sent();
                    console.error("[10_prompts] Failed to generate prompts: ".concat(error_1));
                    fallbackPrompts = generateFallbackPrompts(count, style);
                    console.log("[10_prompts] Using fallback prompts");
                    return [2 /*return*/, {
                            imagePrompts: fallbackPrompts
                        }];
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * 构建提示词生成 Prompt
 */
function buildPromptPrompt(article, count, style) {
    // 提取文章摘要
    var summary = extractSummary(article);
    var stylePrefix = STYLE_PREFIXES[style];
    var styleName = STYLE_NAMES[style];
    var lines = [];
    lines.push("\u8BF7\u4E3A\u4E00\u7BC7\u6587\u7AE0\u751F\u6210 ".concat(count, " \u4E2A\u914D\u56FE\u63D0\u793A\u8BCD\u3002\n"));
    lines.push("文章内容摘要:");
    lines.push(summary);
    lines.push("");
    lines.push("配图要求:");
    lines.push("  1. \u6570\u91CF: ".concat(count, " \u5F20"));
    lines.push("  2. \u98CE\u683C: ".concat(styleName));
    lines.push("  3. \u6BD4\u4F8B: 16:9 \u6A2A\u5C4F\uFF08\u516C\u4F17\u53F7\u7EDF\u4E00\uFF09");
    lines.push("");
    lines.push("风格规范（必须严格遵守）:");
    lines.push(stylePrefix);
    lines.push("");
    lines.push("负面约束:");
    lines.push("  - no watermark, no logo, no random letters, no gibberish text");
    lines.push("  - avoid overcrowded layout, avoid messy typography");
    if (style === "handdrawn") {
        lines.push("  - colors are for decorative highlights only, do NOT generate text labels with colors");
        lines.push("  - avoid functional labels like 'correct', 'warning', 'success' as text");
    }
    lines.push("");
    lines.push("输出格式:");
    lines.push("请输出 JSON 数组,每个元素包含:");
    lines.push("  - paragraph_index: 对应段落序号");
    lines.push("  - paragraph_summary: 段落摘要");
    lines.push("  - prompt: 英文图片提示词（必须包含上述风格规范）");
    lines.push("  - style: 风格描述");
    lines.push("  - mood: 情感基调");
    lines.push("");
    lines.push("示例:");
    lines.push("[\n  {\n    \"paragraph_index\": 1,\n    \"paragraph_summary\": \"AI Agent \u6982\u5FF5\u4ECB\u7ECD\",\n    \"prompt\": \"AI agents as helpful digital assistants working alongside humans, ".concat(stylePrefix.substring(0, 100), "...\",\n    \"style\": \"").concat(styleName, "\",\n    \"mood\": \"\u4E13\u4E1A\u3001\u53CB\u597D\"\n  }\n]"));
    return lines.join("\n");
}
/**
 * System Message
 */
var PROMPT_SYSTEM_MESSAGE = "\u4F60\u662F\u4E00\u4E2A\u4E13\u4E1A\u7684\u914D\u56FE\u8BBE\u8BA1\u5E08,\u64C5\u957F\u4E3A\u6587\u7AE0\u521B\u4F5C\u914D\u56FE\u63D0\u793A\u8BCD\u3002\n\n\u4F60\u7684\u6838\u5FC3\u80FD\u529B:\n- \u7406\u89E3\u6587\u7AE0\u6838\u5FC3\u5185\u5BB9\n- \u9009\u62E9\u5408\u9002\u7684\u89C6\u89C9\u5143\u7D20\n- \u4F7F\u7528\u82F1\u6587\u63CF\u8FF0\u573A\u666F\n- \u5E73\u8861\u7F8E\u89C2\u548C\u4FE1\u606F\u4F20\u8FBE\n\n\u63D0\u793A\u8BCD\u521B\u4F5C\u539F\u5219:\n1. \u4E3B\u4F53\u660E\u786E: \u753B\u9762\u8981\u8868\u8FBE\u4EC0\u4E48?\n2. \u73AF\u5883\u6E05\u6670: \u80CC\u666F\u548C\u573A\u666F\n3. \u98CE\u683C\u7EDF\u4E00: \u4E0E\u5176\u4ED6\u914D\u56FE\u534F\u8C03\n4. \u8272\u5F69\u548C\u8C10: \u7B26\u5408\u60C5\u611F\u57FA\u8C03\n5. \u4E25\u683C\u9075\u5B88\u98CE\u683C\u89C4\u8303\n\n\u63D0\u793A\u8BCD\u7ED3\u6784:\n[\u4E3B\u4F53\u63CF\u8FF0] + [\u73AF\u5883/\u80CC\u666F] + [\u98CE\u683C\u89C4\u8303] + [\u8D1F\u9762\u7EA6\u675F] + [\u6280\u672F\u53C2\u6570]\n\n\u989C\u8272\u4F7F\u7528\u89C4\u8303\uFF08\u91CD\u8981\uFF09:\n- \u989C\u8272\u63CF\u8FF0\u4EC5\u7528\u4E8E\u89C6\u89C9\u88C5\u9970\u548C\u9AD8\u4EAE\n- \u7981\u6B62\u5728\u63D0\u793A\u8BCD\u4E2D\u63CF\u8FF0\u5E26\u989C\u8272\u7684\u529F\u80FD\u6027\u6807\u7B7E\u6587\u5B57\n- \u4F8B\u5982\uFF1A\u4E0D\u8981\u5199 \"green checkmark\" \u6216 \"red warning label\"\n- \u5E94\u8BE5\u5199\uFF1A \"green decorative arrow\", \"red accent line\"\n- \u5BF9\u4E8E handdrawn \u98CE\u683C\u5C24\u5176\u6CE8\u610F\uFF1A\u989C\u8272\u7528\u4E8E\u88C5\u9970\u5143\u7D20\uFF0C\u4E0D\u662F\u6587\u5B57\u6807\u7B7E\n\n\u91CD\u8981:\n- \u5FC5\u987B\u5728\u63D0\u793A\u8BCD\u4E2D\u5305\u542B\u5B8C\u6574\u7684\u98CE\u683C\u89C4\u8303\n- \u98CE\u683C\u89C4\u8303\u4F1A\u5728\u7528\u6237\u63D0\u793A\u4E2D\u63D0\u4F9B\n- \u786E\u4FDD\u63D0\u793A\u8BCD\u53EF\u76F4\u63A5\u7528\u4E8E\u56FE\u50CF\u751F\u6210\u6A21\u578B";
/**
 * 解析 LLM 输出的提示词
 */
function parsePrompts(text) {
    var prompts = [];
    try {
        // 尝试解析 JSON 数组
        var jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            var parsed = JSON.parse(jsonMatch[0]);
            for (var _i = 0, parsed_1 = parsed; _i < parsed_1.length; _i++) {
                var item = parsed_1[_i];
                if (item.prompt) {
                    prompts.push({
                        paragraph_index: item.paragraph_index || 0,
                        paragraph_summary: item.paragraph_summary || "",
                        prompt: item.prompt,
                        style: item.style || "扁平化科普图",
                        mood: item.mood || "专业"
                    });
                }
            }
        }
    }
    catch (error) {
        console.error("[10_prompts] Failed to parse prompts: ".concat(error));
    }
    return prompts;
}
/**
 * 生成风格化降级提示词
 */
function generateFallbackPrompts(count, style) {
    var stylePrefix = STYLE_PREFIXES[style];
    // 通用负面约束
    var negativeConstraints = "no watermark, no logo, no random letters, no gibberish text, avoid overcrowded layout";
    var templatesMap = {
        infographic: [
            "Professional concept explanation, clean infographic design, icons and arrows, blue and white colors, ".concat(stylePrefix, ", ").concat(negativeConstraints),
            "Step-by-step process visualization, flat vector style, numbered steps, clean layout, ".concat(stylePrefix, ", ").concat(negativeConstraints),
            "Comparison diagram showing before/after, simple icons, clear contrast, ".concat(stylePrefix, ", ").concat(negativeConstraints),
            "Data visualization chart with clean design, professional look, blue accent colors, ".concat(stylePrefix, ", ").concat(negativeConstraints),
            "Technical concept explanation, simple icons and labels, minimal background, ".concat(stylePrefix, ", ").concat(negativeConstraints)
        ],
        healing: [
            "Cozy indoor scene with warm light, peaceful atmosphere, ".concat(stylePrefix, ", ").concat(negativeConstraints),
            "Person reading by window with plants, warm afternoon light, ".concat(stylePrefix, ", ").concat(negativeConstraints),
            "Comfortable workspace with soft colors, gentle lighting, ".concat(stylePrefix, ", ").concat(negativeConstraints),
            "Morning coffee scene with peaceful mood, soft pastel tones, ".concat(stylePrefix, ", ").concat(negativeConstraints),
            "Relaxing moment in daily life, warm and healing atmosphere, ".concat(stylePrefix, ", ").concat(negativeConstraints)
        ],
        pixar: [
            "Friendly robot assistant helping human work, energetic scene, ".concat(stylePrefix, ", ").concat(negativeConstraints),
            "Cute characters collaborating on project, vibrant colors, ".concat(stylePrefix, ", ").concat(negativeConstraints),
            "Playful learning scene with cartoon characters, joyful mood, ".concat(stylePrefix, ", ").concat(negativeConstraints),
            "Adventure scene with cute protagonists, dynamic composition, ".concat(stylePrefix, ", ").concat(negativeConstraints),
            "Teamwork scene with animated characters, positive energy, ".concat(stylePrefix, ", ").concat(negativeConstraints)
        ],
        sokamono: [
            "Peaceful scene with simple lines, calming atmosphere, ".concat(stylePrefix, ", ").concat(negativeConstraints),
            "Minimalist illustration of daily life, clean and fresh, ".concat(stylePrefix, ", ").concat(negativeConstraints),
            "Quiet moment with simple composition, healing mood, ".concat(stylePrefix, ", ").concat(negativeConstraints),
            "Gentle scene with soft colors, clean lines, ".concat(stylePrefix, ", ").concat(negativeConstraints),
            "Serene landscape with minimalist style, calming effect, ".concat(stylePrefix, ", ").concat(negativeConstraints)
        ],
        handdrawn: [
            "Hand-drawn concept explanation with arrows and highlights, ".concat(stylePrefix, ", ").concat(negativeConstraints),
            "Notebook-style learning notes with doodles and underlines, ".concat(stylePrefix, ", ").concat(negativeConstraints),
            "Sketch-style diagram with hand-drawn elements, markers, ".concat(stylePrefix, ", ").concat(negativeConstraints),
            "Handwritten notes with colorful highlights and stars, ".concat(stylePrefix, ", ").concat(negativeConstraints),
            "Grid paper style concept map with hand-drawn connections, ".concat(stylePrefix, ", ").concat(negativeConstraints)
        ]
    };
    var templates = templatesMap[style] || templatesMap.infographic;
    return templates.slice(0, count);
}
/**
 * 提取文章摘要
 */
function extractSummary(article) {
    // 简化版: 取前 500 字作为摘要
    var cleaned = article
        .replace(/[#*`\[\]]/g, "")
        .replace(/\n+/g, " ")
        .trim();
    return cleaned.length > 500
        ? cleaned.substring(0, 500) + "..."
        : cleaned;
}
/**
 * 节点信息（用于文档和调试）
 */
exports.promptsNodeInfo = {
    name: "prompts",
    type: "llm",
    description: "基于初稿文章和选定风格生成图片提示词",
    reads: ["draft", "decisions.images"],
    writes: ["imagePrompts"]
};
