"use strict";
/**
 * Gate A: 选择公众号
 *
 * 触发时机: 启动后立即执行
 * 功能: 让用户选择要发布的公众号账号
 *
 * 交互 UI:
 * ```
 * ? 请选择公众号账号:
 *   1. 主账号（主号）
 *   2. 备用账号（副号）
 *   3. 自定义别名
 * ```
 *
 * 存储位置: state.decisions.wechat.account
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
exports.selectWechatNodeInfo = void 0;
exports.setPromptFn = setPromptFn;
exports.selectWechatNode = selectWechatNode;
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
 * 选择公众号节点
 *
 * 决策流程:
 * 1. 检查是否已有选择 (state.decisions.wechat?.account)
 * 2. 如果没有，弹出交互菜单
 * 3. 如果选择"自定义"，要求输入别名
 * 4. 保存决策到 state.decisions.wechat
 */
function selectWechatNode(state) {
    return __awaiter(this, void 0, void 0, function () {
        var account, prompt, answer1, finalAccount, answer2;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    account = (_b = (_a = state.decisions) === null || _a === void 0 ? void 0 : _a.wechat) === null || _b === void 0 ? void 0 : _b.account;
                    // 已选择，跳过
                    if (account) {
                        console.log("[select_wechat] \u4F7F\u7528\u5DF2\u9009\u62E9\u7684\u516C\u4F17\u53F7: ".concat(account));
                        return [2 /*return*/, {}];
                    }
                    console.log("\n=== Gate A: 选择公众号 ===\n");
                    return [4 /*yield*/, getPromptFn()];
                case 1:
                    prompt = _c.sent();
                    return [4 /*yield*/, prompt([
                            {
                                type: "list",
                                name: "account",
                                message: "请选择公众号账号:",
                                choices: [
                                    { name: "主账号（主号）", value: "main" },
                                    { name: "备用账号（副号）", value: "sub" },
                                    { name: "自定义别名", value: "custom" }
                                ]
                            }
                        ])];
                case 2:
                    answer1 = _c.sent();
                    finalAccount = answer1.account;
                    if (!(finalAccount === "custom")) return [3 /*break*/, 4];
                    return [4 /*yield*/, prompt([
                            {
                                type: "input",
                                name: "alias",
                                message: "请输入公众号别名:",
                                validate: function (input) {
                                    if (!input || input.trim().length === 0) {
                                        return "别名不能为空";
                                    }
                                    return true;
                                }
                            }
                        ])];
                case 3:
                    answer2 = _c.sent();
                    finalAccount = answer2.alias.trim();
                    _c.label = 4;
                case 4:
                    console.log("[select_wechat] \u5DF2\u9009\u62E9: ".concat(finalAccount, "\n"));
                    return [2 /*return*/, {
                            decisions: __assign(__assign({}, state.decisions), { wechat: { account: finalAccount } })
                        }];
            }
        });
    });
}
/**
 * 节点信息（用于文档和调试）
 */
exports.selectWechatNodeInfo = {
    name: "select_wechat",
    type: "interactive",
    gate: "A",
    description: "启动时选择公众号账号",
    writes: ["decisions.wechat"]
};
