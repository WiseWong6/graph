import { Annotation } from "@langchain/langgraph";

/**
 * 图片风格类型
 *
 * 参考 image-prompter 技能的五种风格
 */
export type ImageStyle =
  | "infographic"  // 扁平化科普图
  | "healing"      // 治愈系插画
  | "pixar"        // 粗线条插画
  | "sokamono"     // 描边插画
  | "handdrawn";   // 方格纸手绘

/**
 * 图片配置类型
 *
 * 用于 Gate B (confirm_images) 交互节点
 */
export interface ImageConfig {
  confirmed: boolean;
  count: number;
  style: ImageStyle;       // 五种风格之一
  model: string;           // "doubao-seedream-4-5-251128"
  resolution: string;      // "2k"
}

/**
 * 公众号配置类型
 *
 * 用于 Gate A (select_wechat) 交互节点
 */
export interface WechatConfig {
  account: string;      // 账号 ID (如 "account1", "account2")
  name: string;         // 公众号名称 (如 "人类是我的副业")
  appId: string;        // 微信 AppID
  appSecret: string;    // 微信 AppSecret
}

/**
 * 决策状态类型
 *
 * 存储所有交互节点的用户决策
 */
export interface Decisions {
  wechat?: WechatConfig;
  images?: ImageConfig;
  selectedTitle?: string;
  customTitleNote?: string;     // 自定义标题的备注（可选）
  regenerateTitles?: boolean;   // 是否重新生成标题
  timings?: Record<string, number>; // 交互节点等待耗时（毫秒）
}

/**
 * Article Agent State Definition v2
 *
 * 完整流程数据流:
 * prompt → research → rag → titles → (select_title) → draft → rewrite → humanize
 * → (confirm_images) → prompts → images → upload → html → draftbox
 *
 * 设计原则:
 * - 每个字段由单一节点拥有/修改
 * - 并行节点使用不同字段避免冲突
 * - 交互节点只修改 decisions 字段
 * - 最小状态,无冗余
 */
export const ArticleAnnotation = Annotation.Root({
  // ========== 输入 ==========
  prompt: Annotation<string>,           // 用户输入的提示/主题
  topic: Annotation<string>,            // 提取的主题

  // ========== LLM 节点输出 ==========
  researchResult: Annotation<string>,          // 01_research 调研结果
  ragContent: Annotation<string>,              // 02_rag 向量检索内容
  titles: Annotation<string[]>,                // 03_titles 生成的标题选项
  draft: Annotation<string>,                   // 05_draft 初稿内容
  rewritten: Annotation<string>,               // 06_rewrite 智性叙事重写内容
  humanized: Annotation<string>,               // 08_humanize 人化后内容
  imagePrompts: Annotation<string[]>,          // 09_prompts 图片提示词列表

  // ========== 代码节点输出 ==========
  imagePaths: Annotation<string[]>,            // 11_images 生成的本地图片路径
  uploadedImageUrls: Annotation<string[]>,     // 11.5_upload 上传后的 URL（默认空数组）
  htmlPath: Annotation<string>,                // 12_html 生成的 HTML 文件路径

  // ========== 决策状态（交互节点） ==========
  decisions: Annotation<Decisions>,            // 所有用户交互的决策

  // ========== 元数据 ==========
  outputPath: Annotation<string>,              // 输出目录路径
  status: Annotation<string>,                  // 状态跟踪
  runId: Annotation<string>,                   // 运行 ID（时间戳）

  // ========== 兼容性（MVP 阶段） ==========
  generatedText: Annotation<string>,           // 节点 1 的输出（向后兼容）
  generatedText2: Annotation<string>,          // 节点 2 的输出（向后兼容）
  generatedText3: Annotation<string>,          // 节点 3 的输出（向后兼容）
});

export type ArticleState = typeof ArticleAnnotation.State;
