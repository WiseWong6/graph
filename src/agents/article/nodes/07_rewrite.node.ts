/**
 * Rewrite 节点 v2 - 使用统一错误处理和日志
 *
 * 职责: 使用智性叙事风格重写初稿文章
 *
 * 数据流:
 * draft + researchResult (Brief) + ragContent + selectedTitle → LLM 重写 → rewritten
 *
 * 核心差异:
 * - Draft (05): 图书管理员 - 整理资料，生成完整内容
 * - Rewrite (07): 跨界智性叙事者 - 深度创作，注入灵魂
 *
 * 设计原则:
 * - 智性四步法：打破认知 → 通俗解构 → 跨界升维 → 思维留白
 * - IPS 原则：反直觉洞察 + 跨学科引用 + 简单易懂
 * - HKR 自检：悬念 + 新知 + 共鸣
 * - 禁止：列表、机械分点、"首先/其次"
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { ArticleState } from "../state";
import { getPromptTemplates } from "../../../config/llm.js";
import { callLLMWithFallback } from "../../../utils/llm-runner.js";
import { config } from "dotenv";
import { resolve } from "path";
import { createLogger } from "../../../utils/logger.js";
import { ErrorHandler, ValidationError, retry } from "../../../utils/errors.js";
import { parseHKRScore } from "../../../utils/prompt-parser.js";
import { renderTemplate } from "../../../utils/template.js";

config({ path: resolve(process.cwd(), ".env") });

// 创建节点日志
const log = createLogger("06_rewrite");

// ========== 类型定义 ==========

/**
 * 解析后的 Brief 数据（用于 Rewrite）
 */
interface RewriteBrief {
  keyInsights: string[];
  recommendedAngle: {
    name: string;
    coreArgument: string;
  } | null;
  topic: string;
}

/**
 * 解析后的 RAG 数据（用于 Rewrite）
 */
interface RewriteRAG {
  quotes: string[];
  hasContent: boolean;
}

// ========== Rewrite 节点主函数 ==========

/**
 * Rewrite 节点主函数
 *
 * @param state - 当前状态
 * @returns 更新的状态
 */
