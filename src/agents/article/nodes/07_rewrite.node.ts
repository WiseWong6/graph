/**
 * Rewrite 节点
 *
 * 职责: 使用智性叙事风格重写润色后的文章
 *
 * 数据流:
 * polished + researchResult (Brief) + ragContent + selectedTitle → LLM 重写 → rewritten
 *
 * 核心差异:
 * - Draft (05): 图书管理员 - 整理资料，生成完整内容
 * - Polish (06): 编辑 - 润色表达，添加金句点缀
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
import { getNodeLLMConfig } from "../../../config/llm.js";
import { LLMClient } from "../../../utils/llm-client.js";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env") });

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
  console.log("[07_rewrite] Rewriting with intellectual narrative style...");

  if (!state.polished) {
    console.error("[07_rewrite] No polished content to rewrite");
    throw new Error("Polished content not found in state");
  }

  // ========== 获取标题 ==========
  const title = state.decisions?.selectedTitle || state.titles?.[0] || state.topic || "无标题";

  // ========== 解析 Brief 和 RAG ==========
  const brief = parseBriefForRewrite(state.researchResult || "");
  const rag = parseRAGForRewrite(state.ragContent || "");

  console.log("[07_rewrite] Parsed Brief:", {
    topic: brief.topic,
    insightsCount: brief.keyInsights.length,
    hasAngle: !!brief.recommendedAngle
  });

  console.log("[07_rewrite] Parsed RAG:", {
    quotesCount: rag.quotes.length,
    hasContent: rag.hasContent
  });

  // ========== 构建 Prompt ==========
  const prompt = buildRewritePrompt(title, brief, rag, state.polished);

  // ========== 调用 LLM ==========
  const llmConfig = getNodeLLMConfig("rewrite");
  const client = new LLMClient(llmConfig);

  console.log("[07_rewrite] Calling LLM with config:", llmConfig.model);

  try {
    const response = await client.call({
      prompt,
      systemMessage: REWRITE_SYSTEM_MESSAGE
    });

    console.log("[07_rewrite] Rewrite completed, length:", response.text.length);
    console.log("[07_rewrite] Usage:", response.usage);

    const rewritten = response.text;

    // ========== 保存 Rewrite 稿 ==========
    const outputPath = state.outputPath || getDefaultOutputPath();
    const rewriteDir = join(outputPath, "rewrite");

    if (!existsSync(rewriteDir)) {
      mkdirSync(rewriteDir, { recursive: true });
    }

    const rewritePath = join(rewriteDir, "07_rewrite.md");
    writeFileSync(rewritePath, rewritten, "utf-8");
    console.log("[07_rewrite] Saved rewrite:", rewritePath);

    return {
      rewritten,
      outputPath
    };
  } catch (error) {
    console.error(`[07_rewrite] Failed to rewrite: ${error}`);
    // 降级: 返回润色稿
    return {
      rewritten: state.polished
    };
  }
}

// ========== 解析器 ==========

/**
 * 解析 Brief 提取核心洞察（用于 Rewrite）
 *
 * Rewrite 需要的是：
 * - 核心洞察（用于打破认知）
 * - 推荐角度（用于构建叙事框架）
 * - 主题（用于跨界引用搜索）
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
 *
 * Rewrite 只需要金句，不需要完整文章片段
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

// ========== Prompt 构建 ==========

/**
 * 构建 Rewrite Prompt
 */
function buildRewritePrompt(title: string, brief: RewriteBrief, rag: RewriteRAG, polished: string): string {
  const lines: string[] = [];

  lines.push("# 写作任务\n");
  lines.push(`请使用**智性叙事风格**重写以下文章。\n`);

  // ========== 标题 ==========
  lines.push("## 标题");
  lines.push(title);
  lines.push("");

  // ========== 核心洞察（用于打破认知） ==========
  if (brief.keyInsights.length > 0) {
    lines.push("## 核心洞察");
    lines.push("_这些洞察可用于构建「打破认知」的开头_");
    brief.keyInsights.forEach((insight, i) => {
      lines.push(`${i + 1}. ${insight}`);
    });
    lines.push("");
  }

  // ========== 推荐角度（用于构建叙事框架） ==========
  if (brief.recommendedAngle) {
    lines.push("## 推荐写作角度");
    lines.push(`**角度**: ${brief.recommendedAngle.name}`);
    lines.push(`**核心论点**: ${brief.recommendedAngle.coreArgument}`);
    lines.push("");
  }

  // ========== 参考金句（用于点缀） ==========
  if (rag.hasContent && rag.quotes.length > 0) {
    lines.push("## 参考金句（可用于点缀）");
    rag.quotes.forEach((quote, i) => {
      lines.push(`${i + 1}. ${quote}`);
    });
    lines.push("");
  }

  // ========== 待重写的文章 ==========
  lines.push("---");
  lines.push("## 待重写的文章");
  lines.push("```");
  lines.push(polished.slice(0, 3000) + (polished.length > 3000 ? "\n... (内容已截断，请基于完整内容重写)" : ""));
  lines.push("```");
  lines.push("");

  // ========== 智性四步法 ==========
  lines.push("---\n");
  lines.push("## 重写要求：智性四步法\n");

  lines.push("### 第一步：打破认知");
  lines.push("- 指出一种看似合理但低效的现状");
  lines.push("- 或揭示一个违反直觉的现象");
  lines.push("- 用「聪明人在做傻事」的方式吸引注意");
  lines.push("");

  lines.push("### 第二步：通俗解构");
  lines.push("- 用一个**生活化的核心比喻**贯穿全文");
  lines.push("- 将复杂概念映射到这个场景中");
  lines.push("- 拒绝黑话，术语紧跟比喻");
  lines.push("");

  lines.push("### 第三步：跨界升维");
  lines.push("- **这是文章的灵魂高光时刻**");
  lines.push("- 引用至少一个跨学科案例（文学/生物/历史/心理学/经济学）");
  lines.push("- 用通识理论解释现象背后的逻辑");
  lines.push("");

  lines.push("### 第四步：思维留白");
  lines.push("- 总结思维模型，对个人思考/生活的启发");
  lines.push("- 用一句意味深长的金句结尾");
  lines.push("");

  // ========== 质量要求 ==========
  lines.push("---\n");
  lines.push("## 质量要求：IPS 原则\n");
  lines.push("- **I (Intellectual)**: 反直觉洞察，提供智力愉悦感");
  lines.push("- **P (Polymath)**: 至少一个跨学科引用（历史/文学/生物等）");
  lines.push("- **S (Simple)**: 核心比喻足够简单，中学生能懂");
  lines.push("");

  lines.push("## HKR 自检");
  lines.push("- **Hook（悬念）**: 是否有反差/时间压迫/冲突点？");
  lines.push("- **Knowledge（知识）**: 是否有可讲的新知/数据/教训？");
  lines.push("- **Resonance（共鸣）**: 是否有可共鸣的处境/情绪？");
  lines.push("");

  // ========== 格式约束 ==========
  lines.push("## 格式约束");
  lines.push("- **禁止**：列表符号、\"首先/其次/综上所述\"、机械分点");
  lines.push("- **字数**：1500-2000 字");
  lines.push("- **段落**：短段落保持呼吸感");
  lines.push("- **加粗**：关键洞察和金句用 **加粗** 标注");
  lines.push("");

  lines.push("---\n");
  lines.push("请直接输出完整的重写后文章，使用 Markdown 格式。");

  return lines.join("\n");
}

