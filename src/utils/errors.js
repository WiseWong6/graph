"use strict";
/**
 * 统一错误处理
 *
 * 职责: 定义错误类型、错误处理策略
 *
 * 设计原则:
 * - 类型安全的错误
 * - 可恢复 vs 不可恢复错误
 * - 降级策略支持
 */
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
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
exports.ErrorHandler = exports.LLMError = exports.ConfigurationError = exports.ValidationError = exports.ApiError = exports.NetworkError = exports.AppError = exports.ErrorType = exports.ErrorSeverity = void 0;
exports.retry = retry;
/**
 * 错误严重级别
 */
var ErrorSeverity;
(function (ErrorSeverity) {
    /** 低级别: 可以降级处理 */
    ErrorSeverity["LOW"] = "low";
    /** 中级别: 影响部分功能 */
    ErrorSeverity["MEDIUM"] = "medium";
    /** 高级别: 阻止流程继续 */
    ErrorSeverity["HIGH"] = "high";
    /** 致命: 无法恢复 */
    ErrorSeverity["FATAL"] = "fatal";
})(ErrorSeverity || (exports.ErrorSeverity = ErrorSeverity = {}));
/**
 * 错误类型
 */
var ErrorType;
(function (ErrorType) {
    /** 网络错误 */
    ErrorType["NETWORK"] = "network";
    /** API 错误 */
    ErrorType["API"] = "api";
    /** 数据验证错误 */
    ErrorType["VALIDATION"] = "validation";
    /** 文件系统错误 */
    ErrorType["FILESYSTEM"] = "filesystem";
    /** 配置错误 */
    ErrorType["CONFIGURATION"] = "configuration";
    /** LLM 错误 */
    ErrorType["LLM"] = "llm";
    /** 未知错误 */
    ErrorType["UNKNOWN"] = "unknown";
})(ErrorType || (exports.ErrorType = ErrorType = {}));
/**
 * 应用错误基类
 */
var AppError = /** @class */ (function (_super) {
    __extends(AppError, _super);
    function AppError(message, type, severity, context, cause) {
        var _this = _super.call(this, message) || this;
        _this.type = type;
        _this.severity = severity;
        _this.context = context;
        _this.cause = cause;
        _this.name = _this.constructor.name;
        Error.captureStackTrace(_this, _this.constructor);
        return _this;
    }
    /**
     * 是否可以降级处理
     */
    AppError.prototype.canRecover = function () {
        return this.severity !== ErrorSeverity.FATAL && this.severity !== ErrorSeverity.HIGH;
    };
    /**
     * 转换为可序列化的对象
     */
    AppError.prototype.toJSON = function () {
        var _a;
        return {
            name: this.name,
            message: this.message,
            type: this.type,
            severity: this.severity,
            context: this.context,
            cause: (_a = this.cause) === null || _a === void 0 ? void 0 : _a.message,
            stack: this.stack
        };
    };
    return AppError;
}(Error));
exports.AppError = AppError;
/**
 * 网络错误
 */
var NetworkError = /** @class */ (function (_super) {
    __extends(NetworkError, _super);
    function NetworkError(message, context, cause) {
        return _super.call(this, message, ErrorType.NETWORK, ErrorSeverity.MEDIUM, context, cause) || this;
    }
    return NetworkError;
}(AppError));
exports.NetworkError = NetworkError;
/**
 * API 错误
 */
var ApiError = /** @class */ (function (_super) {
    __extends(ApiError, _super);
    function ApiError(message, statusCode, context, cause) {
        var _this = _super.call(this, message, ErrorType.API, ErrorSeverity.MEDIUM, __assign(__assign({}, context), { statusCode: statusCode }), cause) || this;
        _this.statusCode = statusCode;
        return _this;
    }
    return ApiError;
}(AppError));
exports.ApiError = ApiError;
/**
 * 验证错误
 */
var ValidationError = /** @class */ (function (_super) {
    __extends(ValidationError, _super);
    function ValidationError(message, field, context) {
        var _this = _super.call(this, message, ErrorType.VALIDATION, ErrorSeverity.MEDIUM, __assign(__assign({}, context), { field: field })) || this;
        _this.field = field;
        return _this;
    }
    return ValidationError;
}(AppError));
exports.ValidationError = ValidationError;
/**
 * 配置错误
 */
var ConfigurationError = /** @class */ (function (_super) {
    __extends(ConfigurationError, _super);
    function ConfigurationError(message, configKey, context) {
        var _this = _super.call(this, message, ErrorType.CONFIGURATION, ErrorSeverity.HIGH, __assign(__assign({}, context), { configKey: configKey })) || this;
        _this.configKey = configKey;
        return _this;
    }
    return ConfigurationError;
}(AppError));
exports.ConfigurationError = ConfigurationError;
/**
 * LLM 错误
 */