export async function rewriteNode(state: ArticleState): Promise<Partial<ArticleState>> {
  const timer = log.timer("rewrite");
  log.startStep("validate_input");

  // ========== 验证输入 ==========
  // 使用 draft 作为输入
  const contentToRewrite = state.draft;
  if (!contentToRewrite) {
    throw new ValidationError("Draft content not found in state", "draft");
  }

  // ========== 获取标题 ==========
  const title = state.decisions?.selectedTitle || state.titles?.[0] || "无标题";
  log.completeStep("validate_input", { title, inputLength: contentToRewrite.length });

  // ========== 解析 Brief 和 RAG ==========
  log.startStep("parse_input");
  const brief = parseBriefForRewrite(state.researchResult || "");
  const rag = parseRAGForRewrite(state.ragContent || "");

  log.completeStep("parse_input", {
    topic: brief.topic,
    insightsCount: brief.keyInsights.length,
    hasAngle: !!brief.recommendedAngle,
    quotesCount: rag.quotes.length,
    hasRAG: rag.hasContent
  });

  // ========== 从配置读取提示词 ==========
  log.startStep("build_prompt");
  const prompts = getPromptTemplates();
  const systemMessage = prompts?.rewrite_system || DEFAULT_REWRITE_SYSTEM;
  const userPromptTemplate = prompts?.rewrite_user || DEFAULT_REWRITE_USER;

  // 使用 renderTemplate 全局替换所有占位符
  const userPrompt = renderTemplate(userPromptTemplate, {
    title,
    draft_content: contentToRewrite,
    key_insights: brief.keyInsights.slice(0, 3).join("; "),
    recommended_angle: brief.recommendedAngle
      ? `${brief.recommendedAngle.name} - ${brief.recommendedAngle.coreArgument}`
      : "(无)",
    quotes: rag.hasContent && rag.quotes.length > 0
      ? rag.quotes.slice(0, 3).join("\n")
      : "(无)"
  });

  log.completeStep("build_prompt", { systemMsgLength: systemMessage.length, userPromptLength: userPrompt.length });

  // ========== 调用 LLM ==========
  log.startStep("llm_call");
  try {
    // 使用重试机制调用 LLM
    const result = await retry(
      () => callLLMWithFallback(state.decisions?.selectedModel, "rewrite", {
        prompt: userPrompt,
        systemMessage
      }),
      { maxAttempts: 3, delay: 1000 }
    )();

    log.info("LLM config:", { model: result.config.model, temperature: result.config.temperature });

    log.completeStep("llm_call", {
      outputLength: result.response.text.length,
      usage: result.response.usage
    });

    const rewritten = result.response.text;

    // ========== HKR 评分解析（后处理检查） ==========
    const score = parseHKRScore(rewritten);
    if (score) {
      log.info(`HKR 评分: H=${score.h}, K=${score.k}, R=${score.r}`);
      if (score.reason_h || score.reason_k || score.reason_r) {
        log.info(`HKR 理由: h=${score.reason_h || '(无)'}, k=${score.reason_k || '(无)'}, r=${score.reason_r || '(无)'}`);
      }
      if (score.h < 3 || score.k < 3 || score.r < 3) {
        log.warn(`HKR 评分偏低，建议重新生成`);
      }
    }

    // ========== 保存 Rewrite 稿 ==========
    log.startStep("save_output");
    const outputPath = state.outputPath || getDefaultOutputPath();
    const rewriteDir = join(outputPath, "rewrite");

    if (!existsSync(rewriteDir)) {
      mkdirSync(rewriteDir, { recursive: true });
    }

    const rewritePath = join(rewriteDir, "06_rewrite.md");
    writeFileSync(rewritePath, rewritten, "utf-8");

    log.completeStep("save_output", { path: rewritePath });
    log.success(`Complete in ${timer.log()}`);

    return {
      rewritten,
      outputPath
    };
  } catch (error) {
    log.failStep("llm_call", error);
    ErrorHandler.handle(error, "06_rewrite");

    // 降级: 返回初稿
    log.warn("Fallback to draft content");
    return {
      rewritten: contentToRewrite
    };
  }
}

// ========== 解析器 ==========

/**
 * 解析 Brief 提取核心洞察（用于 Rewrite）
 */
function parseBriefForRewrite(brief: string): RewriteBrief {
  const result: RewriteBrief = {
    keyInsights: [],
    recommendedAngle: null,
    topic: ""
  };

  // 提取主题
  const topicMatch = brief.match(/主题[：:]\s*(.+?)(?:\n|$)/i);
  if (topicMatch) {
    result.topic = topicMatch[1].trim();
  }

  // 提取核心洞察（最多 4-5 个）
  const insightsSection = extractSection(brief, "## 核心洞察", "##");
  if (insightsSection) {
    const insightMatches = insightsSection.split("###").filter(s => s.trim());
    result.keyInsights = insightMatches.map(s => {
      const lines = s.trim().split("\n");
      const title = lines[0].replace(/^\d+\.\s*/, "").trim();
      const content = lines.slice(1).join(" ").trim();
      return content || title;
    }).filter(Boolean).slice(0, 5);
  }

  // 提取推荐角度
  const angleSection = extractSection(brief, "## 推荐写作角度", "##");
  if (angleSection) {
    const angleNameMatch = angleSection.match(/推荐[：:]\s*(.+?)(?:\n|$)/i);
    const coreArgMatch = angleSection.match(/核心论点[：:]\s*(.+?)(?:\n|$)/i);

    if (angleNameMatch || coreArgMatch) {
      result.recommendedAngle = {
        name: angleNameMatch ? angleNameMatch[1].trim() : "未命名角度",
        coreArgument: coreArgMatch ? coreArgMatch[1].trim() : ""
      };
    }
  }

  return result;
}

/**
 * 解析 RAG 提取金句（用于 Rewrite 点缀）
 */
