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

// 内置轻量级中文词典（与 rag-formatter.ts 保持一致）
const CHINESE_DICT = new Set([
  // 技术术语
  "人工智能", "机器学习", "深度学习", "算法", "数据结构", "编程", "代码", "架构", "设计", "模式",
  "框架", "库", "接口", "API", "前端", "后端", "数据库", "服务器", "客户端", "浏览器",
  "操作系统", "内核", "驱动", "网络", "协议", "安全", "加密", "解密", "性能", "优化",
  "调试", "测试", "部署", "发布", "版本", "迭代", "重构", "模块", "组件", "函数",
  "变量", "参数", "返回值", "异常", "错误", "日志", "配置", "依赖", "构建", "编译",

  // 通用词汇
  "分析", "研究", "设计", "开发", "实现", "测试", "部署", "运维", "监控", "优化",
  "文档", "说明", "注释", "示例", "教程", "指南", "参考", "手册", "规范", "标准",
  "问题", "解决", "方案", "方法", "策略", "技巧", "经验", "实践", "原则", "理念",
  "思考", "理解", "掌握", "学习", "进步", "成长", "创新", "突破", "挑战", "机遇",

  // 内容创作
  "标题", "摘要", "正文", "结尾", "段落", "章节", "目录", "索引", "标签", "分类",
  "作者", "来源", "发布", "更新", "编辑", "审核", "推荐", "热门", "最新", "相关",
  "搜索", "检索", "查询", "匹配", "过滤", "排序", "分页", "导航", "菜单", "按钮",

  // 三字词
  "程序员", "开发者", "工程师", "设计师", "产品经理", "项目经理", "架构师", "技术总监",
  "开源", "闭源", "源码", "代码库", "版本库", "分支", "合并", "冲突", "提交", "推送",

  // 双字词
  "技术", "系统", "软件", "硬件", "网络", "数据", "信息", "知识", "经验", "能力",
  "工具", "平台", "服务", "应用", "程序", "脚本", "命令", "参数", "选项", "配置",
  "项目", "任务", "计划", "目标", "结果", "效果", "影响", "作用", "意义", "价值",

  // 常见通用词
  "官方", "社区", "用户", "客户", "产品", "功能", "特性", "需求", "场景", "流程",
  "规则", "标准", "规范", "指南", "教程", "文档", "说明", "介绍", "概述", "背景",
  "历史", "未来", "趋势", "发展", "变化", "更新", "升级", "改进", "提升", "优化",
  "问题", "错误", "缺陷", "故障", "异常", "风险", "挑战", "困难", "障碍", "限制",
  "原因", "因素", "条件", "要求", "标准", "原则", "方法", "方式", "手段", "途径",
  "步骤", "过程", "阶段", "环节", "流程", "周期", "时间", "周期", "速度", "效率",
  "质量", "数量", "规模", "范围", "程度", "水平", "等级", "级别", "层次", "维度",
  "关系", "联系", "关联", "影响", "作用", "效果", "结果", "成果", "收益", "价值",
  "成本", "费用", "价格", "预算", "投资", "回报", "收益", "利润", "效益", "效果",
  "团队", "组织", "公司", "企业", "机构", "部门", "小组", "成员", "人员", "角色",
  "职责", "责任", "权限", "权利", "义务", "要求", "期望", "目标", "指标", "标准",
  "策略", "计划", "方案", "规划", "设计", "开发", "实施", "部署", "运维", "监控"
]);

// 最大匹配分词（Forward Maximum Matching）
function maximumMatch(text: string, maxWordLength: number = 4): string[] {
  const words: string[] = [];
  let i = 0;

  while (i < text.length) {
    let matched = false;

    // 从最长到最短尝试匹配
    for (let len = Math.min(maxWordLength, text.length - i); len >= 2; len--) {
      const word = text.slice(i, i + len);
      if (CHINESE_DICT.has(word)) {
        words.push(word);
        i += len;
        matched = true;
        break;
      }
    }

    // 未匹配，跳过单字
    if (!matched) {
      i++;
    }
  }

  return words;
}

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
      modelType: resolve(process.cwd(), "local_models"),
      modelOptions: {
        dtype: "fp32"
      }
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
    // 使用最大匹配分词算法
    return maximumMatch(text);
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
