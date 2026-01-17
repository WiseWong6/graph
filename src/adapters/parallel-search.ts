/**
 * 并行搜索管理器
 *
 * 职责: 协调多个搜索源，实现并行搜索和智能降级
 *
 * 优先级顺序:
 * 1. mcp-webresearch (Google 搜索，第一优先级)
 * 2. Firecrawl (付费搜索，第二优先级)
 *
 * 策略:
 * - 并行执行所有搜索
 * - 按优先级顺序合并结果
 * - 如果优先级高的结果不足，补充低优先级结果
 * - 去重基于 URL
 */

import { WebResearchAdapter } from "./mcp-webresearch.js";
import { FirecrawlAdapter } from "./firecrawl.js";

/**
 * 统一的搜索结果接口
 */
export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: "webresearch" | "firecrawl";
  score?: number;
}

/**
 * 搜索策略接口
 */
export interface SearchStrategy {
  name: "webresearch" | "firecrawl";
  priority: number;
  search: (query: string, limit: number) => Promise<SearchResult[]>;
}

/**
 * 并行搜索结果
 */
export interface ParallelSearchResult {
  results: SearchResult[];
  sources: string[];
  metadata: {
    total: number;
    bySource: Partial<Record<"webresearch" | "firecrawl", number>>;
    duration: number;
  };
}

/**
 * 并行搜索选项
 */
export interface ParallelSearchOptions {
  limit?: number;           // 每个搜索源的结果数量
  timeout?: number;         // 单个搜索源的超时时间 (ms)
  minResults?: number;      // 最少需要的结果数量
  enableFirecrawl?: boolean; // 是否启用 Firecrawl (需要 API Key)
}

/**
 * 并行搜索管理器
 */
export class ParallelSearchManager {
  private strategies: SearchStrategy[];

  constructor() {
    this.strategies = this.buildStrategies();
  }

  /**
   * 构建搜索策略
   */
  private buildStrategies(): SearchStrategy[] {
    const strategies: SearchStrategy[] = [
      {
        name: "webresearch",
        priority: 1,
        search: async (query, limit) => {
          const adapter = new WebResearchAdapter();
          const result = await adapter.search(query, limit);
          if (result.success && result.data) {
            return result.data.map(r => ({ ...r, source: "webresearch" as const }));
          }
          return [];
        }
      }
    ];

    // 仅在有 API Key 时启用 Firecrawl
    if (process.env.FIRECRAWL_API_KEY) {
      strategies.push({
        name: "firecrawl",
        priority: 2,
        search: async (query, limit) => {
          const adapter = new FirecrawlAdapter();
          const result = await adapter.search(query, { limit });
          if (result.success && result.data) {
            return result.data.map(r => ({
              title: r.title,
              url: r.url,
              snippet: r.description || r.snippet || "",
              source: "firecrawl" as const,
              score: r.score
            }));
          }
          return [];
        }
      });
    }

    return strategies.sort((a, b) => a.priority - b.priority);
  }

  /**
   * 并行搜索
   *
   * @param query - 搜索查询
   * @param options - 搜索选项
   * @returns 搜索结果
   */
  async parallelSearch(
    query: string,
    options: ParallelSearchOptions = {}
  ): Promise<ParallelSearchResult> {
    const {
      limit = 10,
      timeout = 8000,
      minResults = 3,
      enableFirecrawl = !!process.env.FIRECRAWL_API_KEY
    } = options;

    console.log(`[ParallelSearch] 开始并行搜索: "${query}"`);
    console.log(`[ParallelSearch] 配置: limit=${limit}, timeout=${timeout}ms, minResults=${minResults}`);
    console.log(`[ParallelSearch] 可用策略: ${this.strategies.map(s => s.name).join(", ")}`);

    const startTime = Date.now();

    // 并行执行所有搜索策略
    const promises = this.strategies
      .filter(s => s.name !== "firecrawl" || enableFirecrawl)
      .map(async (strategy) => {
        try {
          // 使用 Promise.race 实现超时控制
          const searchPromise = strategy.search(query, limit);
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout after ${timeout}ms`)), timeout)
          );

          const results = await Promise.race([searchPromise, timeoutPromise]);

          return {
            strategy: strategy.name,
            results,
            success: true
          };
        } catch (error) {
          console.warn(`[ParallelSearch] ${strategy.name} 搜索失败:`, this.errorMessage(error));
          return {
            strategy: strategy.name,
            results: [],
            success: false
          };
        }
      });

    const outcomes = await Promise.all(promises);

    // 合并结果 - 按优先级顺序
    const merged = this.mergeResults(outcomes, minResults, limit);

    const duration = Date.now() - startTime;

    console.log(`[ParallelSearch] 搜索完成: ${merged.results.length} 个结果 (${duration}ms)`);
    console.log(`[ParallelSearch] 数据源: ${merged.sources.join(", ")}`);

    return {
      results: merged.results,
      sources: merged.sources,
      metadata: {
        total: merged.results.length,
        bySource: merged.bySource,
        duration
      }
    };
  }

  /**
   * 合并搜索结果
   *
   * 按优先级顺序合并，当高优先级结果不足时，补充低优先级结果
   */
  private mergeResults(
    outcomes: Array<{
      strategy: string;
      results: SearchResult[];
      success: boolean;
    }>,
    minResults: number,
    limit: number
  ): {
    results: SearchResult[];
    sources: string[];
    bySource: Partial<Record<"webresearch" | "firecrawl", number>>;
  } {
    const allResults: SearchResult[] = [];
    const sources: string[] = [];
    const bySource: Partial<Record<"webresearch" | "firecrawl", number>> = {};

    // 按优先级顺序处理
    const priorityOrder = ["webresearch", "firecrawl"];

    for (const name of priorityOrder) {
      const outcome = outcomes.find(o => o.strategy === name);

      if (outcome?.success && outcome.results.length > 0) {
        // 只有当现有结果不足时，才添加低优先级结果
        if (allResults.length < minResults || name === "webresearch") {
          allResults.push(...outcome.results);
          sources.push(name);
          bySource[name as keyof typeof bySource] = outcome.results.length;
        } else {
          console.log(`[ParallelSearch] ${name} 结果已足够，跳过`);
          bySource[name as keyof typeof bySource] = 0;
        }
      }
    }

    // 去重 (基于 URL)
    const seen = new Set<string>();
    const deduplicated = allResults.filter(r => {
      if (seen.has(r.url)) return false;
      seen.add(r.url);
      return true;
    });

    return {
      results: deduplicated.slice(0, limit),
      sources,
      bySource
    };
  }

  /**
   * 提取错误信息
   */
  private errorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }

  /**
   * 健康检查
   *
   * 检查所有搜索策略的可用性
   */
  async healthCheck(): Promise<{
    webresearch: boolean;
    firecrawl: boolean;
  }> {
    const checks = await Promise.allSettled([
      new WebResearchAdapter().healthCheck(),
      process.env.FIRECRAWL_API_KEY
        ? new FirecrawlAdapter().healthCheck()
        : Promise.resolve({ success: true, data: { available: false, mode: "http" } })
    ]);

    return {
      webresearch: checks[0].status === "fulfilled" && checks[0].value.success,
      firecrawl: checks[1].status === "fulfilled" && !!checks[1].value.data?.available
    };
  }
}

/**
 * 创建默认实例
 */
export function createParallelSearchManager(): ParallelSearchManager {
  return new ParallelSearchManager();
}
