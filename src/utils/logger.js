"use strict";
/**
 * 统一日志工具
 *
 * 职责: 提供结构化的日志输出
 *
 * 设计原则:
 * - 分级日志
 * - 结构化输出
 * - 性能计时
 * - 进度跟踪
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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeLogger = exports.Logger = exports.ProgressTracker = exports.Timer = exports.LogLevel = void 0;
exports.createLogger = createLogger;
/**
 * 日志级别
 */
var LogLevel;
(function (LogLevel) {
    LogLevel["DEBUG"] = "debug";
    LogLevel["INFO"] = "info";
    LogLevel["WARN"] = "warn";
    LogLevel["ERROR"] = "error";
    LogLevel["SUCCESS"] = "success";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
/**
 * 日志颜色
 */
var LogColors = (_a = {},
    _a[LogLevel.DEBUG] = "\x1b[36m",
    _a[LogLevel.INFO] = "\x1b[37m",
    _a[LogLevel.WARN] = "\x1b[33m",
    _a[LogLevel.ERROR] = "\x1b[31m",
    _a[LogLevel.SUCCESS] = "\x1b[32m" // Green
,
    _a);
var ResetColor = "\x1b[0m";
/**
 * 性能计时器
 */
var Timer = /** @class */ (function () {
    function Timer() {
        this.startTime = Date.now();
    }
    /**
     * 设置标签
     */
    Timer.prototype.setLabel = function (label) {
        // 用于调试，保留但不使用
        void label;
    };
    /**
     * 获取经过的时间（毫秒）
     */
    Timer.prototype.elapsed = function () {
        return Date.now() - this.startTime;
    };
    /**
     * 重置计时器
     */
    Timer.prototype.reset = function () {
        this.startTime = Date.now();
    };
    /**
     * 记录时间
     */
    Timer.prototype.log = function () {
        var ms = this.elapsed();
        var seconds = (ms / 1000).toFixed(2);
        return ms > 1000 ? "".concat(seconds, "s") : "".concat(ms, "ms");
    };
    return Timer;
}());
exports.Timer = Timer;
/**
 * 进度跟踪器
 */
var ProgressTracker = /** @class */ (function () {
    function ProgressTracker(total, context) {
        this.current = 0;
        this.total = total;
        this.context = context;
        this.startTime = Date.now();
    }
    /**
     * 增加进度
     */
    ProgressTracker.prototype.increment = function (step) {
        this.current++;
        this.log(step);
    };
    /**
     * 设置进度
     */
    ProgressTracker.prototype.setProgress = function (current, step) {
        this.current = current;
        this.log(step);
    };
    /**
     * 完成进度
     */
    ProgressTracker.prototype.complete = function () {
        this.current = this.total;
        var elapsed = ((Date.now() - this.startTime) / 1000).toFixed(2);
        Logger.success("[".concat(this.context, "] Complete in ").concat(elapsed, "s"));
    };
    /**
     * 获取进度百分比
     */
    ProgressTracker.prototype.getPercentage = function () {
        return Math.floor((this.current / this.total) * 100);
    };
    /**
     * 获取预计剩余时间（毫秒）
     */
    ProgressTracker.prototype.getEstimatedRemainingTime = function () {
        var elapsed = Date.now() - this.startTime;
        var perItem = elapsed / this.current;
        return perItem * (this.total - this.current);
    };
    ProgressTracker.prototype.log = function (step) {
        var percentage = this.getPercentage();
        var bar = "█".repeat(Math.floor(percentage / 5)) + "░".repeat(20 - Math.floor(percentage / 5));
        var remaining = this.formatTime(this.getEstimatedRemainingTime());
        Logger.info("[".concat(this.context, "] [").concat(this.current, "/").concat(this.total, "] ").concat(bar, " ").concat(percentage, "%").concat(step ? " - ".concat(step) : "", " (ETA: ").concat(remaining, ")"));
    };
    ProgressTracker.prototype.formatTime = function (ms) {
        if (ms < 1000)
            return "".concat(Math.floor(ms), "ms");
        if (ms < 60000)
            return "".concat((ms / 1000).toFixed(0), "s");
        var minutes = Math.floor(ms / 60000);
        var seconds = Math.floor((ms % 60000) / 1000);
        return "".concat(minutes, "m").concat(seconds, "s");
    };
    return ProgressTracker;
}());
exports.ProgressTracker = ProgressTracker;
/**
 * 日志工具类
 */
var Logger = /** @class */ (function () {
    function Logger() {
    }
    /**
     * 设置全局上下文
     */
    Logger.setContext = function (context) {
        this.context = __assign(__assign({}, this.context), context);
    };
    /**
     * 清除上下文
     */
    Logger.clearContext = function () {
        this.context = {};
    };
    /**
     * 创建带上下文的子日志
     */
    Logger.with = function (context) {
        return new Proxy(this, {
            get: function (target, prop) {
                if (typeof prop === "string" && ["debug", "info", "warn", "error", "success"].includes(prop)) {
                    return function (message) {
                        var _a;
                        var args = [];
                        for (var _i = 1; _i < arguments.length; _i++) {
                            args[_i - 1] = arguments[_i];
                        }
                        Logger.setContext(context);
                        (_a = target)[prop].apply(_a, __spreadArray([message], args, false));
                        Logger.clearContext();
                    };
                }
                return target[prop];
            }
        });
    };
    /**
     * 格式化消息
     */
    Logger.format = function (level, message) {
        var args = [];
        for (var _i = 2; _i < arguments.length; _i++) {
            args[_i - 2] = arguments[_i];
        }
        var timestamp = new Date().toISOString().split("T")[1].slice(0, 12);
        var color = LogColors[level];
        var prefix = this.formatPrefix();
        // 格式化参数
        var formattedArgs = args.map(function (arg) {
            if (typeof arg === "object") {
                return JSON.stringify(arg, null, 2);
            }
            return String(arg);
        }).join(" ");
        return "".concat(color, "[").concat(timestamp, "]").concat(prefix, " ").concat(message).concat(formattedArgs ? " " + formattedArgs : "").concat(ResetColor);
    };
    /**
     * 格式化前缀
     */
    Logger.formatPrefix = function () {
        var parts = [];
        if (this.context.node)
            parts.push(this.context.node);
        if (this.context.step)
            parts.push(this.context.step);
        return parts.length > 0 ? " [".concat(parts.join(":"), "]") : "";
    };
    /**
     * Debug 级别日志
     */
    Logger.debug = function (message) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        if (process.env.DEBUG) {
            console.log(this.format.apply(this, __spreadArray([LogLevel.DEBUG, message], args, false)));
        }
    };
    /**
     * Info 级别日志
     */
    Logger.info = function (message) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        console.log(this.format.apply(this, __spreadArray([LogLevel.INFO, message], args, false)));
    };
    /**
     * Warn 级别日志
     */
    Logger.warn = function (message) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        console.warn(this.format.apply(this, __spreadArray([LogLevel.WARN, message], args, false)));
    };
    /**
     * Error 级别日志
     */
    Logger.error = function (message) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        console.error(this.format.apply(this, __spreadArray([LogLevel.ERROR, message], args, false)));
    };
    /**
     * Success 级别日志
     */
    Logger.success = function (message) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        console.log(this.format.apply(this, __spreadArray([LogLevel.SUCCESS, message], args, false)));
    };
    /**
     * 分隔线
     */
    Logger.separator = function (char, length) {
        if (char === void 0) { char = "-"; }
        if (length === void 0) { length = 50; }
        console.log(char.repeat(length));
    };
    /**
     * 标题
     */
    Logger.title = function (title) {
        this.separator("=");
        console.log("  ".concat(title));
        this.separator("=");
    };
    /**
     * 创建计时器
     */
    Logger.timer = function (_name) {
        return new Timer();
    };
    /**
     * 创建进度跟踪器
     */
    Logger.progress = function (total, context) {
        return new ProgressTracker(total, context);
    };
    /**
     * 记录对象
     */
    Logger.object = function (obj, label) {
        var message = label ? "".concat(label, ":") : "Object:";
        this.info(message);
        console.log(JSON.stringify(obj, null, 2));
    };
    /**
     * 记录表格
     */
    Logger.table = function (data) {
        console.table(data);
    };
    Logger.context = {};
    return Logger;
}());
exports.Logger = Logger;
/**
 * 节点日志助手
 */
