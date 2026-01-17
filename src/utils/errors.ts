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

/**
 * 错误严重级别
 */
export enum ErrorSeverity {
  /** 低级别: 可以降级处理 */
  LOW = "low",
  /** 中级别: 影响部分功能 */
  MEDIUM = "medium",
  /** 高级别: 阻止流程继续 */
  HIGH = "high",
  /** 致命: 无法恢复 */
  FATAL = "fatal"
}

/**
 * 错误类型
 */
export enum ErrorType {
  /** 网络错误 */
  NETWORK = "network",
  /** API 错误 */
  API = "api",
  /** 数据验证错误 */
  VALIDATION = "validation",
  /** 文件系统错误 */
  FILESYSTEM = "filesystem",
  /** 配置错误 */
  CONFIGURATION = "configuration",
  /** LLM 错误 */
  LLM = "llm",
  /** 未知错误 */
  UNKNOWN = "unknown"
}

/**
 * 应用错误基类
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly type: ErrorType,
    public readonly severity: ErrorSeverity,
    public readonly context?: Record<string, any>,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * 是否可以降级处理
   */
  canRecover(): boolean {
    return this.severity !== ErrorSeverity.FATAL && this.severity !== ErrorSeverity.HIGH;
  }

  /**
   * 转换为可序列化的对象
   */
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      type: this.type,
      severity: this.severity,
      context: this.context,
      cause: this.cause?.message,
      stack: this.stack
    };
  }
}

/**
 * 网络错误
 */
export class NetworkError extends AppError {
  constructor(
    message: string,
    context?: Record<string, any>,
    cause?: Error
  ) {
    super(message, ErrorType.NETWORK, ErrorSeverity.MEDIUM, context, cause);
  }
}

/**
 * API 错误
 */
export class ApiError extends AppError {
  constructor(
    message: string,
    public readonly statusCode?: number,
    context?: Record<string, any>,
    cause?: Error
  ) {
    super(message, ErrorType.API, ErrorSeverity.MEDIUM, { ...context, statusCode }, cause);
  }
}

/**
 * 验证错误
 */
export class ValidationError extends AppError {
  constructor(
    message: string,
    public readonly field?: string,
    context?: Record<string, any>
  ) {
    super(message, ErrorType.VALIDATION, ErrorSeverity.MEDIUM, { ...context, field });
  }
}

/**
 * 配置错误
 */
export class ConfigurationError extends AppError {
  constructor(
    message: string,
    public readonly configKey?: string,
    context?: Record<string, any>
  ) {
    super(message, ErrorType.CONFIGURATION, ErrorSeverity.HIGH, { ...context, configKey });
  }
}

/**
 * LLM 错误
 */
export class LLMError extends AppError {
  constructor(
    message: string,
    public readonly provider?: string,
    public readonly model?: string,
    context?: Record<string, any>,
    cause?: Error
  ) {
    super(message, ErrorType.LLM, ErrorSeverity.MEDIUM, { ...context, provider, model }, cause);
  }
}

/**
 * 降级策略
 */
export interface FallbackStrategy<T> {
  /**
   * 尝试降级处理
   * @returns 降级结果，如果无法降级则抛出错误
   */
  fallback(): Promise<T> | T;
}

/**
 * 错误处理器
 */
export class ErrorHandler {
  /**
   * 处理错误
   */
  static handle(error: unknown, context?: string): void {
    if (error instanceof AppError) {
      console.error(`[${context || "App"}] ${error.type.toUpperCase()} Error:`, error.message);

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
    } else if (error instanceof Error) {
      console.error(`[${context || "App"}] Error:`, error.message);
      console.error("Stack:", error.stack);
    } else {
      console.error(`[${context || "App"}] Unknown error:`, error);
    }
  }

  /**
   * 带降级的错误处理
   */
  static async withFallback<T>(
    fn: () => Promise<T>,
    fallback: FallbackStrategy<T>,
    context?: string
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof AppError && error.canRecover()) {
        console.warn(`[${context || "App"}] ${error.message}, attempting fallback...`);
        this.handle(error, context);
        return await fallback.fallback();
      }
      throw error;
    }
  }

  /**
   * 包装异步函数，自动处理错误
   */
  static async wrap<T>(
    fn: () => Promise<T>,
    context?: string
  ): Promise<{ success: true; data: T } | { success: false; error: string }> {
    try {
      const data = await fn();
      return { success: true, data };
    } catch (error) {
      this.handle(error, context);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

/**
 * 重试装饰器
 */
export function retry<T extends (...args: any[]) => any>(
  fn: T,
  options: {
    maxAttempts?: number;
    delay?: number;
    backoff?: number;
    shouldRetry?: (error: any) => boolean;
  } = {}
): T {
  const {
    maxAttempts = 3,
    delay = 1000,
    backoff = 2,
    shouldRetry = (error: any) => {
      if (error instanceof AppError) {
        return error.severity !== ErrorSeverity.HIGH && error.severity !== ErrorSeverity.FATAL;
      }
      return true;
    }
  } = options;

  return (async (...args: any[]) => {
    let lastError: any;
    let currentDelay = delay;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn(...args);
      } catch (error) {
        lastError = error;

        if (attempt === maxAttempts || !shouldRetry(error)) {
          throw error;
        }

        console.warn(`Retry ${attempt}/${maxAttempts} after ${currentDelay}ms...`, error instanceof Error ? error.message : error);
        await new Promise(resolve => setTimeout(resolve, currentDelay));
        currentDelay *= backoff;
      }
    }

    throw lastError;
  }) as T;
}
