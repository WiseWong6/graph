"use strict";
// LLM client utility
// Provides a unified interface for interacting with different LLM providers
//
// "Bad programmers worry about the code. Good programmers worry about data structures."
// This module abstracts provider differences behind a clean data structure.
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
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }
var __asyncDelegator = (this && this.__asyncDelegator) || function (o) {
    var i, p;
    return i = {}, verb("next"), verb("throw", function (e) { throw e; }), verb("return"), i[Symbol.iterator] = function () { return this; }, i;
    function verb(n, f) { i[n] = o[n] ? function (v) { return (p = !p) ? { value: __await(o[n](v)), done: false } : f ? f(v) : v; } : f; }
};
var __asyncGenerator = (this && this.__asyncGenerator) || function (thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = Object.create((typeof AsyncIterator === "function" ? AsyncIterator : Object).prototype), verb("next"), verb("throw"), verb("return", awaitReturn), i[Symbol.asyncIterator] = function () { return this; }, i;
    function awaitReturn(f) { return function (v) { return Promise.resolve(v).then(f, reject); }; }
    function verb(n, f) { if (g[n]) { i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; if (f) i[n] = f(i[n]); } }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
};
var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLMClient = void 0;
var openai_1 = require("openai");
/**
 * Unified LLM client supporting multiple providers
 *
 * Design principle: Provider differences are implementation details,
 * hidden behind a single clean interface.
 */
