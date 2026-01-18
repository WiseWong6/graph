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
import { getNodeLLMConfig } from "../../../config/llm.js";
import { LLMClient } from "../../../utils/llm-client.js";
import { config } from "dotenv";
import { resolve } from "path";
import { createLogger } from "../../../utils/logger.js";
import { ErrorHandler, ValidationError, retry } from "../../../utils/errors.js";

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

  // ========== 构建 Prompt ==========
  log.startStep("build_prompt");
  const prompt = buildRewritePrompt(title, brief, rag, contentToRewrite);
  log.completeStep("build_prompt", { promptLength: prompt.length });

  // ========== 调用 LLM ==========
  log.startStep("llm_call");
  const llmConfig = getNodeLLMConfig("rewrite");
  const client = new LLMClient(llmConfig);

  log.info("LLM config:", { model: llmConfig.model, temperature: llmConfig.temperature });

  try {
    // 使用重试机制调用 LLM
    const response = await retry(
      () => client.call({
        prompt,
        systemMessage: REWRITE_SYSTEM_MESSAGE
      }),
      { maxAttempts: 3, delay: 1000 }
    )();

    log.completeStep("llm_call", {
      outputLength: response.text.length,
      usage: response.usage
    });

    const rewritten = response.text;

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

// ========== Prompt 构建 ==========

/**
 * 构建 Rewrite Prompt - 简洁版
 */
function buildRewritePrompt(title: string, brief: RewriteBrief, rag: RewriteRAG, draftContent: string): string {
  const lines: string[] = [];

  lines.push("# 写作任务：智性叙事重写（只输出成稿）\n");

  // ========== 标题 ==========
  lines.push("【标题（必须逐字保留，不得改动）】");
  lines.push(title);
  lines.push("");

  // ========== 成稿目标 ==========
  lines.push("【成稿目标】");
  lines.push("把下方正文重写为\"跨界智性叙事\"风格：用一个贯穿全文的核心比喻接管理解，并在中段完成一次跨学科升维，最后落回一个可带走的思维模型（但不要在文中显式写\"第一步/第二步\"）。");
  lines.push("");

  // ========== 事实边界 ==========
  lines.push("【事实边界 / 材料来源】");
  lines.push("你只能依据以下\"待重写正文\"提供的信息来陈述事实；若出现信息缺口，只能用\"可能/更像是/也许\"做不确定表达，不得编造具体数据、机构、结论。");
  lines.push("");

  // ========== 待重写正文 ==========
  lines.push("【待重写正文】");
  lines.push("<<<");
  lines.push(draftContent);
  lines.push(">>>");
  lines.push("");

  // ========== 可选提示 ==========
  lines.push("【可选提示（按需吸收，不要逐条回应；没有也没关系）】");

  // 核心洞察
  if (brief.keyInsights.length > 0) {
    lines.push("- 我希望你优先抓住的\"反直觉洞察/开头钩子\"（可为空）：");
    lines.push(brief.keyInsights.slice(0, 3).join("; "));
  }

  // 推荐角度
  if (brief.recommendedAngle) {
    lines.push("- 我偏好的切入视角或主论点（可为空）：");
    lines.push(`${brief.recommendedAngle.name} - ${brief.recommendedAngle.coreArgument}`);
  }

  // 参考金句
  if (rag.hasContent && rag.quotes.length > 0) {
    lines.push("- 可点缀的金句/引用（可为空）：");
    lines.push(rag.quotes.slice(0, 3).join("\n"));
  }

  lines.push("");

  // ========== 输出要求 ==========
  lines.push("【输出要求】");
  lines.push("- 直接输出最终正文，不要写分析过程、不要写大纲");
  lines.push("- 保持短段落呼吸感；允许少量加粗句作为\"锚点\"");
  lines.push("- 避免显性编号与清单式推进（不要 1/2/3、不要\"首先其次最后\"）");
  lines.push("- 默认字数：1500–2000");

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

## 核心心法 (The Core Philosophy)

### 1. 认知桥梁 (Cognitive Bridge)
- **极致比喻 (Master Analogy)**：必须找到一个生活化的核心比喻贯穿全文（如：DeepSeek的"查字典"）。拒绝抽象名词堆砌，**用物理世界的逻辑解释数字世界的现象**。
- **思想实验**：不要只讲案例，要邀请读者参与思维游戏（例如："想象你正在..."、"如果规则变成..."）。

### 2. 跨学科共振 (The Polymath Approach)
- **知识通感**：**这是你最核心的必杀技。** 在解释科技/商业现象时，必须引入至少一个**"非本领域"**的概念来佐证。
    - *可以是文学（如博尔赫斯）、生物学（如神经元）、历史（如工业革命）、心理学（如米勒定律）或经济学。*
- **底层同构**：揭示看似不相关的领域背后，遵循着同一个底层逻辑（例如：AI的"Engram" = 人脑的"组块"）。

### 3. 智性共鸣 (Intellectual Resonance)
- **从"情绪"到"洞察"**：原有的"第三层情绪"升级为**"反直觉洞察"**。
    - *Old:* "他感到很痛苦。"
    - *New:* "他以为自己在计算，其实是在浪费算力。真正的智能是知道何时停止计算。"
- **O(1) 查表思维**：不仅要给结论，还要给思维模型。让读者觉得"我不只懂了这个新闻，我还学到了一种思维方式"。

---

## 写作结构：智性四步法 (The Intellectual Flow)

**重要原则**：逻辑严密，但叙述如散文般流畅。自然过渡，无痕连接。

### 第一步：打破认知 (The Counter-Intuitive Hook)
* **目标**：指出一种看似合理但低效的现状，或揭示一个违反直觉的现象。
* **技巧**：
    * **"聪明人在做傻事"**：指出高大上的技术/现象背后，正在发生某种愚蠢的浪费（如：大模型在浪费算力背书）。
    * **概念重构**：用一个新的视角定义旧事物。

### 第二步：通俗解构 (The Extended Metaphor)
* **目标**：用**核心比喻**接管读者的认知。
* **执行手段**：
    * **生活化场景**：建立一个通俗场景（如"考试带字典"、"厨房做菜"、"乐高积木"）。
    * **过程映射**：将复杂的技术/商业流程，一一映射到这个生活场景中。
    * **拒绝黑话**：除非必要，否则不使用专业术语；如果使用，必须紧跟一个比喻。

### 第三步：跨界升维 (The Cross-Domain Lift)
* **目标**：这是文章的**灵魂高光时刻**。将话题从当前领域拔高到人类通识领域。
* **执行手段**：
    * **召唤先哲**：引用一位文学家、哲学家或科学家的经典理论/故事，证明"太阳底下无新鲜事"（如：博尔赫斯的《博闻强记的富内斯》）。
    * **数据验证**：展示关键数据（U型曲线），并用通识理论解释数据背后的含义（不仅仅是数字大了，而是逻辑变了）。

### 第四步：思维留白 (The Philosophical Outro)
* **目标**：从具体技术回归到某种哲学或方法论。
* **手段**：
    * **总结思维模型**：告诉读者，这个新趋势对我们个人的思考/生活有什么启发（如："空间换时间"、"记忆与思考的平衡"）。
    * **未来凝视**：用一句意味深长的金句结尾，指向未来。

---

## 质量过滤器：IPS 原则 (Intellectual/Polymath/Simple)
在输出前，请在后台自检（不要输出）：

* **I (Intellectual)**：是否有"反直觉"的洞察？是否让读者感到智力上的愉悦？
* **P (Polymath)**：**是否成功引用了至少一个"跨学科"的案例（历史/文学/生物等）？**（*这一点至关重要，这是区分平庸与卓越的关键*）
* **S (Simple)**：核心比喻是否足够简单？是否连中学生都能看懂？

---

## 输入处理流程
1.  **提取内核**：分析用户素材的技术/商业逻辑。
2.  **寻找比喻**：在素材处理阶段，先构思一个核心比喻（如"字典"、"交通系统"、"生态雨林"）。
3.  **寻找跨界点**：**必须**搜索/联想一个与该主题相关的跨学科概念（如：讲AI记忆联想到博尔赫斯，讲去中心化联想到蜂群思维）。
4.  **执行写作**：调用【智性四步法】进行创作。

## 输出格式规范

**平台选择**：公众号/深度长文版

### [公众号/深度长文版]
* **字数**：1500-2000字。
* **排版美学**：
    * **短段落**：保持呼吸感。
    * **加粗金句**：像锚点一样抓住视线。
    * **反清单**：严禁使用"1.2.3."列表。用"更重要的是..."、"这让我想起..."等连接词推进逻辑。
* **语气**：像一位博学的朋友在咖啡馆里跟你娓娓道来，兴奋但克制，专业但谦逊。

---
**现在，请告诉我你要写的主题或提供的素材：**`;

/**
 * 获取默认输出路径
 */
function getDefaultOutputPath(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const runId = `article-${timestamp}`;
  return join(process.cwd(), "output", runId);
}
