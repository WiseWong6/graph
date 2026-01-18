"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArticleAnnotation = void 0;
var langgraph_1 = require("@langchain/langgraph");
/**
 * Article Agent State Definition v2
 *
 * 完整流程数据流:
 * prompt → research → rag → titles → (select_title) → draft → polish → rewrite → humanize
 * → (confirm_images) → prompts → images → upload → html → draftbox
 *
 * 设计原则:
 * - 每个字段由单一节点拥有/修改
 * - 并行节点使用不同字段避免冲突
 * - 交互节点只修改 decisions 字段
 * - 最小状态,无冗余
 */
exports.ArticleAnnotation = langgraph_1.Annotation.Root({
    // ========== 输入 ==========
    prompt: (langgraph_1.Annotation), // 用户输入的提示/主题
    topic: (langgraph_1.Annotation), // 提取的主题
    // ========== LLM 节点输出 ==========
    researchResult: (langgraph_1.Annotation), // 01_research 调研结果
    ragContent: (langgraph_1.Annotation), // 02_rag 向量检索内容
    titles: (langgraph_1.Annotation), // 03_titles 生成的标题选项
    draft: (langgraph_1.Annotation), // 05_draft 初稿内容
    polished: (langgraph_1.Annotation), // 06_polish 润色后内容
    rewritten: (langgraph_1.Annotation), // 07_rewrite 智性叙事重写内容
    humanized: (langgraph_1.Annotation), // 08_humanize 人化后内容
    imagePrompts: (langgraph_1.Annotation), // 10_prompts 图片提示词列表
    // ========== 代码节点输出 ==========
    imagePaths: (langgraph_1.Annotation), // 11_images 生成的本地图片路径
    uploadedImageUrls: (langgraph_1.Annotation), // 11.5_upload 上传后的 URL
    htmlPath: (langgraph_1.Annotation), // 12_html 生成的 HTML 文件路径
    // ========== 决策状态（交互节点） ==========
    decisions: (langgraph_1.Annotation), // 所有用户交互的决策
    // ========== 元数据 ==========
    outputPath: (langgraph_1.Annotation), // 输出目录路径
    status: (langgraph_1.Annotation), // 状态跟踪
    runId: (langgraph_1.Annotation), // 运行 ID（时间戳）
    // ========== 兼容性（MVP 阶段） ==========
    generatedText: (langgraph_1.Annotation), // 节点 1 的输出（向后兼容）
    generatedText2: (langgraph_1.Annotation), // 节点 2 的输出（向后兼容）
    generatedText3: (langgraph_1.Annotation), // 节点 3 的输出（向后兼容）
});