function parseRAGForRewrite(rag: string): RewriteRAG {
  const result: RewriteRAG = {
    quotes: [],
    hasContent: !rag.includes("索引未初始化")
  };

  if (!result.hasContent) {
    return result;
  }

  // 提取金句（最多 3 条）
  const quotesSection = extractSection(rag, "## 相关金句", "##");
  if (quotesSection) {
    const quoteMatches = quotesSection.split("###").filter(s => s.trim());
    result.quotes = quoteMatches
      .map(s => {
        const lines = s.trim().split("\n");
        return lines.slice(1).join(" ").trim();
      })
      .filter(q => q.length > 5)
      .slice(0, 3);
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

// ========== 默认 Message（降级备用） ==========

/**
 * 默认 System Message - 当配置加载失败时使用
 */
const DEFAULT_REWRITE_SYSTEM = `# Role: 真诚且专业的活人创作者 + 主编型结构工程师

你用真实经历与主观波动建立信任（活人感），用研究与证据提供洞见（专家心态），用结构与认知舒适度让读者读完（低负荷+高奖励）。

## 核心原则（必须遵守）

1. **活人感**：必须存在"我"的视角与情绪波动（好奇→震惊→后悔→释然…），并至少出现一次"我以为…结果…"
2. **专家心态**：研究与思考要超过 90% 读者；若证据不足，降低断言强度，用"我目前证据是…我更倾向于…"表达不确定性
3. **真诚与价值观**：可以不说，但绝不欺骗；不为流量违背常识；对边界与反例保持敬畏
4. **深度最低配**：至少写出 1 个"非显而易见的模式" + 1 个"根因" + 1 个"反直觉点/权衡代价"
5. **读者画像**：把读者当成"很聪明、很有钱、但很忙的人"——删废话、结构清晰、重点可扫读

## 内部写作流程（只在脑中执行，不要输出）

- 先走一遍 5 层深度骨架（≤12行量级）：Observation → Pattern → Root Cause（3-5层Why）→ Implications → Counter-intuitive
- 必要时启用第三层情绪：表层→第二层→最真实矛盾的一层
- 用 Uneven U：先抛不太抽象的判断→下潜到具体证据→再上升到解释与综合

## 写作三维公式（必须同时照顾）

写作质量 = 信息传递 × 情感共鸣 × 认知舒适度

- 信息传递：术语就地解释；按"已知→未知"讲；不给读者回读成本
- 情感共鸣：至少包含一个反直觉洞见 / "我以为→结果" / 微幽默
- 认知舒适度：短段落（2-4句）；每 300-500 字给一个"可带走奖励"（洞见/例子/对比/方法/金句）

## 输出要求（硬规则）

- **只输出最终正文**，不要写分析过程、不要解释写作方法
- 段落要短、有呼吸感；允许少量加粗句作为锚点（不超过 10 处）
- 避免显性编号与清单式推进（除非原文就这么写且必须保留）
- 默认字数：1500–2000
- **文末必须追加一个 HKR 尾标（用于程序解析，不要解释）**，格式固定为一行：
  [[HKR]] H=<0-5> K=<0-5> R=<0-5> [[/HKR]]`;

const DEFAULT_REWRITE_USER = `# 写作任务：活人感×深度分层重写（标题必须逐字保留）

【标题（必须逐字保留，不得改动）】
<<<TITLE
{title}
TITLE>>>

【待重写正文】
<<<DRAFT
{draft_content}
DRAFT>>>

【可选提示（按需吸收；为空则忽略）】
- 核心洞察：{key_insights}
- 推荐角度：{recommended_angle}
- 金句点缀：
{quotes}

【输出要求】
- 只输出最终正文（不要写分析过程）
- 标题必须逐字保留
- 保持短段落呼吸感；允许少量加粗句作为锚点
- 避免显性编号与清单式推进
- 默认字数：1500–2000
- 文末追加 HKR 尾标（不要解释），格式：
  [[HKR]] H=<0-5> K=<0-5> R=<0-5> [[/HKR]]`;

/**
 * 获取默认输出路径
 */
function getDefaultOutputPath(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const runId = `article-${timestamp}`;
  return join(process.cwd(), "output", runId);
}
