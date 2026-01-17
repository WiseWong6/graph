/**
 * mcp-webresearch 适配器
 *
 * 职责: 使用 Playwright 进行 Google 搜索
 *
 * 优先级: 1 (第一优先级)
 *
 * 依赖:
 * - playwright (需要安装)
 *
 * 安装: npm install playwright
 * 初始化: npx playwright install chromium
 */

import { MCPAdapter, MCPResult } from "./mcp.js";

/**
 * 搜索结果接口
 */
export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

/**
 * mcp-webresearch 适配器
 *
 * 使用 Playwright 驱动 Chromium 进行 Google 搜索
 */
export class WebResearchAdapter extends MCPAdapter {
  private browser: any = null;

  /**
   * 执行 Google 搜索
   *
   * @param query - 搜索查询
   * @param limit - 结果数量限制
   * @returns 搜索结果
   */
  async search(query: string, limit: number = 10): Promise<MCPResult<SearchResult[]>> {
    console.log(`[WebResearch] 开始 Google 搜索: "${query}"`);

    return this.callMCP<SearchResult[]>(
      "google_search",
      { query, limit },
      () => this.searchViaPlaywright(query, limit)
    );
  }

  /**
   * 使用 Playwright 进行 Google 搜索 (HTTP 降级)
   */
  private async searchViaPlaywright(
    query: string,
    limit: number
  ): Promise<SearchResult[]> {
    const startTime = Date.now();

    try {
      // 动态导入 playwright (减少启动时依赖)
      const { chromium } = await import("playwright");

      console.log("[WebResearch] 启动 Chromium...");
      this.browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      const context = await this.browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 }
      });

      const page = await context.newPage();

      // Google 搜索 URL (使用更简单的参数)
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
      console.log(`[WebResearch] 访问: ${searchUrl}`);

      await page.goto(searchUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      // 等待页面加载
      await page.waitForTimeout(2000);

      // 提取搜索结果 - 使用多种选择器作为备选
      const results = await page.evaluate(() => {
        const items: Array<{ title: string; url: string; snippet: string }> = [];

        // 尝试多种选择器
        const selectors = [
          "div.g",              // 标准
          "div.tF2Cxc",         // 新版
          "div.hlcw0c",         // 另一种新版
          "div[data-hveid]"     // 带属性的
        ];

        // @ts-ignore - Running in browser context
        const doc: any = (window as any).document;

        for (const selector of selectors) {
          const elements = doc.querySelectorAll(selector);
          if (elements.length > 0) {
            elements.forEach((result: any) => {
              const titleEl = result.querySelector("h3") || result.querySelector("h2");
              const linkEl = result.querySelector("a");
              const snippetEl = result.querySelector(".VwiC3b") ||
                               result.querySelector(".st") ||
                               result.querySelector(".s") ||
                               result.querySelector(".ITZIwc");

              if (titleEl && linkEl) {
                const title = titleEl.textContent?.trim() || "";
                const url = linkEl.getAttribute("href") || "";
                const snippet = snippetEl?.textContent?.trim() || "";

                if (title && url && !url.startsWith("#") && !url.startsWith("/search")) {
                  items.push({ title, url, snippet });
                }
              }
            });

            if (items.length > 0) {
              console.log(`Found ${items.length} results with selector: ${selector}`);
              break; // 找到结果就停止尝试其他选择器
            }
          }
        }

        return items;
      });

      // 清理
      await context.close();
      await this.browser.close();
      this.browser = null;

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`[WebResearch] 搜索完成: ${results.length} 个结果 (${duration}s)`);

      if (results.length === 0) {
        console.warn("[WebResearch] 没有找到结果，可能被 Google 拦截或页面结构变化");
      }

      return results.slice(0, limit);
    } catch (error) {
      // 确保浏览器关闭
      if (this.browser) {
        try {
          await this.browser.close();
        } catch {}
        this.browser = null;
      }

      const errorMsg = this.errorMessage(error);
      console.error(`[WebResearch] 搜索失败: ${errorMsg}`);

      throw new Error(`Playwright search failed: ${errorMsg}`);
    }
  }

  /**
   * 提取页面内容
   *
   * @param url - 页面 URL
   * @returns 页面 Markdown 内容
   */
  async fetchPage(url: string): Promise<MCPResult<string>> {
    console.log(`[WebResearch] 抓取页面: ${url}`);

    return this.callMCP<string>(
      "fetch_page",
      { url },
      () => this.fetchPageViaPlaywright(url)
    );
  }

  /**
   * 使用 Playwright 抓取页面内容
   */
  private async fetchPageViaPlaywright(url: string): Promise<string> {
    try {
      const { chromium } = await import("playwright");

      const browser = await chromium.launch({ headless: true });
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

      // 提取页面文本内容
      const content = await page.evaluate(() => {
        // @ts-ignore - Running in browser context
        const doc: any = (window as any).document;
        // 移除脚本和样式
        doc.querySelectorAll('script, style, nav, footer').forEach((el: any) => el.remove());

        return doc.body?.innerText || "";
      });

      await context.close();
      await browser.close();

      return content;
    } catch (error) {
      throw new Error(`Failed to fetch page: ${this.errorMessage(error)}`);
    }
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<MCPResult<{ available: boolean; mode: "mcp" | "http"; playwright?: boolean }>> {
    const baseCheck = await super.healthCheck();

    try {
      // 检查 playwright 是否可用
      await import("playwright");
      return {
        success: true,
        data: {
          ...baseCheck.data!,
          playwright: true
        }
      };
    } catch {
      return {
        success: true,
        data: {
          ...baseCheck.data!,
          playwright: false
        }
      };
    }
  }
}

/**
 * 创建默认实例
 */
export function createWebResearchAdapter(): WebResearchAdapter {
  return new WebResearchAdapter();
}
