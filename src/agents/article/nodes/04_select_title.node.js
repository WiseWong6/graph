"use strict";
/**
 * Gate C: 选择标题
 *
 * 触发时机: 标题生成后执行
 * 功能: 让用户从 LLM 生成的标题选项中选择一个
 *
 * 交互 UI:
 * ```
 * ? 请选择最终标题:
 *   1. Kubernetes 是什么？一文读懂容器编排
 *   2. 从乐高乐园理解 Kubernetes：容器编排的魔法
 *   3. Kubernetes 入门指南：为什么你需要它
 * ```
 *
 * 存储位置: state.decisions.selectedTitle
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
exports.selectTitleNodeInfo = void 0;
exports.setPromptFn = setPromptFn;
exports.selectTitleNode = selectTitleNode;
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
 * 选择标题节点
 *
 * 决策流程:
 * 1. 检查是否已有选择 (state.decisions.selectedTitle)
 * 2. 检查是否有标题选项 (state.titles)
 * 3. 如果没有选项，报错返回
 * 4. 弹出交互菜单让用户选择
 * 5. 保存决策到 state.decisions.selectedTitle
 */
function selectTitleNode(state) {
    return __awaiter(this, void 0, void 0, function () {
        var existing, titles, prompt, answer, selected;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    existing = (_a = state.decisions) === null || _a === void 0 ? void 0 : _a.selectedTitle;
                    // 已选择，跳过
                    if (existing) {
                        console.log("[select_title] \u4F7F\u7528\u5DF2\u9009\u62E9\u7684\u6807\u9898: ".concat(existing));
                        return [2 /*return*/, {}];
                    }
                    titles = state.titles;
                    // 检查是否有标题选项
                    if (!titles || titles.length === 0) {
                        console.error("[select_title] 错误: 没有可用的标题选项");
                        console.error("[select_title] 请确保前序节点 (03_titles) 已正确生成标题");
                        return [2 /*return*/, {
                                status: "error: no titles available"
                            }];
                    }
                    console.log("\n=== Gate C: 选择标题 ===\n");
                    return [4 /*yield*/, getPromptFn()];
                case 1:
                    prompt = _b.sent();
                    return [4 /*yield*/, prompt([
                            {
                                type: "list",
                                name: "selectedTitle",
                                message: "请选择最终标题:",
                                choices: titles.map(function (title, index) { return ({
                                    name: "".concat(index + 1, ". ").concat(title),
                                    value: title
                                }); })
                            }
                        ])];
                case 2:
                    answer = _b.sent();
                    selected = answer.selectedTitle;
                    console.log("[select_title] \u5DF2\u9009\u62E9: ".concat(selected, "\n"));
                    return [2 /*return*/, {
                            decisions: __assign(__assign({}, state.decisions), { selectedTitle: selected })
                        }];
            }
        });
    });
}
/**
 * 节点信息（用于文档和调试）
 */
exports.selectTitleNodeInfo = {
    name: "select_title",
    type: "interactive",
    gate: "C",
    description: "从生成的标题选项中选择一个",
    writes: ["decisions.selectedTitle"],
    requires: ["titles"]
};
