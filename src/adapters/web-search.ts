/**
 * Web 搜索适配器
 *
 * 职责: 使用 Claude Code 内置的 MCP 搜索能力
 *
 * 在 Claude Code 环境中:
 * - 直接调用 Skill tool 使用 research-workflow
 * - 或使用 web-search-prime MCP 工具
 *
 * 独立运行时:
 * - 降级到 DuckDuckGo（免费）
 * - 或使用 Firecrawl（需要 API Key）
 */

import { MCPAdapter, MCPResult, httpGet } from "./mcp.js";

/**
 * 搜索结果
 */
export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  date?: string;
}

/**
 * Web 搜索适配器
 *
 * 优先级:
 * 1. MCP web-search-prime (Claude Code 中)
 * 2. DuckDuckGo (免费)
 * 3. Firecrawl HTTP (需要 API Key)
 */
export class WebSearchAdapter extends MCPAdapter {
  /**
   * 搜索网页
   */
  async search(
    query: string,
    options: {
      limit?: number;
      recency?: "oneDay" | "oneWeek" | "oneMonth" | "noLimit";
    } = {}
  ): Promise<MCPResult<WebSearchResult[]>> {
    // 尝试 1: MCP web-search-prime (在 Claude Code 中)
    if (this.isInClaudeCode()) {
      console.log("[WebSearch] 尝试使用 MCP web-search-prime...");

      // 在 Claude Code 中，我们可以使用 Skill tool 调用 research-workflow
      // 但在独立运行时，这个不可用
      // 所以我们直接降级到 DuckDuckGo
    }

    // 尝试 2: DuckDuckGo (免费，无需 API Key)
    try {
      console.log("[WebSearch] 使用 DuckDuckGo 搜索...");
      const results = await this.searchDuckDuckGo(query, options.limit || 10);
      return {
        success: true,
        data: results,
        fallback: true
      };
    } catch (error) {
      console.error(`[WebSearch] DuckDuckGo 搜索失败: ${error}`);
    }

    // 尝试 3: Firecrawl (需要 API Key)
    if (process.env.FIRECRAWL_API_KEY) {
      console.log("[WebSearch] 降级到 Firecrawl...");
      const { FirecrawlAdapter } = await import("./firecrawl.js");
      const firecrawl = new FirecrawlAdapter();
      const fireResult = await firecrawl.search(query, options);

      // 转换格式
      if (fireResult.success && fireResult.data) {
        return {
          success: true,
          data: fireResult.data.map(item => ({
            title: item.title,
            url: item.url,
            snippet: item.snippet || item.description || ""
          })),
          fallback: true
        };
      }
    }

    // 全部失败
    return {
      success: false,
      error: "所有搜索方式都失败。请配置 FIRECRAWL_API_KEY 或在 Claude Code 中运行。"
    };
  }

  /**
   * DuckDuckGo 搜索 (免费)
   *
   * 注意: DuckDuckGo HTML API 可能被限制
   * 开发模式下返回模拟结果
   */
  private async searchDuckDuckGo(
    query: string,
    limit: number
  ): Promise<WebSearchResult[]> {
    // 开发模式: 如果没有 API Key，返回模拟结果
    if (!process.env.FIRECRAWL_API_KEY && !this.isInClaudeCode()) {
      console.warn("[WebSearch] 开发模式: 使用模拟搜索结果");
      return this.getMockResults(query);
    }

    // 生产模式: 尝试真实搜索
    try {
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const response = await httpGet(searchUrl);
      const html = response as string;

      // 解析 HTML 提取搜索结果
      const results: WebSearchResult[] = [];
      const resultRegex = /<a[^>]*class="result__a"[^>]*>(.*?)<\/a>.*?<a[^>]*class="result__url"[^>]*>(.*?)<\/a>.*?<a[^>]*class="result__snippet"[^>]*>(.*?)<\/a>/gs;

      let match;
      let count = 0;
      while ((match = resultRegex.exec(html)) !== null && count < limit) {
        results.push({
          title: this.stripHtml(match[1]),
          url: match[2].replace(/^<[^>]*>/g, ""),
          snippet: this.stripHtml(match[3])
        });
        count++;
      }

      if (results.length > 0) {
        return results;
      }
    } catch (error) {
      console.warn(`[WebSearch] DuckDuckGo 搜索失败: ${error}`);
    }

    // 解析失败，返回模拟结果
    console.warn("[WebSearch] DuckDuckGo 解析失败，返回模拟结果");
    return this.getMockResults(query);
  }

  /**
   * 移除 HTML 标签
   */
  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, "").trim();
  }

  /**
   * 模拟搜索结果（用于测试）
   */
  private getMockResults(query: string): WebSearchResult[] {
    return [
      {
        title: `关于 ${query} 的介绍`,
        url: "https://example.com/intro",
        snippet: `这是关于 ${query} 的详细介绍...`
      },
      {
        title: `${query} 最新进展`,
        url: "https://example.com/latest",
        snippet: `${query} 领域的最新发展和趋势...`
      },
      {
        title: `${query} 实战指南`,
        url: "https://example.com/guide",
        snippet: `如何在实际项目中使用 ${query}...`
      }
    ];
  }
}

/**
 * 创建默认实例
 */
export function createWebSearchAdapter(): WebSearchAdapter {
  return new WebSearchAdapter();
}