var LLMClient = /** @class */ (function () {
    function LLMClient(config) {
        this.config = config;
    }
    /**
     * Main entry point - routes to appropriate provider implementation
     * No special cases here, just data-driven dispatch
     */
    LLMClient.prototype.call = function (options) {
        return __awaiter(this, void 0, void 0, function () {
            var provider, _a, _exhaustive;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        provider = this.config.provider;
                        _a = provider;
                        switch (_a) {
                            case "openai": return [3 /*break*/, 1];
                            case "deepseek": return [3 /*break*/, 1];
                            case "anthropic": return [3 /*break*/, 3];
                        }
                        return [3 /*break*/, 5];
                    case 1: return [4 /*yield*/, this.callOpenAICompatible(options)];
                    case 2: return [2 /*return*/, _b.sent()];
                    case 3: return [4 /*yield*/, this.callAnthropic(options)];
                    case 4: return [2 /*return*/, _b.sent()];
                    case 5:
                        _exhaustive = provider;
                        throw new Error("Unsupported provider: ".concat(_exhaustive));
                }
            });
        });
    };
    /**
     * Streaming version - yields text chunks as they arrive
     * Returns AsyncGenerator for use with for-await loops
     */
    LLMClient.prototype.stream = function (options) {
        return __asyncGenerator(this, arguments, function stream_1() {
            var provider, _a, _exhaustive;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        provider = this.config.provider;
                        _a = provider;
                        switch (_a) {
                            case "openai": return [3 /*break*/, 1];
                            case "deepseek": return [3 /*break*/, 1];
                            case "anthropic": return [3 /*break*/, 4];
                        }
                        return [3 /*break*/, 5];
                    case 1: return [5 /*yield**/, __values(__asyncDelegator(__asyncValues(this.streamOpenAICompatible(options))))];
                    case 2: return [4 /*yield*/, __await.apply(void 0, [_b.sent()])];
                    case 3:
                        _b.sent();
                        return [3 /*break*/, 6];
                    case 4: throw new Error("Anthropic streaming not yet implemented");
                    case 5:
                        _exhaustive = provider;
                        throw new Error("Unsupported provider: ".concat(_exhaustive));
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * OpenAI-compatible streaming implementation
     */
    LLMClient.prototype.streamOpenAICompatible = function (options) {
        return __asyncGenerator(this, arguments, function streamOpenAICompatible_1() {
            var apiKey, baseURL, client, messages, stream, _a, stream_2, stream_2_1, chunk, content, e_1_1;
            var _b, e_1, _c, _d;
            var _e, _f, _g;
            return __generator(this, function (_h) {
                switch (_h.label) {
                    case 0:
                        apiKey = this.getApiKey(this.config.api_key_env || (this.config.provider === "deepseek" ? "DEEPSEEK_API_KEY" : "OPENAI_API_KEY"));
                        baseURL = this.config.base_url || (this.config.provider === "deepseek" ? "https://api.deepseek.com" : "https://api.openai.com/v1");
                        client = new openai_1.default({ apiKey: apiKey, baseURL: baseURL });
                        messages = [];
                        if (options.systemMessage) {
                            messages.push({ role: "system", content: options.systemMessage });
                        }
                        messages.push({ role: "user", content: options.prompt });
                        return [4 /*yield*/, __await(client.chat.completions.create({
                                model: this.config.model,
                                messages: messages,
                                max_tokens: options.maxTokens || this.config.max_tokens || 1024,
                                temperature: options.temperature || this.config.temperature || 0.7,
                                stream: true,
                            }))];
                    case 1:
                        stream = _h.sent();
                        _h.label = 2;
                    case 2:
                        _h.trys.push([2, 12, 13, 18]);
                        _a = true, stream_2 = __asyncValues(stream);
                        _h.label = 3;
                    case 3: return [4 /*yield*/, __await(stream_2.next())];
                    case 4:
                        if (!(stream_2_1 = _h.sent(), _b = stream_2_1.done, !_b)) return [3 /*break*/, 11];
                        _d = stream_2_1.value;
                        _a = false;
                        chunk = _d;
                        content = (_f = (_e = chunk.choices[0]) === null || _e === void 0 ? void 0 : _e.delta) === null || _f === void 0 ? void 0 : _f.content;
                        if (!content) return [3 /*break*/, 7];
                        return [4 /*yield*/, __await({ text: content, done: false })];
                    case 5: return [4 /*yield*/, _h.sent()];
                    case 6:
                        _h.sent();
                        _h.label = 7;
                    case 7:
                        if (!((_g = chunk.choices[0]) === null || _g === void 0 ? void 0 : _g.finish_reason)) return [3 /*break*/, 10];
                        return [4 /*yield*/, __await({ text: "", done: true })];
                    case 8: return [4 /*yield*/, _h.sent()];
                    case 9:
                        _h.sent();
                        return [3 /*break*/, 11];
                    case 10:
                        _a = true;
                        return [3 /*break*/, 3];
                    case 11: return [3 /*break*/, 18];
                    case 12:
                        e_1_1 = _h.sent();
                        e_1 = { error: e_1_1 };
                        return [3 /*break*/, 18];
                    case 13:
                        _h.trys.push([13, , 16, 17]);
                        if (!(!_a && !_b && (_c = stream_2.return))) return [3 /*break*/, 15];
                        return [4 /*yield*/, __await(_c.call(stream_2))];
                    case 14:
                        _h.sent();
                        _h.label = 15;
                    case 15: return [3 /*break*/, 17];
                    case 16:
                        if (e_1) throw e_1.error;
                        return [7 /*endfinally*/];
                    case 17: return [7 /*endfinally*/];
                    case 18: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * OpenAI-compatible implementation (non-streaming)
     * Used by both OpenAI and DeepSeek (which is API-compatible)
     *
     * This is the "happy path" - standard REST API, standard response format
     */
    LLMClient.prototype.callOpenAICompatible = function (options) {
        return __awaiter(this, void 0, void 0, function () {
            var apiKey, baseURL, client, messages, completion;
            var _a, _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        apiKey = this.getApiKey(this.config.api_key_env || (this.config.provider === "deepseek" ? "DEEPSEEK_API_KEY" : "OPENAI_API_KEY"));
                        baseURL = this.config.base_url || (this.config.provider === "deepseek" ? "https://api.deepseek.com" : "https://api.openai.com/v1");
                        client = new openai_1.default({
                            apiKey: apiKey,
                            baseURL: baseURL,
                        });
                        messages = [];
                        if (options.systemMessage) {
                            messages.push({ role: "system", content: options.systemMessage });
                        }
                        messages.push({ role: "user", content: options.prompt });
                        return [4 /*yield*/, client.chat.completions.create({
                                model: this.config.model,
                                messages: messages,
                                max_tokens: options.maxTokens || this.config.max_tokens || 1024,
                                temperature: options.temperature || this.config.temperature || 0.7,
                            })];
                    case 1:
                        completion = _d.sent();
                        // Normalize response to unified format
                        return [2 /*return*/, {
                                text: completion.choices[0].message.content || "",
                                usage: {
                                    prompt_tokens: ((_a = completion.usage) === null || _a === void 0 ? void 0 : _a.prompt_tokens) || 0,
                                    completion_tokens: ((_b = completion.usage) === null || _b === void 0 ? void 0 : _b.completion_tokens) || 0,
                                    total_tokens: ((_c = completion.usage) === null || _c === void 0 ? void 0 : _c.total_tokens) || 0,
                                },
                            }];
                }
            });
        });
    };
    /**
     * Anthropic implementation
     *
     * TODO: Implement in phase 2.5
     * Requires @anthropic-ai/sdk package which is not yet installed
     */
    LLMClient.prototype.callAnthropic = function (_options) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                throw new Error("Anthropic provider not yet implemented. " +
                    "Install @anthropic-ai/sdk and uncomment the implementation.");
            });
        });
    };
    /**
     * Get API key from environment
     *
     * Fails fast if key is missing - better to error early than to fail
     * midway through a request with a cryptic authentication error.
     */
    LLMClient.prototype.getApiKey = function (envVar) {
        var apiKey = process.env[envVar];
        if (!apiKey) {
            throw new Error("Environment variable ".concat(envVar, " is not set. ") +
                "Please set it in your .env file or environment.");
        }
        return apiKey;
    };
    return LLMClient;
}());
exports.LLMClient = LLMClient;
