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

/**
 * 日志级别
 */
export enum LogLevel {
  DEBUG = "debug",
  INFO = "info",
  WARN = "warn",
  ERROR = "error",
  SUCCESS = "success"
}

/**
 * 日志颜色
 */
const LogColors = {
  [LogLevel.DEBUG]: "\x1b[36m",    // Cyan
  [LogLevel.INFO]: "\x1b[37m",     // White
  [LogLevel.WARN]: "\x1b[33m",     // Yellow
  [LogLevel.ERROR]: "\x1b[31m",    // Red
  [LogLevel.SUCCESS]: "\x1b[32m"   // Green
};

const ResetColor = "\x1b[0m";

/**
 * 日志上下文
 */
interface LogContext {
  node?: string;
  step?: string;
  [key: string]: any;
}

/**
 * 性能计时器
 */
export class Timer {
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
  }

  /**
   * 设置标签
   */
  setLabel(label: string): void {
    // 用于调试，保留但不使用
    void label;
  }

  /**
   * 获取经过的时间（毫秒）
   */
  elapsed(): number {
    return Date.now() - this.startTime;
  }

  /**
   * 重置计时器
   */
  reset(): void {
    this.startTime = Date.now();
  }

  /**
   * 记录时间
   */
  log(): string {
    const ms = this.elapsed();
    const seconds = (ms / 1000).toFixed(2);
    return ms > 1000 ? `${seconds}s` : `${ms}ms`;
  }
}

/**
 * 进度跟踪器
 */
export class ProgressTracker {
  private total: number;
  private current: number = 0;
  private readonly context: string;
  private readonly startTime: number;

  constructor(total: number, context: string) {
    this.total = total;
    this.context = context;
    this.startTime = Date.now();
  }

  /**
   * 增加进度
   */
  increment(step?: string): void {
    this.current++;
    this.log(step);
  }

  /**
   * 设置进度
   */
  setProgress(current: number, step?: string): void {
    this.current = current;
    this.log(step);
  }

  /**
   * 完成进度
   */
  complete(): void {
    this.current = this.total;
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(2);
    Logger.success(`[${this.context}] Complete in ${elapsed}s`);
  }

  /**
   * 获取进度百分比
   */
  getPercentage(): number {
    return Math.floor((this.current / this.total) * 100);
  }

  /**
   * 获取预计剩余时间（毫秒）
   */
  getEstimatedRemainingTime(): number {
    const elapsed = Date.now() - this.startTime;
    const perItem = elapsed / this.current;
    return perItem * (this.total - this.current);
  }

  private log(step?: string): void {
    const percentage = this.getPercentage();
    const bar = "█".repeat(Math.floor(percentage / 5)) + "░".repeat(20 - Math.floor(percentage / 5));
    const remaining = this.formatTime(this.getEstimatedRemainingTime());

    Logger.info(
      `[${this.context}] [${this.current}/${this.total}] ${bar} ${percentage}%${step ? ` - ${step}` : ""} (ETA: ${remaining})`
    );
  }

