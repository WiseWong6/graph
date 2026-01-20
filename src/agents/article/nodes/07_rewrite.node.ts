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
import { retrievePersonalRAG } from "../../../rag/retrieval/personal-rag.js";

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
  const startTime = Date.now();

  // 新增：打印 state.decisions 诊断状态
  console.log("[06_rewrite] State check:", {
    hasDecisions: !!state.decisions,
    selectedModel: state.decisions?.selectedModel,
    allDecisionKeys: state.decisions ? Object.keys(state.decisions) : []
  });

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

  // ========== 检索个人写作库 ==========
  log.startStep("retrieve_personal_rag");
  let personalRAGContent = "(无)";
  let personalRAGVoice = "(无)";
  try {
    const draftPreview = contentToRewrite.slice(0, 600);
    const queryParts = [
      title,
      brief.topic,
      ...brief.keyInsights.slice(0, 3),
      draftPreview
    ].filter(Boolean).join(" ");

    const personalRAGResult = await retrievePersonalRAG(queryParts, {
      topKContent: 5,
      topKVoice: 3,
      maxLength: 300
    });

    personalRAGContent = personalRAGResult.content;
    personalRAGVoice = personalRAGResult.voice;

    log.completeStep("retrieve_personal_rag", {
      contentCount: personalRAGResult.stats.contentCount,
      voiceCount: personalRAGResult.stats.voiceCount,
      retrievalTime: personalRAGResult.stats.retrievalTime,
      fallback: personalRAGResult.stats.fallback
    });
  } catch (error) {
    log.error(`检索个人写作库失败: ${error}`);
    log.completeStep("retrieve_personal_rag", { fallback: true });
  }

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
      : "(无)",
    personal_rag_content: personalRAGContent,
    personal_rag_voice: personalRAGVoice
  });

  log.completeStep("build_prompt", { systemMsgLength: systemMessage.length, userPromptLength: userPrompt.length });

  // ========== 调用 LLM ==========
  log.startStep("llm_call");
  try {
    // 使用重试机制调用 LLM
    const result = await retry(
      () => callLLMWithFallback(
        {
          selectedModel: state.decisions?.selectedModel,
          selectedModels: state.decisions?.selectedModels
        },
        "rewrite",
        {
          prompt: userPrompt,
          systemMessage
        }
      ),
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

    const executionTime = Date.now() - startTime;

    return {
      rewritten,
      outputPath,
      decisions: {
        ...state.decisions,
        timings: {
          ...state.decisions?.timings,
          "07_rewrite": executionTime
        }
      }
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
const DEFAULT_REWRITE_SYSTEM = `# Role: 真诚且专业的"活人"内容创作者

## Profile
你不是一个冰冷的 AI，你是一个有体温、有经历、有原则的内容创作者。你深知在 AI 时代，"活人感"是最昂贵的奢侈品。你的写作目标不是堆砌辞藻，而是通过讲故事与读者建立深度的情感连接。

## Core Philosophy (心法)
1. **活人感**：必须有主观视角、情感波动和个人思考。拒绝绝对理性的客观分析，要有"我以为"、"我经历"。
2. **真诚**：不欺骗，不为了流量写自己不信的东西。把读者当成"聪明、有钱但很忙"的朋友，不讲废话。
3. **专家心态**：不懂不写，写就要往死里研究。对写下的每一个字负责。
4. **故事思维**：人脑喜欢故事，不喜欢逻辑。把所有观点包装成微型故事。

## Workflow (思维流 - 仅供内部执行)
1. **分析素材**：用户输入主题后，首先判断是否具备 HKR 爆款潜质。
2. **结构构思**：按照下方的【Content Structure】搭建骨架。
3. **隐性自检 (HKR Check)**：在输出前，**在后台默默检查**以下几点（**严禁输出此检查过程**）：
    - H (Hook): 开头够不够让人产生"卧槽"的好奇心？
    - K (Knowledge): 读者能学到新东西吗？
    - R (Resonance): 情绪能共鸣吗？
4. **生成正文**：只有当检查通过后，才输出最终文章。

## Content Structure (输出框架)
**正文必须严格融合以下四步，但不要输出"Step 1"等步骤标题：**

1. **设悬念 (黄金3秒)**：
   - 用"数字 + 极端对比 + 时间限制"制造反差。一句话直击痛点。
2. **讲案例 (故事化)**：
   - 塑造主角（身份+困境），描述画面感细节。**不要讲道理，先讲故事。**
3. **得结论 (价值点)**：
   - 给出震撼的数据或深刻教训，确认价值。
4. **给启发 (互动)**：
   - 将话题引申到观众身上，提出开放式问题（"如果是你...？"）。

## Writing Rules (约束)
1. **拒绝论文体**：严禁使用"首先、其次、综上所述"等连接词。
2. **排版友好**：重点加粗，结构清晰，适合手机阅读。
3. **纯净输出**：**仅输出最终写好的文章内容。不要输出任何"我已准备好"、"以下是分析"、"HKR自检结果"等废话。**

## 输出格式要求
**文末必须追加 HKR 评分尾标（用于程序解析，不要在正文中解释）**，格式固定为一行：
[[HKR]] H=<0-5> K=<0-5> R=<0-5> [[/HKR]]

---
现在，请告诉我你要写的主题或提供的素材。`;

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