var NodeLogger = /** @class */ (function () {
    function NodeLogger(nodeName) {
        this.nodeName = nodeName;
    }
    /**
     * Debug 日志
     */
    NodeLogger.prototype.debug = function (message) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        Logger.debug.apply(Logger, __spreadArray(["[".concat(this.nodeName, "] ").concat(message)], args, false));
    };
    /**
     * Info 日志
     */
    NodeLogger.prototype.info = function (message) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        Logger.info.apply(Logger, __spreadArray(["[".concat(this.nodeName, "] ").concat(message)], args, false));
    };
    /**
     * Warn 日志
     */
    NodeLogger.prototype.warn = function (message) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        Logger.warn.apply(Logger, __spreadArray(["[".concat(this.nodeName, "] ").concat(message)], args, false));
    };
    /**
     * Error 日志
     */
    NodeLogger.prototype.error = function (message) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        Logger.error.apply(Logger, __spreadArray(["[".concat(this.nodeName, "] ").concat(message)], args, false));
    };
    /**
     * Success 日志
     */
    NodeLogger.prototype.success = function (message) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        Logger.success.apply(Logger, __spreadArray(["[".concat(this.nodeName, "] ").concat(message)], args, false));
    };
    /**
     * 计时器
     */
    NodeLogger.prototype.timer = function (_step) {
        return Logger.timer("".concat(this.nodeName, ":timer"));
    };
    /**
     * 进度跟踪
     */
    NodeLogger.prototype.progress = function (total, step) {
        return Logger.progress(total, "".concat(this.nodeName, ":").concat(step));
    };
    /**
     * 开始步骤
     */
    NodeLogger.prototype.startStep = function (step) {
        this.info("[Step: ".concat(step, "] Start"));
    };
    /**
     * 完成步骤
     */
    NodeLogger.prototype.completeStep = function (step, result) {
        if (result) {
            this.success("[Step: ".concat(step, "] Complete"), result);
        }
        else {
            this.success("[Step: ".concat(step, "] Complete"));
        }
    };
    /**
     * 失败步骤
     */
    NodeLogger.prototype.failStep = function (step, error) {
        this.error("[Step: ".concat(step, "] Failed"), error instanceof Error ? error.message : error);
    };
    /**
     * 跳过步骤
     */
    NodeLogger.prototype.skipStep = function (step, reason) {
        this.warn("[Step: ".concat(step, "] Skipped:"), reason);
    };
    /**
     * 分隔线
     */
    NodeLogger.prototype.separator = function (char, length) {
        if (char === void 0) { char = "-"; }
        if (length === void 0) { length = 50; }
        Logger.separator(char, length);
    };
    return NodeLogger;
}());
exports.NodeLogger = NodeLogger;
/**
 * 导出工厂函数
 */
function createLogger(nodeName) {
    return new NodeLogger(nodeName);
}
