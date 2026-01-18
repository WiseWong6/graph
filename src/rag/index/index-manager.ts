/**
 * 索引管理器（单例模式）
 *
 * 职责：
 * 1. 加载/创建索引
 * 2. 提供统一的检索接口
 * 3. 持久化索引到本地
 */

import { VectorStoreIndex, storageContextFromDefaults, MetadataMode, Settings } from "llamaindex";
import { HuggingFaceEmbedding } from "@llamaindex/huggingface";
import { LanceDBVectorStore } from "../vector-store/lancedb.js";
import { join, resolve } from "path";
import { existsSync } from "fs";
import type { RetrieveOptions, QuoteNode, ArticleNode, TitleNode } from "./schema.js";

class IndexManager {
  private static instance: IndexManager;
  private quotesIndex: VectorStoreIndex | null = null;
  private articlesIndex: VectorStoreIndex | null = null;
  private titlesData: TitleNode[] = [];
  private indicesDir: string;
  private dataDir: string;
  private indicesLoaded: boolean = false;  // 防止重复加载
  private loadPromise: Promise<void> | null = null;  // 防止并发加载

  private constructor() {
    // 默认路径
    this.indicesDir = join(process.cwd(), ".index");
    this.dataDir = join(process.cwd(), "data");

    // 设置嵌入模型（与 build-indices.ts 保持一致）
    // 使用本地 HuggingFace 模型进行嵌入
    Settings.embedModel = new HuggingFaceEmbedding({
      modelType: resolve(process.cwd(), "local_models")
    });
  }

  static getInstance(): IndexManager {
    if (!IndexManager.instance) {
      IndexManager.instance = new IndexManager();
    }
    return IndexManager.instance;
  }

  /**
   * 设置路径
   */
  setPaths(indicesDir: string, dataDir: string): void {
    this.indicesDir = indicesDir;
    this.dataDir = dataDir;
  }

  /**
   * 加载所有索引
   *
   * 幂等性保证：
   * - 已加载时直接返回
   * - 正在加载时等待同一 Promise
   * - 防止并发节点重复加载
   */
  async loadIndices(): Promise<void> {
    // 如果已加载，直接返回
    if (this.indicesLoaded) {
      return;
    }

    // 如果正在加载，等待同一个 Promise
    if (this.loadPromise) {
      return this.loadPromise;
    }

    // 开始加载
    this.loadPromise = (async () => {
      console.log("[IndexManager] 开始加载索引...");

      // 加载金句库索引
      await this.loadQuotesIndex();

      // 加载文章库索引
      await this.loadArticlesIndex();

      // 加载标题库数据（BM25 不需要向量索引）
      await this.loadTitlesData();

      this.indicesLoaded = true;
      this.loadPromise = null;

      console.log("[IndexManager] ✅ 所有索引加载完成");
    })();

    return this.loadPromise;
  }

  /**
   * 加载金句库索引
   */
  private async loadQuotesIndex(): Promise<void> {
    const indexDir = join(this.indicesDir, "golden_quotes");
    const lanceDbUri = join(indexDir, "lancedb");

    if (!existsSync(indexDir)) {
      console.warn(`[IndexManager] ⚠️ 金句库索引不存在: ${indexDir}`);
      console.warn(`[IndexManager] 请先运行: npm run build-indices`);
      return;
    }

    try {
      // 检查是否已迁移到 LanceDB
      const useLanceDB = existsSync(lanceDbUri);
      
      let storageContext;
      
      if (useLanceDB) {
        console.log("[IndexManager] 检测到 LanceDB (金句库)，正在加载...");
        const vectorStore = new LanceDBVectorStore({
          uri: lanceDbUri,
          tableName: "quotes"
        });
        await vectorStore.init();
        
        storageContext = await storageContextFromDefaults({
          persistDir: indexDir,
          vectorStore: vectorStore
        });
      } else {
        storageContext = await storageContextFromDefaults({
          persistDir: indexDir
        });
      }

      this.quotesIndex = await VectorStoreIndex.init({
        storageContext
      });
      console.log(`[IndexManager] ✅ 金句库索引加载成功 (${useLanceDB ? "LanceDB" : "SimpleVectorStore"})`);
    } catch (error) {
      console.error(`[IndexManager] ❌ 金句库索引加载失败: ${error}`);
    }
  }

  /**
   * 加载文章库索引
   */
  private async loadArticlesIndex(): Promise<void> {
    const indexDir = join(this.indicesDir, "articles");
    const lanceDbUri = join(indexDir, "lancedb");

    if (!existsSync(indexDir)) {
      console.warn(`[IndexManager] ⚠️ 文章库索引不存在: ${indexDir}`);
      console.warn(`[IndexManager] 请先运行: npm run build-indices`);
      return;
    }

    try {
      // 检查是否已迁移到 LanceDB
      const useLanceDB = existsSync(lanceDbUri);
      
      let storageContext;
      
      if (useLanceDB) {
        console.log("[IndexManager] 检测到 LanceDB，正在加载...");
        const vectorStore = new LanceDBVectorStore({
          uri: lanceDbUri,
          tableName: "articles"
        });
        await vectorStore.init();
        
        storageContext = await storageContextFromDefaults({
          persistDir: indexDir,
          vectorStore: vectorStore
        });
      } else {
        storageContext = await storageContextFromDefaults({
          persistDir: indexDir
        });
      }

      this.articlesIndex = await VectorStoreIndex.init({
        storageContext
      });
      console.log(`[IndexManager] ✅ 文章库索引加载成功 (${useLanceDB ? "LanceDB" : "SimpleVectorStore"})`);
    } catch (error) {
      console.error(`[IndexManager] ❌ 文章库索引加载失败: ${error}`);
    }
  }

