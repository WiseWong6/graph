"use strict";
/**
 * Polish 节点 v2 - 使用统一错误处理和日志
 *
 * 职责: 润色初稿,提升可读性和表达质量
 *
 * 数据流:
 * draft → LLM 润色 → polished
 *
 * 设计原则:
 * - 保持原意不变
 * - 提升表达流畅度
 * - 优化段落结构
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
exports.polishNode = polishNode;
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
var log = (0, logger_js_1.createLogger)("06_polish");
/**
 * Polish 节点主函数
 *
 * @param state - 当前状态
 * @returns 更新的状态
 */
function polishNode(state) {
    return __awaiter(this, void 0, void 0, function () {
        var timer, prompt, llmConfig, client, response, polished, outputPath, polishDir, polishedPath, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    timer = log.timer("polish");
                    log.startStep("validate_input");
                    // ========== 验证输入 ==========
                    if (!state.draft) {
                        throw new errors_js_1.ValidationError("Draft content not found in state", "draft");
                    }
                    log.completeStep("validate_input", { inputLength: state.draft.length });
                    // ========== 构建 Prompt ==========
                    log.startStep("build_prompt");
                    prompt = buildPolishPrompt(state.draft);
                    log.completeStep("build_prompt", { promptLength: prompt.length });
                    // ========== 调用 LLM ==========
                    log.startStep("llm_call");
                    llmConfig = (0, llm_js_1.getNodeLLMConfig)("polish");
                    client = new llm_client_js_1.LLMClient(llmConfig);
                    log.info("LLM config:", { model: llmConfig.model, temperature: llmConfig.temperature });
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, (0, errors_js_1.retry)(function () { return client.call({
                            prompt: prompt,
                            systemMessage: POLISH_SYSTEM_MESSAGE
                        }); }, { maxAttempts: 3, delay: 1000 })()];
                case 2:
                    response = _a.sent();
                    log.completeStep("llm_call", {
                        outputLength: response.text.length,
                        usage: response.usage
                    });
                    polished = response.text;
                    // ========== 保存润色稿 ==========
                    log.startStep("save_output");
                    outputPath = state.outputPath || getDefaultOutputPath();
                    polishDir = (0, path_1.join)(outputPath, "polish");
                    if (!(0, fs_1.existsSync)(polishDir)) {
                        (0, fs_1.mkdirSync)(polishDir, { recursive: true });
                    }
                    polishedPath = (0, path_1.join)(polishDir, "06_polished.md");
                    (0, fs_1.writeFileSync)(polishedPath, polished, "utf-8");
                    log.completeStep("save_output", { path: polishedPath });
                    log.success("Complete in ".concat(timer.log()));
                    return [2 /*return*/, {
                            polished: polished
                        }];
                case 3:
                    error_1 = _a.sent();
                    log.failStep("llm_call", error_1);
                    errors_js_1.ErrorHandler.handle(error_1, "06_polish");
                    // 降级: 返回原稿
                    log.warn("Fallback to draft content");
                    return [2 /*return*/, {
                            polished: state.draft
                        }];
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * 构建润色 Prompt
 */
function buildPolishPrompt(draft) {
    return "\u8BF7\u6DA6\u8272\u4EE5\u4E0B\u6587\u7AE0,\u4FDD\u6301\u539F\u610F\u7684\u540C\u65F6\u63D0\u5347\u8868\u8FBE\u8D28\u91CF:\n\n".concat(draft, "\n\n\u6DA6\u8272\u8981\u6C42:\n1. \u4FDD\u6301\u6240\u6709\u6838\u5FC3\u89C2\u70B9\u548C\u4FE1\u606F\n2. \u4F18\u5316\u53E5\u5B50\u7ED3\u6784,\u63D0\u5347\u6D41\u7545\u5EA6\n3. \u589E\u52A0\u5FC5\u8981\u7684\u8FC7\u6E21\u8BCD\n4. \u9002\u5EA6\u4F7F\u7528\u4FEE\u8F9E\u624B\u6CD5\n5. \u4FDD\u6301 Markdown \u683C\u5F0F\n\n\u8BF7\u76F4\u63A5\u8F93\u51FA\u6DA6\u8272\u540E\u7684\u5B8C\u6574\u6587\u7AE0\u3002");
}
/**
 * System Message
 */
var POLISH_SYSTEM_MESSAGE = "\u4F60\u662F\u4E00\u4E2A\u4E13\u4E1A\u7684\u6587\u5B57\u7F16\u8F91,\u64C5\u957F\u6DA6\u8272\u548C\u4F18\u5316\u6587\u7AE0\u3002\n\n\u4F60\u7684\u6838\u5FC3\u80FD\u529B:\n- \u4FDD\u6301\u539F\u610F\u7684\u4F18\u5316\u8868\u8FBE\n- \u63D0\u5347\u8BED\u8A00\u6D41\u7545\u5EA6\n- \u4F18\u5316\u6BB5\u843D\u7ED3\u6784\n- \u4FEE\u6B63\u8BED\u6CD5\u9519\u8BEF\n\n\u6DA6\u8272\u539F\u5219:\n1. \u5C11\u5373\u662F\u591A: \u4E0D\u505A\u8FC7\u5EA6\u4FEE\u9970\n2. \u4FDD\u6301\u4E2A\u6027: \u4FDD\u7559\u4F5C\u8005\u98CE\u683C\n3. \u6E05\u6670\u4F18\u5148: \u786E\u4FDD\u610F\u601D\u660E\u786E\n4. \u8282\u594F\u611F: \u957F\u77ED\u53E5\u4EA4\u66FF\n\n\u4E0D\u8981\u505A\u7684:\n- \u4E0D\u8981\u6539\u53D8\u539F\u610F\n- \u4E0D\u8981\u6DFB\u52A0\u65B0\u4FE1\u606F\n- \u4E0D\u8981\u8FC7\u5EA6\u4F7F\u7528\u5F62\u5BB9\u8BCD\n- \u4E0D\u8981\u6539\u53D8\u6587\u7AE0\u7ED3\u6784";
/**
 * 获取默认输出路径
 */
function getDefaultOutputPath() {
    var timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    var runId = "article-".concat(timestamp);
    return (0, path_1.join)(process.cwd(), "output", runId);
}
