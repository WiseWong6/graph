/**
 * MCP (Model Context Protocol) 适配器基类
 *
 * 职责:
 * - 检测运行环境（Claude Code vs 独立运行）
 * - 提供统一的 MCP 调用接口
 * - 自动降级到 HTTP API
 *
 * 设计原则:
 * - 优先使用原生 MCP（在 Claude Code 中）
 * - 降级到直接 HTTP 调用（独立运行）
 * - 统一错误处理
 */

/**
 * MCP 工具接口
 */
export interface MCPTool {
  name: string;
  description: string;
  execute: (params: unknown) => Promise<unknown>;
}

/**
 * MCP 调用结果
 */
export interface MCPResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  fallback?: boolean;  // 是否使用了降级方案
}

/**
 * MCP 适配器基类
 *
 * 提供环境检测和统一的调用接口
 */
export class MCPAdapter {
  /**
   * 检测是否在 Claude Code 环境中运行
   *
   * 判断依据:
   * - 环境变量 CLAUDE_CODE_MCP_AVAILABLE
   * - process.env 中是否有 MCP 相关配置
   */
  protected isInClaudeCode(): boolean {
    return (
      process.env.CLAUDE_CODE_MCP_AVAILABLE === "true" ||
      !!process.env.MCP_SERVERS ||
      // 可以添加更多检测逻辑
      false
    );
  }

  /**
   * 调用 MCP 工具
   *
   * 自动选择:
   * - Claude Code 中: 使用原生 MCP
   * - 独立运行: 使用 HTTP 降级
   *
   * @param toolName - 工具名称
   * @param params - 调用参数
   * @param fallbackFn - 降级函数（HTTP 调用）
   */
  protected async callMCP<T>(
    toolName: string,
    params: unknown,
    fallbackFn?: () => Promise<T>
  ): Promise<MCPResult<T>> {
    // 优先尝试原生 MCP
    if (this.isInClaudeCode()) {
      try {
        const result = await this.callNativeMCP<T>(toolName, params);
        return { success: true, data: result, fallback: false };
      } catch (error) {
        // 原生 MCP 失败，尝试降级
        if (fallbackFn) {
          try {
            const data = await fallbackFn();
            return { success: true, data, fallback: true };
          } catch (fallbackError) {
            return {
              success: false,
              error: `MCP and fallback both failed: ${this.errorMessage(error)} / ${this.errorMessage(fallbackError)}`
            };
          }
        }
        return { success: false, error: this.errorMessage(error) };
      }
    }

    // 独立运行：直接使用降级方案
    if (fallbackFn) {
      try {
        const data = await fallbackFn();
        return { success: true, data, fallback: true };
      } catch (error) {
        return { success: false, error: this.errorMessage(error) };
      }
    }

    return {
      success: false,
      error: `No fallback available for tool: ${toolName}`
    };
  }

  /**
   * 调用原生 MCP（在 Claude Code 中）
   *
   * 子类应该重写此方法以实现具体的 MCP 调用
   */
  protected async callNativeMCP<T>(
    _toolName: string,
    _params: unknown
  ): Promise<T> {
    throw new Error("callNativeMCP not implemented");
  }

  /**
   * 提取错误信息
   */
  protected errorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }

  /**
   * 健康检查
   *
   * 检查 MCP 服务是否可用
   */
  async healthCheck(): Promise<MCPResult<{ available: boolean; mode: "mcp" | "http" }>> {
    const available = this.isInClaudeCode();
    return {
      success: true,
      data: {
        available,
        mode: available ? "mcp" : "http"
      }
    };
  }
}

/**
 * 创建一个简单的 HTTP GET 请求（用于降级）
 */
export async function httpGet<T>(url: string, headers?: Record<string, string>): Promise<T> {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...headers
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

/**
 * 创建一个简单的 HTTP POST 请求（用于降级）
 */
export async function httpPost<T>(
  url: string,
  body: unknown,
  headers?: Record<string, string>
): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}
