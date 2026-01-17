/**
 * Firecrawl 适配器
 *
 * 提供网页搜索和抓取功能:
 * - search: 搜索相关网页
 * - scrape: 抓取单个网页内容
 * - crawl: 爬取整个网站
 *
 * 支持降级: MCP → Firecrawl HTTP API
 */

import { MCPAdapter, MCPResult, httpPost } from "./mcp";

/**
 * Firecrawl 搜索结果
 */
export interface FirecrawlSearchResult {
  title: string;
  url: string;
  description?: string;
  snippet?: string;
  score?: number;
}

/**
 * Firecrawl 抓取结果
 */
export interface FirecrawlScrapeResult {
  title?: string;
  url: string;
  content?: string;
  markdown?: string;
  html?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Firecrawl 搜索响应
 */
export interface FirecrawlSearchResponse {
  success: boolean;
  data?: FirecrawlSearchResult[];
  error?: string;
}

/**
 * Firecrawl 抓取响应
 */
export interface FirecrawlScrapeResponse {
  success: boolean;
  data?: FirecrawlScrapeResult;
  error?: string;
}

/**
 * Firecrawl API 配置
 */
interface FirecrawlConfig {
  apiKey?: string;
  apiUrl?: string;
}

/**
 * Firecrawl 适配器类
 *
 * 使用方式:
 * ```ts
 * const adapter = new FirecrawlAdapter({ apiKey: 'xxx' });
 * const result = await adapter.search('AI Agent 最新进展');
 * if (result.success) {
 *   console.log(result.data);
 * }
 * ```
 */
export class FirecrawlAdapter extends MCPAdapter {
  private config: FirecrawlConfig;

  // Firecrawl API 端点
  private readonly DEFAULT_API_URL = "https://api.firecrawl.dev/v1";
  private readonly SEARCH_ENDPOINT = "/search";
  private readonly SCRAPE_ENDPOINT = "/scrape";

  constructor(config: FirecrawlConfig = {}) {
    super();
    this.config = {
      apiKey: config.apiKey || process.env.FIRECRAWL_API_KEY,
      apiUrl: config.apiUrl || this.DEFAULT_API_URL
    };
  }

  /**
   * 搜索网页
   *
   * @param query - 搜索查询
   * @param options - 搜索选项
   */
  async search(
    query: string,
    options: {
      limit?: number;
      timeout?: number;
    } = {}
  ): Promise<MCPResult<FirecrawlSearchResult[]>> {
    return this.callMCP<FirecrawlSearchResult[]>(
      "firecrawl_search",
      { query, ...options },
      () => this.searchFallback(query, options)
    );
  }

  /**
   * 抓取单个网页
   *
   * @param url - 要抓取的 URL
   */
  async scrape(url: string): Promise<MCPResult<FirecrawlScrapeResult>> {
    return this.callMCP<FirecrawlScrapeResult>(
      "firecrawl_scrape",
      { url },
      () => this.scrapeFallback(url)
    );
  }

  /**
   * 降级: 通过 HTTP API 搜索
   */
  private async searchFallback(
    query: string,
    options: { limit?: number; timeout?: number }
  ): Promise<FirecrawlSearchResult[]> {
    if (!this.config.apiKey) {
      throw new Error("Firecrawl API key not configured");
    }

    const response = await httpPost<FirecrawlSearchResponse>(
      `${this.config.apiUrl}${this.SEARCH_ENDPOINT}`,
      {
        query,
        limit: options.limit || 10
      },
      {
        Authorization: `Bearer ${this.config.apiKey}`
      }
    );

    if (!response.success) {
      throw new Error(response.error || "Firecrawl search failed");
    }

    return response.data || [];
  }

  /**
   * 降级: 通过 HTTP API 抓取
   */
  private async scrapeFallback(url: string): Promise<FirecrawlScrapeResult> {
    if (!this.config.apiKey) {
      throw new Error("Firecrawl API key not configured");
    }

    const response = await httpPost<FirecrawlScrapeResponse>(
      `${this.config.apiUrl}${this.SCRAPE_ENDPOINT}`,
      {
        url,
        formats: ["markdown", "html"]
      },
      {
        Authorization: `Bearer ${this.config.apiKey}`
      }
    );

    if (!response.success) {
      throw new Error(response.error || "Firecrawl scrape failed");
    }

    if (!response.data) {
      throw new Error("No data returned from Firecrawl");
    }

    return response.data;
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
 * 创建默认的 Firecrawl 适配器实例
 */
export function createFirecrawlAdapter(): FirecrawlAdapter {
  return new FirecrawlAdapter({
    apiKey: process.env.FIRECRAWL_API_KEY
  });
}