// ========== System Message ==========

/**
 * System Message - 跨界智性叙事者
 */
const REWRITE_SYSTEM_MESSAGE = `# Role: 跨界智性叙事者 (Interdisciplinary & Intellectual Storyteller)

## 核心定位
你是一个**擅长用人文视角解构复杂技术的通识专家**。你认为技术不是冰冷的数学，它是哲学、生物学和文学在硅基世界的投影。
你的目标不是单纯地"把事情讲清楚"，而是**构建一座认知桥梁**，连接陌生概念与读者的已知经验，并提供一种"**智性愉悦感**"（Intellectual Delight）。

**你的读者画像**：**求知欲强、喜欢跨界思考的聪明人**。
- 他们不满足于知道"它是什么"，更想知道"它像什么"以及"它在人类知识图谱中的位置"。
- 相比于煽情的鸡汤，他们更渴望逻辑闭环带来的"Aha Moment"（顿悟时刻）。

## 核心心法

### 1. 认知桥梁 (Cognitive Bridge)
- **极致比喻**：必须找到一个生活化的核心比喻贯穿全文。拒绝抽象名词堆砌，**用物理世界的逻辑解释数字世界的现象**。
- **思想实验**：邀请读者参与思维游戏（例如："想象你正在..."、"如果规则变成..."）。

### 2. 跨学科共振 (The Polymath Approach)
- **知识通感**：**这是你最核心的必杀技。** 在解释科技/商业现象时，必须引入至少一个**"非本领域"**的概念来佐证。
    - *可以是文学（如博尔赫斯）、生物学（如神经元）、历史（如工业革命）、心理学（如米勒定律）或经济学。*
- **底层同构**：揭示看似不相关的领域背后，遵循着同一个底层逻辑。

### 3. 智性共鸣 (Intellectual Resonance)
- **从"情绪"到"洞察"**：将"情绪"升级为**"反直觉洞察"**。
    - *Old:* "他感到很痛苦。"
    - *New:* "他以为自己在计算，其实是在浪费算力。真正的智能是知道何时停止计算。"
- **思维模型**：不仅要给结论，还要给思维模型。让读者觉得"我不只懂了这个新闻，我还学到了一种思维方式"。

## 写作结构：智性四步法

**重要原则**：逻辑严密，但叙述如散文般流畅。自然过渡，无痕连接。

### 第一步：打破认知
指出一种看似合理但低效的现状，或揭示一个违反直觉的现象。

### 第二步：通俗解构
用**核心比喻**接管读者的认知。建立一个通俗场景，将复杂流程一一映射到这个场景中。

### 第三步：跨界升维
这是文章的**灵魂高光时刻**。引用一位文学家、哲学家或科学家的经典理论/故事，证明"太阳底下无新鲜事"。

### 第四步：思维留白
总结思维模型，告诉读者这个新趋势对我们个人的思考/生活有什么启发。用一句意味深长的金句结尾。

## 质量过滤器：IPS 原则

在输出前，请在后台自检（不要输出）：

* **I (Intellectual)**：是否有"反直觉"的洞察？是否让读者感到智力上的愉悦？
* **P (Polymath)**：**是否成功引用了至少一个"跨学科"的案例（历史/文学/生物等）？**
* **S (Simple)**：核心比喻是否足够简单？是否连中学生都能看懂？

## 格式要求

- **字数**：1500-2000字
- **段落**：短段落保持呼吸感
- **加粗**：关键洞察和金句用 **加粗** 标注
- **禁止**：列表符号、"首先/其次"、机械分点`;

// ========== 辅助函数 ==========

/**
 * 获取默认输出路径
 */
function getDefaultOutputPath(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const runId = `article-${timestamp}`;
  return join(process.cwd(), "output", runId);
}
