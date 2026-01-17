/**
 * Draft 节点 v2
 *
 * 职责: 基于选定的标题、调研结果和 RAG 内容撰写初稿
 *
 * 数据流:
 * title + researchResult (Brief) + ragContent → LLM 撰写 → draft (Markdown)
 *
 * 改进点:
 * - 解析 Brief 提取核心洞察、框架、推荐角度
 * - 解析 RAG 提取金句、参考文章
 * - 结构化 Prompt 指导 LLM 撰写
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { ArticleState } from "../state";
import { getNodeLLMConfig } from "../../../config/llm.js";
import { LLMClient } from "../../../utils/llm-client.js";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env") });

// ========== 类型定义 ==========

/**
 * 解析后的 Brief 数据
 */
interface ParsedBrief {
  keyInsights: string[];
  framework: string;
  recommendedAngle: {
    name: string;
    coreArgument: string;
    evidence: string[];
    differentiation: string;
  } | null;
  dataPoints: string[];
  topic: string;
}

/**
 * 解析后的 RAG 数据
 */
interface ParsedRAG {
  quotes: string[];          // 金句列表
  articleSnippets: string[]; // 文章片段
  referenceTitles: string[]; // 参考标题
  hasContent: boolean;
}

// ========== Draft 节点主函数 ==========

/**
 * Draft 节点主函数
 *
 * @param state - 当前状态
 * @returns 更新的状态
 */
export async function draftNode(state: ArticleState): Promise<Partial<ArticleState>> {
  console.log("[05_draft] Writing draft for title:", state.decisions?.selectedTitle || state.titles?.[0]);

  // ========== 获取标题 ==========
  const title = state.decisions?.selectedTitle || state.titles?.[0] || state.topic || "无标题";

  // ========== 解析 Brief 和 RAG ==========
  const brief = parseBrief(state.researchResult || "");
  const rag = parseRAG(state.ragContent || "");

  console.log("[05_draft] Parsed Brief:", {
    topic: brief.topic,
    insightsCount: brief.keyInsights.length,
    hasAngle: !!brief.recommendedAngle,
    dataPointsCount: brief.dataPoints.length
  });

  console.log("[05_draft] Parsed RAG:", {
    quotesCount: rag.quotes.length,
    articleSnippets: rag.articleSnippets.length,
    titlesCount: rag.referenceTitles.length
  });

  // ========== 构建 Prompt ==========
  const prompt = buildDraftPrompt(title, brief, rag);

  // ========== 调用 LLM ==========
  const llmConfig = getNodeLLMConfig("draft");
  const client = new LLMClient(llmConfig);

  console.log("[05_draft] Calling LLM with config:", llmConfig.model);

  try {
    const response = await client.call({
      prompt,
      systemMessage: DRAFT_SYSTEM_MESSAGE
    });

    console.log("[05_draft] Draft generated, length:", response.text.length);
    console.log("[05_draft] Usage:", response.usage);

    const draft = response.text;

    // ========== 保存草稿 ==========
    const outputPath = state.outputPath || getDefaultOutputPath();
    const draftsDir = join(outputPath, "drafts");

    if (!existsSync(draftsDir)) {
      mkdirSync(draftsDir, { recursive: true });
    }

    const draftPath = join(draftsDir, "05_draft.md");
    writeFileSync(draftPath, draft, "utf-8");
    console.log("[05_draft] Saved draft:", draftPath);

    return {
      draft,
      outputPath
    };
  } catch (error) {
    console.error(`[05_draft] Failed to generate draft: ${error}`);
    throw error;
  }
}

// ========== 解析器 ==========

/**
 * 解析 Brief Markdown 提取关键信息
 *
 * Brief 结构 (参考 brief-generator.ts):
 * - 核心洞察 (## 核心洞察)
 * - 关键概念框架 (## 关键概念框架)
 * - 数据引用清单 (## 数据引用清单)
 * - 推荐写作角度 (## 推荐写作角度)
 */