var LLMError = /** @class */ (function (_super) {
    __extends(LLMError, _super);
    function LLMError(message, provider, model, context, cause) {
        var _this = _super.call(this, message, ErrorType.LLM, ErrorSeverity.MEDIUM, __assign(__assign({}, context), { provider: provider, model: model }), cause) || this;
        _this.provider = provider;
        _this.model = model;
        return _this;
    }
    return LLMError;
}(AppError));
exports.LLMError = LLMError;
/**
 * 错误处理器
 */
var ErrorHandler = /** @class */ (function () {
    function ErrorHandler() {
    }
    /**
     * 处理错误
     */
    ErrorHandler.handle = function (error, context) {
        if (error instanceof AppError) {
            console.error("[".concat(context || "App", "] ").concat(error.type.toUpperCase(), " Error:"), error.message);
            if (error.context) {
                console.error("Context:", error.context);
            }
            if (error.cause) {
                console.error("Caused by:", error.cause.message);
            }
            // 根据严重级别决定是否打印堆栈
            if (error.severity === ErrorSeverity.HIGH || error.severity === ErrorSeverity.FATAL) {
                console.error("Stack:", error.stack);
            }
        }
        else if (error instanceof Error) {
            console.error("[".concat(context || "App", "] Error:"), error.message);
            console.error("Stack:", error.stack);
        }
        else {
            console.error("[".concat(context || "App", "] Unknown error:"), error);
        }
    };
    /**
     * 带降级的错误处理
     */
    ErrorHandler.withFallback = function (fn, fallback, context) {
        return __awaiter(this, void 0, void 0, function () {
            var error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 5]);
                        return [4 /*yield*/, fn()];
                    case 1: return [2 /*return*/, _a.sent()];
                    case 2:
                        error_1 = _a.sent();
                        if (!(error_1 instanceof AppError && error_1.canRecover())) return [3 /*break*/, 4];
                        console.warn("[".concat(context || "App", "] ").concat(error_1.message, ", attempting fallback..."));
                        this.handle(error_1, context);
                        return [4 /*yield*/, fallback.fallback()];
                    case 3: return [2 /*return*/, _a.sent()];
                    case 4: throw error_1;
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * 包装异步函数，自动处理错误
     */
    ErrorHandler.wrap = function (fn, context) {
        return __awaiter(this, void 0, void 0, function () {
            var data, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, fn()];
                    case 1:
                        data = _a.sent();
                        return [2 /*return*/, { success: true, data: data }];
                    case 2:
                        error_2 = _a.sent();
                        this.handle(error_2, context);
                        return [2 /*return*/, {
                                success: false,
                                error: error_2 instanceof Error ? error_2.message : String(error_2)
                            }];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    return ErrorHandler;
}());
exports.ErrorHandler = ErrorHandler;
/**
 * 重试装饰器
 */
function retry(fn, options) {
    var _this = this;
    if (options === void 0) { options = {}; }
    var _a = options.maxAttempts, maxAttempts = _a === void 0 ? 3 : _a, _b = options.delay, delay = _b === void 0 ? 1000 : _b, _c = options.backoff, backoff = _c === void 0 ? 2 : _c, _d = options.shouldRetry, shouldRetry = _d === void 0 ? function (error) {
        if (error instanceof AppError) {
            return error.severity !== ErrorSeverity.HIGH && error.severity !== ErrorSeverity.FATAL;
        }
        return true;
    } : _d;
    return (function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        return __awaiter(_this, void 0, void 0, function () {
            var lastError, currentDelay, attempt, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        currentDelay = delay;
                        attempt = 1;
                        _a.label = 1;
                    case 1:
                        if (!(attempt <= maxAttempts)) return [3 /*break*/, 7];
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 4, , 6]);
                        return [4 /*yield*/, fn.apply(void 0, args)];
                    case 3: return [2 /*return*/, _a.sent()];
                    case 4:
                        error_3 = _a.sent();
                        lastError = error_3;
                        if (attempt === maxAttempts || !shouldRetry(error_3)) {
                            throw error_3;
                        }
                        console.warn("Retry ".concat(attempt, "/").concat(maxAttempts, " after ").concat(currentDelay, "ms..."), error_3 instanceof Error ? error_3.message : error_3);
                        return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, currentDelay); })];
                    case 5:
                        _a.sent();
                        currentDelay *= backoff;
                        return [3 /*break*/, 6];
                    case 6:
                        attempt++;
                        return [3 /*break*/, 1];
                    case 7: throw lastError;
                }
            });
        });
    });
}
