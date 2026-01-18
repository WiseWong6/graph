/**
 * Tavily Search API 适配器
 *
 * 专为 AI Agent 设计的搜索 API
 * 免费额度: 每月 1000 次查询
 * 文档: https://tavily.com
 */

import { MCPAdapter, MCPResult } from "./mcp.js";

interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

interface TavilyResponse {
  answer?: string;
  query: string;
  results: Array<{
    title: string;
    url: string;
    content: string;
    score?: number;
  }>;
}

export class TavilyAdapter extends MCPAdapter {
  private apiKey: string;
  private readonly API_URL = "https://api.tavily.com/search";

  constructor() {
    super();
    this.apiKey = process.env.TAVILY_API_KEY || "";
  }

  async search(
    query: string,
    options: { limit?: number } = {}
  ): Promise<MCPResult<TavilySearchResult[]>> {
    if (!this.apiKey) {
      return {
        success: false,
        error: "TAVILY_API_KEY not configured"
      };
    }

    try {
      const response = await fetch(this.API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          query,
          max_results: options.limit || 10,
          search_depth: "basic",
          include_answer: false,
          include_raw_content: false
        })
      });

      if (!response.ok) {
        throw new Error(`Tavily API error: ${response.status} ${response.statusText}`);
      }

      const data: TavilyResponse = await response.json() as TavilyResponse;

      if (!data.results || !Array.isArray(data.results)) {
        return { success: false, error: "No results from Tavily" };
      }

      return {
        success: true,
        data: data.results.map(r => ({
          title: r.title,
          url: r.url,
          content: r.content,
          score: r.score || 0
        }))
      };
    } catch (error) {
      console.warn(`[Tavily] Search failed:`, error);
      return {
        success: false,
        error: String(error)
      };
    }
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<MCPResult<{ available: boolean; mode: "mcp" | "http" }>> {
    if (!this.apiKey) {
      return {
        success: false,
        error: "TAVILY_API_KEY not configured"
      };
    }

    try {
      const result = await this.search("test", { limit: 1 });
      return {
        success: true,
        data: { available: result.success, mode: "http" as const }
      };
    } catch {
      return {
        success: true,
        data: { available: false, mode: "http" as const }
      };
    }
  }
}

/**
 * 创建默认实例
 */
export function createTavilyAdapter(): TavilyAdapter {
  return new TavilyAdapter();
}