function parseBrief(brief: string): ParsedBrief {
  const result: ParsedBrief = {
    keyInsights: [],
    framework: "",
    recommendedAngle: null,
    dataPoints: [],
    topic: ""
  };

  // 提取主题
  const topicMatch = brief.match(/主题[：:]\s*(.+?)(?:\n|$)/i);
  if (topicMatch) {
    result.topic = topicMatch[1].trim();
  }

  // 提取核心洞察
  const insightsSection = extractSection(brief, "## 核心洞察", "##");
  if (insightsSection) {
    // 提取所有 ### 开头的子标题内容
    const insightMatches = insightsSection.split("###").filter(s => s.trim());
    result.keyInsights = insightMatches.map(s => {
      const lines = s.trim().split("\n");
      // 第一行是标题，后续是内容
      const title = lines[0].replace(/^\d+\.\s*/, "").trim();
      const content = lines.slice(1).join(" ").trim();
      return content || title;
    }).filter(Boolean);
  }

  // 提取概念框架
  const frameworkSection = extractSection(brief, "## 关键概念框架", "##");
  if (frameworkSection) {
    // 提取代码块内容
    const codeMatch = frameworkSection.match(/```([\s\S]*?)```/);
    if (codeMatch) {
      result.framework = codeMatch[1].trim();
    } else {
      // 没有代码块，取整个 section
      result.framework = frameworkSection
        .replace(/###\s*[^\n]*/g, "") // 移除子标题
        .trim();
    }
  }

  // 提取推荐角度
  const angleSection = extractSection(brief, "## 推荐写作角度", "##");
  if (angleSection) {
    const angleNameMatch = angleSection.match(/推荐[：:]\s*(.+?)(?:\n|$)/i);
    const coreArgMatch = angleSection.match(/核心论点[：:]\s*(.+?)(?:\n|$)/i);
    const evidenceMatch = angleSection.match(/论据支撑[：:]\s*(.+?)(?:\n|$)/i);
    const diffMatch = angleSection.match(/差异化价值[：:]\s*(.+?)(?:\n|$)/i);

    if (angleNameMatch || coreArgMatch) {
      result.recommendedAngle = {
        name: angleNameMatch ? angleNameMatch[1].trim() : "未命名角度",
        coreArgument: coreArgMatch ? coreArgMatch[1].trim() : "",
        evidence: evidenceMatch ? evidenceMatch[1].split(/[、,，]/).map(s => s.trim()).filter(Boolean) : [],
        differentiation: diffMatch ? diffMatch[1].trim() : ""
      };
    }
  }

  // 提取数据支撑
  const dataSection = extractSection(brief, "## 数据引用清单", "##");
  if (dataSection) {
    // 每行一个数据点
    result.dataPoints = dataSection
      .split("\n")
      .map(line => line.replace(/^\d+\.\s*/, "").trim())
      .filter(line => line.length > 10); // 过滤太短的行
  }

  return result;
}

/**
 * 解析 RAG Markdown 提取有用内容
 *
 * RAG 结构 (参考 rag-formatter.ts):
 * - 相关金句 (## 相关金句)
 * - 相关文章片段 (## 相关文章片段)
 * - 参考标题 (## 参考标题)
 */
function parseRAG(rag: string): ParsedRAG {
  const result: ParsedRAG = {
    quotes: [],
    articleSnippets: [],
    referenceTitles: [],
    hasContent: !rag.includes("索引未初始化")
  };

  if (!result.hasContent) {
    return result;
  }

  // 提取金句
  const quotesSection = extractSection(rag, "## 相关金句", "##");
  if (quotesSection) {
    // 提取 ### 开头的内容
    const quoteMatches = quotesSection.split("###").filter(s => s.trim());
    result.quotes = quoteMatches
      .map(s => {
        const lines = s.trim().split("\n");
        // 第一行通常是序号，取实际内容
        const content = lines.slice(1).join(" ").trim();
        return content;
      })
      .filter(q => q.length > 5)
      .slice(0, 3); // 最多取 3 条金句
  }

  // 提取文章片段
  const articlesSection = extractSection(rag, "## 相关文章片段", "##");
  if (articlesSection) {
    // 提取 ### 开头的内容
    const articleMatches = articlesSection.split("###").filter(s => s.trim());
    result.articleSnippets = articleMatches
      .map(s => {
        const lines = s.trim().split("\n");
        // 第一行是标题，后续是内容
        return lines.slice(1).join("\n").trim();
      })
      .filter(s => s.length > 20)
      .slice(0, 2); // 最多取 2 个片段
  }

  // 提取参考标题
  const titlesSection = extractSection(rag, "## 参考标题", "##");
  if (titlesSection) {
    result.referenceTitles = titlesSection
      .split("\n")
      .map(line => line.replace(/^\d+\.\s*/, "").trim())
      .filter(line => line.length > 2)
      .slice(0, 5); // 最多取 5 个标题
  }

  return result;
}

/**
 * 提取 Markdown 指定 section 的内容
 */
function extractSection(markdown: string, startMarker: string, endMarker: string): string | null {
  const startIndex = markdown.indexOf(startMarker);
  if (startIndex === -1) return null;

  const startContent = startIndex + startMarker.length;
  const endIndex = markdown.indexOf(endMarker, startContent);

  if (endIndex === -1) {
    return markdown.slice(startContent).trim();
  }

  return markdown.slice(startContent, endIndex).trim();
}

// ========== Prompt 构建 ==========

/**
 * 构建初稿 Prompt
 */
function buildDraftPrompt(title: string, brief: ParsedBrief, rag: ParsedRAG): string {
  const lines: string[] = [];

  lines.push("# 写作任务\n");
  lines.push(`请基于以下素材撰写一篇文章。\n`);

  // ========== 标题 ==========
  lines.push("## 标题");
  lines.push(title);
  lines.push("");

  // ========== 推荐角度 (核心) ==========
  if (brief.recommendedAngle) {
    lines.push("## 推荐写作角度");
    lines.push(`**角度**: ${brief.recommendedAngle.name}`);
    lines.push(`**核心论点**: ${brief.recommendedAngle.coreArgument}`);

    if (brief.recommendedAngle.evidence.length > 0) {
      lines.push("**论据支撑**:");
      brief.recommendedAngle.evidence.forEach(ev => {
        lines.push(`  - ${ev}`);
      });
    }

    if (brief.recommendedAngle.differentiation) {
      lines.push(`**差异化**: ${brief.recommendedAngle.differentiation}`);
    }
    lines.push("");
  }

  // ========== 核心洞察 ==========
  if (brief.keyInsights.length > 0) {
    lines.push("## 核心洞察");
    brief.keyInsights.forEach((insight, i) => {
      lines.push(`${i + 1}. ${insight}`);
    });
    lines.push("");
  }

  // ========== 分析框架 ==========
  if (brief.framework) {
    lines.push("## 分析框架");
    lines.push("```");
    lines.push(brief.framework);
    lines.push("```");
    lines.push("");
  }

  // ========== 数据支撑 ==========
  if (brief.dataPoints.length > 0) {
    lines.push("## 数据支撑");
    brief.dataPoints.slice(0, 5).forEach((point, i) => {
      lines.push(`${i + 1}. ${point}`);
    });
    lines.push("");
  }

  // ========== RAG 内容 ==========
  if (rag.hasContent) {
    if (rag.quotes.length > 0) {
      lines.push("## 参考金句 (可用于开头/结尾)");
      rag.quotes.forEach((quote, i) => {
        lines.push(`${i + 1}. ${quote}`);
      });
      lines.push("");
    }

    if (rag.articleSnippets.length > 0) {
      lines.push("## 参考文章片段 (论据补充)");
      rag.articleSnippets.forEach((snippet, i) => {
        lines.push(`### 片段 ${i + 1}`);
        lines.push(snippet.slice(0, 300) + (snippet.length > 300 ? "..." : ""));
        lines.push("");
      });
    }
  }

  // ========== 写作要求 ==========
  lines.push("---\n");
  lines.push("## 写作要求");
  lines.push("");
  lines.push("### 结构要求");
  lines.push("1. **开头**: 用金句/数据/场景引入，吸引读者");
  lines.push("2. **正文**: 基于核心论点展开，每个论点有数据或案例支撑");
  lines.push("3. **结尾**: 总结要点 + 延伸思考 + 行动建议");
  lines.push("");

  lines.push("### 风格要求");
  lines.push("- 适合微信公众号阅读 (1500-2500字)");
  lines.push("- 段落简短 (3-5句话)");
  lines.push("- 使用过渡词连接段落");
  lines.push("- 适度使用列表和引用");
  lines.push("");

  lines.push("### 格式要求");
  lines.push("- 使用 Markdown 标题结构 (##, ###)");
  lines.push("- 重点内容用 **加粗** 标注");
  lines.push("- 避免过度使用格式");
  lines.push("");

  lines.push("---\n");
  lines.push("请直接输出完整的文章内容，使用 Markdown 格式。");

  return lines.join("\n");
}

// ========== System Message ==========

/**
 * System Message
 */
const DRAFT_SYSTEM_MESSAGE = `你是一个专业的公众号作者，擅长撰写深度分析和技术科普内容。

## 核心能力
- 清晰的逻辑结构和论证框架
- 丰富的案例和类比
- 通俗而精准的语言表达
- 数据支撑的观点

## 写作风格
1. **开头吸引注意**: 用金句、问题、场景或数据引入
2. **论点清晰明确**: 每个段落一个核心观点
3. **过渡自然流畅**: 使用过渡词连接段落
4. **结尾有力升华**: 总结要点 + 延伸思考 + 行动建议

## 结构参考
- 引言: 为什么这个话题重要？
- 论点1: 核心概念解释 (类比/举例)
- 论点2: 实际应用/价值
- 论点3: 常见问题/注意事项
- 论点4: 未来趋势/发展
- 结尾: 总结 + 行动建议

## 格式要求
- 使用 Markdown 标题结构 (##, ###)
- 段落不要太长 (3-5句话)
- 适度使用列表和引用
- 避免过度使用格式`;

// ========== 辅助函数 ==========

/**
 * 获取默认输出路径
 */
function getDefaultOutputPath(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const runId = `article-${timestamp}`;
  return join(process.cwd(), "output", runId);
}
