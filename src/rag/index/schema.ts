/**
 * RAG 相关类型定义
 */

/**
 * 写作组件类型
 */
export enum ComponentType {
  // Content 组件
  CONCEPT = "concept",
  FRAMEWORK = "framework",
  METHOD = "method",
  CASE = "case",
  DATA = "data",
  CHECKLIST = "checklist",
  COUNTERPOINT = "counterpoint",
  // Voice 组件
  HOOK_OPENING = "hook_opening",
  TURNING_POINT = "turning_point",
  METAPHOR = "metaphor",
  CLOSING = "closing",
  SENTENCE_PATTERN = "sentence_pattern"
}

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
 * 个人写作库检索结果
 */
export interface PersonalChunkNode {
  text: string;
  metadata: {
    article_id: string;
    article_title: string;
    section_path?: string;
    component_type: ComponentType;
    pillar?: string;
    tags?: string[];
    date?: string;
    channel?: string;
  };
  score?: number;
}

/**
 * 个人写作库检索选项
 */
export interface RetrievePersonalOptions {
  topKContent?: number;
  topKVoice?: number;
  minScore?: number;
  maxLength?: number;
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
