/**
 * RAG 相关类型定义
 */

/**
 * 检索结果项
 */
export interface RetrievedNode {
  content: string;
  metadata: Record<string, any>;
  score?: number;
}

/**
 * 金句检索结果
 */
export interface QuoteNode extends RetrievedNode {
  metadata: {
    id?: string;
    author?: string;
    quote_type?: string;
    quality_score?: number;
    source_title?: string;
    url?: string;
    category?: string;
  };
}

/**
 * 文章检索结果
 */
export interface ArticleNode extends RetrievedNode {
  metadata: {
    title?: string;
    author?: string;
    publish_time?: string;
    url?: string;
  };
}

/**
 * 标题检索结果
 */
export interface TitleNode {
  title: string;
  source: string;
  score?: number;
}

/**
 * 检索选项
 */
export interface RetrieveOptions {
  topK?: number;
  minScore?: number;
  filters?: Record<string, any>;
}

/**
 * 索引配置
 */
export interface IndexConfig {
  indicesDir: string;
  dataDir: string;
  embedModel?: string;
}

/**
 * RAG 内容格式
 */
export interface RAGContent {
  topic: string;
  quotes: QuoteNode[];
  articles: ArticleNode[];
  titles?: TitleNode[];
  stats: {
    quotesCount: number;
    articlesCount: number;
    titlesCount?: number;
    retrievalTime: number;
  };
}
