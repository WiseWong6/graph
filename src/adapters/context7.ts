/**
 * Context7 适配器
 *
 * 提供文档查询功能:
 * - resolveLibraryId: 解析库名到 Context7 ID
 * - queryDocs: 获取库的文档和代码示例
 *
 * 支持降级: MCP → Context7 HTTP API
 */

import { MCPAdapter, MCPResult, httpPost } from "./mcp";

/**
 * Context7 库信息
 */
export interface Context7Library {
  id: string;
  name: string;
  description: string;
  version?: string;
  codeSnippetCount?: number;
  reputation?: "high" | "medium" | "low";
  benchmarkScore?: number;
}

/**
 * Context7 文档查询结果
 */
export interface Context7DocResult {
  content: string;
  code_snippets?: Array<{
    code: string;
    language: string;
    description?: string;
  }>;
  metadata?: Record<string, unknown>;
}

/**
 * Context7 API 配置
 */
interface Context7Config {
  apiKey?: string;
  apiUrl?: string;
}

/**
 * Context7 适配器类
 *
 * 使用方式:
 * ```ts
 * const adapter = new Context7Adapter({ apiKey: 'xxx' });
 *
 * // 解析库 ID
 * const libResult = await adapter.resolveLibraryId('react', 'How to use useEffect');
 *
 * // 查询文档
 * const docResult = await adapter.queryDocs('/facebook/react', 'useEffect examples');
 * ```
 */
export class Context7Adapter extends MCPAdapter {
  private config: Context7Config;

  // Context7 API 端点
  private readonly DEFAULT_API_URL = "https://api.context7.com/v1";
  private readonly RESOLVE_ENDPOINT = "/libraries/resolve";
  private readonly QUERY_ENDPOINT = "/docs/query";

  constructor(config: Context7Config = {}) {
    super();
    this.config = {
      apiKey: config.apiKey || process.env.CONTEXT7_API_KEY,
      apiUrl: config.apiUrl || this.DEFAULT_API_URL
    };
  }

  /**
   * 解析库名到 Context7 ID
   *
   * @param libraryName - 库名称（如 "react", "next.js"）
   * @param query - 用户查询（用于相关性排序）
   */
  async resolveLibraryId(
    libraryName: string,
    query: string
  ): Promise<MCPResult<Context7Library>> {
    return this.callMCP<Context7Library>(
      "context7_resolve_library_id",
      { libraryName, query },
      () => this.resolveFallback(libraryName, query)
    );
  }

  /**
   * 查询文档
   *
   * @param libraryId - Context7 库 ID（如 "/facebook/react"）
   * @param query - 查询问题
   */
  async queryDocs(
    libraryId: string,
    query: string
  ): Promise<MCPResult<Context7DocResult>> {
    return this.callMCP<Context7DocResult>(
      "context7_query_docs",
      { libraryId, query },
      () => this.queryFallback(libraryId, query)
    );
  }

  /**
   * 降级: 通过 HTTP API 解析库 ID
   */
  private async resolveFallback(
    libraryName: string,
    query: string
  ): Promise<Context7Library> {
    if (!this.config.apiKey) {
      throw new Error("Context7 API key not configured");
    }

    const response = await httpPost<{ library: Context7Library }>(
      `${this.config.apiUrl}${this.RESOLVE_ENDPOINT}`,
      {
        libraryName,
        query
      },
      {
        Authorization: `Bearer ${this.config.apiKey}`
      }
    );

    return response.library;
  }

  /**
   * 降级: 通过 HTTP API 查询文档
   */
  private async queryFallback(
    libraryId: string,
    query: string
  ): Promise<Context7DocResult> {
    if (!this.config.apiKey) {
      throw new Error("Context7 API key not configured");
    }

    const response = await httpPost<{ result: Context7DocResult }>(
      `${this.config.apiUrl}${this.QUERY_ENDPOINT}`,
      {
        libraryId,
        query
      },
      {
        Authorization: `Bearer ${this.config.apiKey}`
      }
    );

    return response.result;
  }

  /**
   * 原生 MCP 调用（在 Claude Code 中）
   *
   * 注意: 这是占位实现。在 Claude Code 中，
   * 实际的 MCP 调用由系统处理，不需要手动实现。
   */
  protected override async callNativeMCP<T>(
    toolName: string,
    _params: unknown
  ): Promise<T> {
    // 在 Claude Code 中，MCP 工具会自动被系统调用
    // 这里我们抛出错误，让 callMCP 使用降级方案
    throw new Error(`Native MCP call for ${toolName} not available in standalone mode`);
  }
}

/**
 * 创建默认的 Context7 适配器实例
 */
export function createContext7Adapter(): Context7Adapter {
  return new Context7Adapter({
    apiKey: process.env.CONTEXT7_API_KEY
  });
}