  private formatTime(ms: number): string {
    if (ms < 1000) return `${Math.floor(ms)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(0)}s`;
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m${seconds}s`;
  }
}

/**
 * 日志工具类
 */
export class Logger {
  private static context: LogContext = {};

  /**
   * 设置全局上下文
   */
  static setContext(context: LogContext): void {
    this.context = { ...this.context, ...context };
  }

  /**
   * 清除上下文
   */
  static clearContext(): void {
    this.context = {};
  }

  /**
   * 创建带上下文的子日志
   */
  static with(context: LogContext): Logger {
    return new Proxy(this, {
      get(target, prop) {
        if (typeof prop === "string" && ["debug", "info", "warn", "error", "success"].includes(prop)) {
          return (message: string, ...args: any[]) => {
            Logger.setContext(context);
            (target as any)[prop](message, ...args);
            Logger.clearContext();
          };
        }
        return (target as any)[prop];
      }
    });
  }

  /**
   * 格式化消息
   */
  private static format(level: LogLevel, message: string, ...args: any[]): string {
    const timestamp = new Date().toISOString().split("T")[1].slice(0, 12);
    const color = LogColors[level];
    const prefix = this.formatPrefix();

    // 格式化参数
    const formattedArgs = args.map(arg => {
      if (typeof arg === "object") {
        return JSON.stringify(arg, null, 2);
      }
      return String(arg);
    }).join(" ");

    return `${color}[${timestamp}]${prefix} ${message}${formattedArgs ? " " + formattedArgs : ""}${ResetColor}`;
  }

  /**
   * 格式化前缀
   */
  private static formatPrefix(): string {
    const parts: string[] = [];
    if (this.context.node) parts.push(this.context.node);
    if (this.context.step) parts.push(this.context.step);
    return parts.length > 0 ? ` [${parts.join(":")}]` : "";
  }

  /**
   * Debug 级别日志
   */
  static debug(message: string, ...args: any[]): void {
    if (process.env.DEBUG) {
      console.log(this.format(LogLevel.DEBUG, message, ...args));
    }
  }

  /**
   * Info 级别日志
   */
  static info(message: string, ...args: any[]): void {
    console.log(this.format(LogLevel.INFO, message, ...args));
  }

  /**
   * Warn 级别日志
   */
  static warn(message: string, ...args: any[]): void {
    console.warn(this.format(LogLevel.WARN, message, ...args));
  }

  /**
   * Error 级别日志
   */
  static error(message: string, ...args: any[]): void {
    console.error(this.format(LogLevel.ERROR, message, ...args));
  }

  /**
   * Success 级别日志
   */
  static success(message: string, ...args: any[]): void {
    console.log(this.format(LogLevel.SUCCESS, message, ...args));
  }

  /**
   * 分隔线
   */
  static separator(char: string = "-", length: number = 50): void {
    console.log(char.repeat(length));
  }

  /**
   * 标题
   */
  static title(title: string): void {
    this.separator("=");
    console.log(`  ${title}`);
    this.separator("=");
  }

  /**
   * 创建计时器
   */
  static timer(_name: string): Timer {
    return new Timer();
  }

  /**
   * 创建进度跟踪器
   */
  static progress(total: number, context: string): ProgressTracker {
    return new ProgressTracker(total, context);
  }

  /**
   * 记录对象
   */
  static object(obj: any, label?: string): void {
    const message = label ? `${label}:` : "Object:";
    this.info(message);
    console.log(JSON.stringify(obj, null, 2));
  }

  /**
   * 记录表格
   */
  static table(data: any[] | Record<string, any>): void {
    console.table(data);
  }
}

/**
 * 节点日志助手
 */
export class NodeLogger {
  constructor(private readonly nodeName: string) {}

  /**
   * Debug 日志
   */
  debug(message: string, ...args: any[]): void {
    Logger.debug(`[${this.nodeName}] ${message}`, ...args);
  }

  /**
   * Info 日志
   */
  info(message: string, ...args: any[]): void {
    Logger.info(`[${this.nodeName}] ${message}`, ...args);
  }

  /**
   * Warn 日志
   */
  warn(message: string, ...args: any[]): void {
    Logger.warn(`[${this.nodeName}] ${message}`, ...args);
  }

  /**
   * Error 日志
   */
  error(message: string, ...args: any[]): void {
    Logger.error(`[${this.nodeName}] ${message}`, ...args);
  }

  /**
   * Success 日志
   */
  success(message: string, ...args: any[]): void {
    Logger.success(`[${this.nodeName}] ${message}`, ...args);
  }

  /**
   * 计时器
   */
  timer(_step: string): Timer {
    return Logger.timer(`${this.nodeName}:timer`);
  }

  /**
   * 进度跟踪
   */
  progress(total: number, step: string): ProgressTracker {
    return Logger.progress(total, `${this.nodeName}:${step}`);
  }

  /**
   * 开始步骤
   */
  startStep(step: string): void {
    this.info(`[Step: ${step}] Start`);
  }

  /**
   * 完成步骤
   */
  completeStep(step: string, result?: any): void {
    if (result) {
      this.success(`[Step: ${step}] Complete`, result);
    } else {
      this.success(`[Step: ${step}] Complete`);
    }
  }

  /**
   * 失败步骤
   */
  failStep(step: string, error: any): void {
    this.error(`[Step: ${step}] Failed`, error instanceof Error ? error.message : error);
  }

  /**
   * 跳过步骤
   */
  skipStep(step: string, reason: string): void {
    this.warn(`[Step: ${step}] Skipped:`, reason);
  }

  /**
   * 分隔线
   */
  separator(char: string = "-", length: number = 50): void {
    Logger.separator(char, length);
  }
}

/**
 * 导出工厂函数
 */
export function createLogger(nodeName: string): NodeLogger {
  return new NodeLogger(nodeName);
}