  /**
   * 加载标题库数据（简单 JSONL，用于关键词匹配）
   */
  private async loadTitlesData(): Promise<void> {
    const titlesFile = join(this.dataDir, "article_titles.jsonl");

    if (!existsSync(titlesFile)) {
      console.warn(`[IndexManager] ⚠️ 标题库文件不存在: ${titlesFile}`);
      return;
    }

    try {
      const { readFileSync } = await import("fs");
      const content = readFileSync(titlesFile, "utf-8");
      const lines = content.split("\n").filter(line => line.trim());

      this.titlesData = lines.map(line => {
        const data = JSON.parse(line);
        return {
          title: data.title,
          source: data.source_file
        };
      });

      console.log(`[IndexManager] ✅ 标题库加载成功: ${this.titlesData.length} 个标题`);
    } catch (error) {
      console.error(`[IndexManager] ❌ 标题库加载失败: ${error}`);
    }
  }

  /**
   * 检索金句（向量检索）
   */
  async retrieveQuotes(query: string, options?: RetrieveOptions): Promise<QuoteNode[]> {
    if (!this.quotesIndex) {
      console.warn("[IndexManager] 金句库未加载，返回空结果");
      return [];
    }

    const topK = options?.topK || 5;
    const retriever = this.quotesIndex.asRetriever({ similarityTopK: topK });

    try {
      const results = await retriever.retrieve(query);
      console.log("[IndexManager] 调试: 第一个结果节点结构:", JSON.stringify(results[0]?.node, null, 2).substring(0, 500));

      return results.map(r => {
        // 尝试多种方式获取内容
        let content = "";
        if ((r.node as any).text) {
          content = (r.node as any).text;
        } else {
          const docContent = r.node.getContent(MetadataMode.NONE);
          content = typeof docContent === "string" ? docContent : String(docContent);
        }

        console.log("[IndexManager] 调试: 提取的内容长度:", content.length, "前50字符:", content.substring(0, 50));

        return {
          content,
          metadata: r.node.metadata as QuoteNode["metadata"],
          score: r.score
        };
      });
    } catch (error) {
      console.error(`[IndexManager] 金句检索失败: ${error}`);
      return [];
    }
  }

  /**
   * 检索文章（向量检索）
   */
  async retrieveArticles(query: string, options?: RetrieveOptions): Promise<ArticleNode[]> {
    if (!this.articlesIndex) {
      console.warn("[IndexManager] 文章库未加载，返回空结果");
      return [];
    }

    const topK = options?.topK || 3;
    const retriever = this.articlesIndex.asRetriever({ similarityTopK: topK });

    try {
      const results = await retriever.retrieve(query);
      return results.map(r => {
        // 尝试多种方式获取内容
        let content = "";
        if ((r.node as any).text) {
          content = (r.node as any).text;
        } else {
          const docContent = r.node.getContent(MetadataMode.NONE);
          content = typeof docContent === "string" ? docContent : String(docContent);
        }

        return {
          content,
          metadata: r.node.metadata as ArticleNode["metadata"],
          score: r.score
        };
      });
    } catch (error) {
      console.error(`[IndexManager] 文章检索失败: ${error}`);
      return [];
    }
  }

  /**
   * 检索标题（关键词匹配）
   */
  async retrieveTitles(query: string, options?: RetrieveOptions): Promise<TitleNode[]> {
    if (this.titlesData.length === 0) {
      console.warn("[IndexManager] 标题库未加载，返回空结果");
      return [];
    }

    const topK = options?.topK || 10;

    // 简单的关键词匹配
    const keywords = this.extractKeywords(query);
    const scored = this.titlesData.map(title => {
      let score = 0;
      for (const keyword of keywords) {
        if (title.title.includes(keyword)) {
          score += 1;
        }
      }
      return { ...title, score };
    }).filter(t => t.score > 0);

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }

  /**
   * 提取中文关键词
   */
  private extractKeywords(text: string): string[] {
    // 简单实现：提取 2-4 字的中文词汇
    const matches = text.match(/[\u4e00-\u9fa5]{2,4}/g) || [];
    return Array.from(new Set(matches));
  }

  /**
   * 检查索引是否已加载
   */
  isReady(): boolean {
    return this.quotesIndex !== null ||
           this.articlesIndex !== null ||
           this.titlesData.length > 0;
  }
}

export default IndexManager;
