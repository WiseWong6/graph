"use strict";
/**
 * Humanize 节点 v2 - 使用统一错误处理和日志
 *
 * 职责: 去除 AI 味，增加活人感和情感共鸣
 *
 * 数据流:
 * rewritten (or polished) → LLM 人化 → humanized
 *
 * 设计原则:
 * - 格式清洗：去空格、标点规范、去引号
 * - 风格重写：去 AI 味、段落融合、口语化
 * - 保留 Markdown 结构（代码/链接/图片）
 *
 * 核心差异：
 * - Polish: 语言润色，保持专业感
 * - Rewrite: 智性叙事，注入灵魂
 * - Humanize: 去机械化，增加活人感
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
exports.humanizeNode = humanizeNode;
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
var log = (0, logger_js_1.createLogger)("08_humanize");
/**
 * Humanize 节点主函数
 *
 * @param state - 当前状态
 * @returns 更新的状态
 */
function humanizeNode(state) {
    return __awaiter(this, void 0, void 0, function () {
        var timer, input, sourceType, imageCount, prompt, llmConfig, client, response, humanized, outputPath, humanizeDir, humanizedPath, error_1;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    timer = log.timer("humanize");
                    log.startStep("validate_input");
                    input = state.rewritten || state.polished;
                    if (!input) {
                        throw new errors_js_1.ValidationError("Content not found in state (need rewritten or polished)", "rewritten|polished");
                    }
                    sourceType = state.rewritten ? "rewritten" : "polished";
                    log.completeStep("validate_input", { sourceType: sourceType, inputLength: input.length });
                    // ========== 构建 Prompt ==========
                    log.startStep("build_prompt");
                    imageCount = ((_b = (_a = state.decisions) === null || _a === void 0 ? void 0 : _a.images) === null || _b === void 0 ? void 0 : _b.count) || 0;
                    prompt = buildHumanizePrompt(input, imageCount);
                    log.completeStep("build_prompt", { promptLength: prompt.length, imageCount: imageCount });
                    // ========== 调用 LLM ==========
                    log.startStep("llm_call");
                    llmConfig = (0, llm_js_1.getNodeLLMConfig)("humanize");
                    client = new llm_client_js_1.LLMClient(llmConfig);
                    log.info("LLM config:", { model: llmConfig.model, temperature: llmConfig.temperature });
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, (0, errors_js_1.retry)(function () { return client.call({
                            prompt: prompt,
                            systemMessage: HUMANIZE_SYSTEM_MESSAGE
                        }); }, { maxAttempts: 3, delay: 1000 })()];
                case 2:
                    response = _c.sent();
                    log.completeStep("llm_call", {
                        outputLength: response.text.length,
                        usage: response.usage
                    });
                    humanized = response.text;
                    // ========== 保存人化稿 ==========
                    log.startStep("save_output");
                    outputPath = state.outputPath || getDefaultOutputPath();
                    humanizeDir = (0, path_1.join)(outputPath, "humanize");
                    if (!(0, fs_1.existsSync)(humanizeDir)) {
                        (0, fs_1.mkdirSync)(humanizeDir, { recursive: true });
                    }
                    humanizedPath = (0, path_1.join)(humanizeDir, "08_humanized.md");
                    (0, fs_1.writeFileSync)(humanizedPath, humanized, "utf-8");
                    log.completeStep("save_output", { path: humanizedPath });
                    log.success("Complete in ".concat(timer.log()));
                    return [2 /*return*/, {
                            humanized: humanized,
                            outputPath: outputPath
                        }];
                case 3:
                    error_1 = _c.sent();
                    log.failStep("llm_call", error_1);
                    errors_js_1.ErrorHandler.handle(error_1, "08_humanize");
                    // 降级: 返回原输入
                    log.warn("Fallback to input content");
                    return [2 /*return*/, {
                            humanized: input
                        }];
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * 构建人化 Prompt
 */
function buildHumanizePrompt(content, imageCount) {
    var prompt = "\u8BF7\u5BF9\u4EE5\u4E0B\u6587\u7AE0\u8FDB\u884C\"\u53BB\u673A\u68B0\u5316\"\u5904\u7406\uFF0C\u540C\u65F6\u5B8C\u6210\u683C\u5F0F\u6E05\u6D17\u548C\u98CE\u683C\u91CD\u5199\uFF1A\n\n".concat(content, "\n\n## \u5904\u7406\u8981\u6C42\n\n### \u9636\u6BB5\u4E00\uFF1A\u683C\u5F0F\u6E05\u6D17\n1. **\u53BB\u9664\u4E2D\u82F1\u6587\u4E4B\u95F4\u591A\u4F59\u7A7A\u683C**\n2. **\u6807\u70B9\u7B26\u53F7\u89C4\u8303\u5316**\uFF1A\u4E2D\u6587\u6807\u70B9\u7EDF\u4E00\u7528\u5168\u89D2\uFF0C\u82F1\u6587\u6807\u70B9\u7528\u534A\u89D2\n3. **\u53BB\u9664\u4E0D\u5FC5\u8981\u7684\u5F15\u53F7**\uFF1A\u975E\u5F15\u7528\u5185\u5BB9\u7684\u5F15\u53F7\u53EF\u4EE5\u53BB\u6389\n4. **\u7834\u6298\u53F7\u8F6C\u6362**\uFF1A\u7EDF\u4E00\u4F7F\u7528\u4E2D\u6587\u7834\u6298\u53F7 \u2014\u2014\u2014\n\n### \u9636\u6BB5\u4E8C\uFF1A\u98CE\u683C\u91CD\u5199\n1. **\u53BB\u9664 AI \u5473**\uFF1A\n   - \u5220\u9664\"\u9996\u5148/\u5176\u6B21/\u7EFC\u4E0A\u6240\u8FF0/\u503C\u5F97\u6CE8\u610F\u7684\u662F\"\u7B49\u673A\u68B0\u8FDE\u63A5\u8BCD\n   - \u907F\u514D\"\u968F\u7740...\u7684\u53D1\u5C55\"\u3001\"\u5728...\u80CC\u666F\u4E0B\"\u7B49\u6A21\u677F\u5F00\u5934\n   - \u51CF\u5C11\u88AB\u52A8\u8BED\u6001\uFF0C\u591A\u7528\u4E3B\u52A8\u8868\u8FBE\n\n2. **\u6BB5\u843D\u878D\u5408**\uFF1A\n   - \u76F8\u5173\u89C2\u70B9\u81EA\u7136\u8FC7\u6E21\uFF0C\u4E0D\u8981\u7528\u5217\u8868\u7B26\u53F7\n   - \u5373\u4F7F\u6709\u591A\u4E2A\u89C2\u70B9\uFF0C\u4E5F\u7528\u81EA\u7136\u6BB5\u843D\u8868\u8FBE\n   - \u7981\u6B62\uFF1A\"1. 2. 3.\" \u6216 \"\u2022\" \u7B49\u673A\u68B0\u5206\u70B9\n\n3. **\u53E3\u8BED\u5316\u8868\u8FBE**\uFF1A\n   - \u9002\u5EA6\u4F7F\u7528\uFF1A\"\u8BF4\u5B9E\u8BDD/\u5766\u767D\u8BB2/\u4E2A\u4EBA\u89C9\u5F97/\u5728\u6211\u770B\u6765\"\n   - \u5236\u9020\u5171\u9E23\uFF1A\"\u4F60\u662F\u4E0D\u662F\u4E5F\u9047\u5230\u8FC7.../\u6709\u610F\u601D\u7684\u662F...\"\n   - \u5F15\u5BFC\u601D\u8003\uFF1A\"\u4E3A\u4EC0\u4E48\u4F1A\u8FD9\u6837\u5462?/\u8FD9\u80CC\u540E\u8BF4\u660E\u4E86\u4EC0\u4E48?\"\n\n4. **\u8282\u594F\u8C03\u6574**\uFF1A\n   - \u957F\u77ED\u53E5\u4EA4\u66FF\uFF0C\u907F\u514D\u5355\u8C03\n   - \u5173\u952E\u4FE1\u606F\u7528\u77ED\u53E5\u5F3A\u8C03\n   - \u8FC7\u6E21\u4FE1\u606F\u7528\u957F\u53E5\u5C55\u5F00\n\n### \u4FDD\u62A4\u5185\u5BB9\n- **\u4EE3\u7801\u5757**\uFF1A\u5B8C\u5168\u4FDD\u7559\uFF0C\u4E0D\u505A\u4FEE\u6539\n- **\u94FE\u63A5**\uFF1A\u4FDD\u7559 URL \u548C\u94FE\u63A5\u6587\u672C\n- **\u56FE\u7247**\uFF1A\u4FDD\u7559\u56FE\u7247\u6807\u8BB0\u548C\u63CF\u8FF0\n- **\u6838\u5FC3\u89C2\u70B9**\uFF1A\u4FDD\u6301\u539F\u610F\uFF0C\u53EA\u6539\u8868\u8FBE\n");
    // 添加图片插入指导
    if (imageCount > 0) {
        prompt += "\n\n## \u56FE\u7247\u63D2\u5165\u8981\u6C42\n\u6587\u7AE0\u4E2D\u5171\u6709 ".concat(imageCount, " \u5F20\u914D\u56FE\uFF0C\u8BF7\u5728\u5408\u9002\u7684\u4F4D\u7F6E\u63D2\u5165\u56FE\u7247\u5360\u4F4D\u7B26\uFF1A\n- \u4F7F\u7528 Markdown \u8BED\u6CD5\uFF1A`![\u914D\u56FE\u63CF\u8FF0](\u7D22\u5F15)`\n- \u7D22\u5F15\u4ECE 0 \u5F00\u59CB\uFF1A`![\u914D\u56FE1](0)`\u3001`![\u914D\u56FE2](1)`\u3001`![\u914D\u56FE3](2)`\n- \u5EFA\u8BAE\u5728\u6BCF\u4E2A\u6838\u5FC3\u6BB5\u843D\u540E\u63D2\u5165\u4E00\u5F20\u914D\u56FE\n- \u914D\u56FE\u63CF\u8FF0\u5E94\u8BE5\u7B80\u6D01\u6709\u529B\uFF0C\u80FD\u591F\u547C\u5E94\u6BB5\u843D\u5185\u5BB9\n- \u786E\u4FDD\u7D22\u5F15\u4E0D\u8D85\u8FC7 ").concat(imageCount - 1, "\n\n\u793A\u4F8B\uFF1A\n```markdown\n\u8FD9\u662F\u7B2C\u4E00\u6BB5\u5185\u5BB9...\n\n![\u6838\u5FC3\u6982\u5FF5\u56FE\u89E3](0)\n\n\u8FD9\u662F\u7B2C\u4E8C\u6BB5\u5185\u5BB9...\n\n![\u5B9E\u8DF5\u6848\u4F8B](1)\n\n\u8FD9\u662F\u7ED3\u8BBA...\n\n![\u603B\u7ED3\u793A\u610F\u56FE](2)\n```\n");
    }
    prompt += "\n\n\u8BF7\u76F4\u63A5\u8F93\u51FA\u5904\u7406\u540E\u7684\u5B8C\u6574\u6587\u7AE0\uFF0C\u4F7F\u7528 Markdown \u683C\u5F0F\u3002";
    return prompt;
}
/**
 * System Message - 去机械化专家
 */
var HUMANIZE_SYSTEM_MESSAGE = "\u4F60\u662F\u4E00\u4E2A**\u53BB\u673A\u68B0\u5316\u4E13\u5BB6**\uFF0C\u64C5\u957F\u5C06 AI \u751F\u6210\u7684\u6587\u672C\u8F6C\u6362\u4E3A\u81EA\u7136\u3001\u6709\u547C\u5438\u611F\u7684\u771F\u4EBA\u5199\u4F5C\u3002\n\n## \u6838\u5FC3\u80FD\u529B\n- **\u683C\u5F0F\u6E05\u6D17**\uFF1A\u53BB\u9664 AI \u8F93\u51FA\u7684\u5178\u578B\u683C\u5F0F\u95EE\u9898\n- **\u98CE\u683C\u91CD\u5199**\uFF1A\u6D88\u9664\u673A\u68B0\u611F\uFF0C\u589E\u52A0\u4EBA\u7684\u6E29\u5EA6\n- **\u7ED3\u6784\u4FDD\u7559**\uFF1A\u4FDD\u6301 Markdown \u7ED3\u6784\u548C\u6838\u5FC3\u4FE1\u606F\n\n## \u53BB\u9664 AI \u5473\u7684\u539F\u5219\n\n### \u7981\u7528\u7684\u673A\u68B0\u8868\u8FBE\n- ~~\"\u9996\u5148/\u5176\u6B21/\u518D\u6B21/\u6700\u540E\"~~ \u2192 \u7528\u81EA\u7136\u8FC7\u6E21\n- ~~\"\u7EFC\u4E0A\u6240\u8FF0/\u603B\u800C\u8A00\u4E4B/\u7531\u6B64\u53EF\u89C1\"~~ \u2192 \u7528\u603B\u7ED3\u6027\u9648\u8FF0\n- ~~\"\u503C\u5F97\u6CE8\u610F\u7684\u662F/\u9700\u8981\u6307\u51FA\u7684\u662F\"~~ \u2192 \u76F4\u63A5\u9648\u8FF0\u91CD\u70B9\n- ~~\"\u968F\u7740...\u7684\u53D1\u5C55/\u5728...\u80CC\u666F\u4E0B\"~~ \u2192 \u7528\u5177\u4F53\u573A\u666F\u6216\u95EE\u9898\u5F15\u5165\n- ~~\"\u901A\u8FC7...\u53EF\u4EE5\u5B9E\u73B0/\u80FD\u591F\u8FBE\u5230\"~~ \u2192 \u7528\u4E3B\u52A8\u8BED\u6001\n\n### \u63A8\u8350\u7684\u81EA\u7136\u8868\u8FBE\n- **\u5766\u767D\u8BF4/\u8BF4\u5B9E\u8BDD/\u8001\u5B9E\u8BF4** - \u8868\u8FBE\u4E2A\u4EBA\u6001\u5EA6\n- **\u6709\u610F\u601D\u7684\u662F/\u4EE4\u4EBA\u610F\u5916\u7684\u662F** - \u5F15\u51FA\u53CD\u76F4\u89C9\u4E8B\u5B9E\n- **\u8FD9\u5C31\u50CF/\u6253\u4E2A\u6BD4\u65B9** - \u5F15\u5165\u7C7B\u6BD4\n- **\u4E3A\u4EC0\u4E48\u4F1A\u8FD9\u6837?** - \u5F15\u5BFC\u601D\u8003\n- **\u4F60\u662F\u4E0D\u662F\u4E5F\u9047\u5230\u8FC7...** - \u5236\u9020\u5171\u9E23\n\n## \u6BB5\u843D\u5904\u7406\n- **\u7981\u6B62\u5217\u8868\u7B26\u53F7**\uFF1A\u7528 \"\u66F4\u91CD\u8981\u7684\u662F...\"\u3001\"\u8FD9\u8BA9\u6211\u60F3\u8D77...\" \u7B49\u8FDE\u63A5\n- **\u878D\u5408\u89C2\u70B9**\uFF1A\u76F8\u5173\u89C2\u70B9\u653E\u5728\u540C\u4E00\u6BB5\u843D\uFF0C\u81EA\u7136\u8FC7\u6E21\n- **\u957F\u77ED\u53E5\u4EA4\u66FF**\uFF1A3-5 \u53E5\u7684\u77ED\u6BB5\u843D + 7-10 \u53E5\u7684\u957F\u6BB5\u843D\n\n## \u8D28\u91CF\u81EA\u68C0\n\u8F93\u51FA\u524D\u81EA\u95EE\uFF1A\n1. \u8FD9\u7BC7\u6587\u7AE0\u50CF\u771F\u4EBA\u5199\u7684\u5417\uFF1F\uFF08\u6709\u89C2\u70B9\u3001\u6709\u6001\u5EA6\u3001\u6709\u6E29\u5EA6\uFF09\n2. \u662F\u5426\u6D88\u9664\u4E86\u6240\u6709\u673A\u68B0\u8FDE\u63A5\u8BCD\uFF1F\n3. \u6BB5\u843D\u662F\u5426\u81EA\u7136\u8FC7\u6E21\uFF0C\u65E0\u5217\u8868\u5206\u70B9\uFF1F\n4. \u6838\u5FC3\u4FE1\u606F\u662F\u5426\u5B8C\u6574\u4FDD\u7559\uFF1F\n\n## \u683C\u5F0F\u8981\u6C42\n- \u4FDD\u7559 Markdown \u6807\u9898\u7ED3\u6784\uFF08##, ###\uFF09\n- \u4EE3\u7801\u5757\u3001\u94FE\u63A5\u3001\u56FE\u7247\u5B8C\u5168\u4FDD\u7559\n- \u91CD\u70B9\u5185\u5BB9\u7528 **\u52A0\u7C97** \u6807\u6CE8\n- \u77ED\u6BB5\u843D\u4FDD\u6301\u547C\u5438\u611F";
/**
 * 获取默认输出路径
 */
function getDefaultOutputPath() {
    var timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    var runId = "article-".concat(timestamp);
    return (0, path_1.join)(process.cwd(), "output", runId);
}
