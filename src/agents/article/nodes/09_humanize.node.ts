/**
 * Humanize 节点 v2 - 使用统一错误处理和日志
 *
 * 职责: 去除 AI 味，增加活人感和情感共鸣
 *
 * 数据流:
 * rewritten → LLM 人化 → humanized
 *
 * 设计原则:
 * - 格式清洗：去空格、标点规范、去引号
 * - 风格重写：去 AI 味、段落融合、口语化
 * - 保留 Markdown 结构（代码/链接/图片）
 *
 * 核心差异：
 * - Draft: 初稿
 * - Rewrite: 智性叙事，注入灵魂
 * - Humanize: 去机械化，增加活人感
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { ArticleState } from "../state";
import { callLLMWithFallback } from "../../../utils/llm-runner.js";
import { config } from "dotenv";
import { resolve } from "path";
import { createLogger } from "../../../utils/logger.js";
import { ErrorHandler, ValidationError, retry } from "../../../utils/errors.js";

config({ path: resolve(process.cwd(), ".env") });

// 创建节点日志
const log = createLogger("09_humanize");

import { humanizeFormat } from "../../../utils/text-cleaner.js";

/**
 * Humanize 节点主函数
 *
 * @param state - 当前状态
 * @returns 更新的状态
 */
export async function humanizeNode(state: ArticleState): Promise<Partial<ArticleState>> {
  const startTime = Date.now();

  // 新增：打印 state.decisions 诊断状态
  console.log("[09_humanize] State check:", {
    hasDecisions: !!state.decisions,
    selectedModel: state.decisions?.selectedModel,
    allDecisionKeys: state.decisions ? Object.keys(state.decisions) : []
  });

  console.log("⏳ [09_humanize] 去机械化处理中...");

  const timer = log.timer("humanize");

  // ========== 验证输入 ==========
  // 优先使用 rewritten，降级到 draft
  const input = state.rewritten || state.draft;

  if (!input) {
    throw new ValidationError("Content not found in state (need rewritten or draft)", "rewritten|draft");
  }

  // ========== 构建 Prompt ==========
  // 从 confirm 节点获取用户确认的图片数量
  const imageCount = state.decisions?.images?.count || 0;
  // 使用原始文本（不预处理）
  const prompt = buildHumanizePrompt(input, imageCount);

  // ========== 调用 LLM ==========
  try {
    // 使用重试机制调用 LLM
    const result = await retry(
      () => callLLMWithFallback(
        {
          selectedModel: state.decisions?.selectedModel,
          selectedModels: state.decisions?.selectedModels
        },
        "humanize",
        {
          prompt,
          systemMessage: HUMANIZE_SYSTEM_MESSAGE
        }
      ),
      { maxAttempts: 3, delay: 1000 }
    )();

    let humanized = result.response.text;

    // ========== 后处理：确定性格式清洗 ==========
    // 使用 TypeScript 处理刚性规则 (破折号、引号、空格等)，确保格式一致性
    const formatted = humanizeFormat(humanized);
    if (formatted !== humanized) {
      console.log("[09_humanize] 已应用后处理格式清洗");
    }
    humanized = formatted;

    const boldResult = restoreBoldMarkers(humanized, input);
    humanized = boldResult.text;

    const imageResult = ensureImagePlaceholders(humanized, imageCount);
    humanized = imageResult.text;

    // ========== 保存人化稿 ==========
    const outputPath = state.outputPath || getDefaultOutputPath();
    const humanizeDir = join(outputPath, "humanize");

    if (!existsSync(humanizeDir)) {
      mkdirSync(humanizeDir, { recursive: true });
    }

    const humanizedPath = join(humanizeDir, "08_humanized.md");
    writeFileSync(humanizedPath, humanized, "utf-8");

    console.log(`✅ [09_humanize] 完成 (${timer.log().replace("Complete in ", "")})`);

    const executionTime = Date.now() - startTime;

    return {
      humanized,
      outputPath,
      decisions: {
        ...state.decisions,
        timings: {
          ...state.decisions?.timings,
          "09_humanize": executionTime
        }
      }
    };
  } catch (error) {
    console.error(`❌ [09_humanize] 失败: ${error}`);
    ErrorHandler.handle(error, "09_humanize");

    // 降级: 返回原输入
    return {
      humanized: input
    };
  }
}

/**
 * 构建人化 Prompt
 */
function buildHumanizePrompt(content: string, imageCount: number): string {
  // 核心输入内容
  let prompt = `【待处理的文章】

<<<
${content}
>>>

`;

  // 图片插入指导（任务特定）
  if (imageCount > 0) {
    prompt += `【图片插入要求】
文章共有 ${imageCount} 张配图，请在合适位置插入：
- 语法：![描述](索引)，索引从 0 开始
- 建议在核心段落后插入
- 描述简洁有力，呼应内容
- 确保索引不超过 ${imageCount - 1}

`;
  }

  prompt += `【输出要求】
- 只输出处理后的 Markdown
- 不得输出分析/过程/解释
- 所有 Markdown 标记必须原样保留且可用（尤其是标题 # 和加粗 **）`;

  return prompt;
}

/**
 * System Message - 资深人类代笔作家（Ghostwriter）
 */
const HUMANIZE_SYSTEM_MESSAGE = `# Role: 资深人类代笔作家（Ghostwriter）

## 核心定位
你是一位痛恨"AI味"、"翻译腔"和"营销号悬念"的资深中文编辑。你的专长是将机械、逻辑僵硬、充满"伪互动"的文本，重写为干脆、利落、有呼吸感的自然中文。

你相信好文章是**"陈述"**出来的，不是靠**"设问"、"悬念"和"连接词"**堆出来的。

---

## 目标任务
接收 Markdown 文本，执行**深度去AI化重写**：
在**绝对保留 Markdown 标记**前提下，消除"翻译腔"、"主持人腔"、"强行悬念"和"逻辑垫话"。

---

## 输出要求（Hard Output）
- **只输出处理后的 Markdown**。
- **不得输出**任何分析、过程、解释。
- 所有 Markdown 标记（标题/加粗/链接/图片/代码/公式）必须原样保留且可用。

---

## 🚫 绝对禁止（Red Flags，触犯即死刑）
> 哪怕输入源包含以下特征，你必须在输出中彻底消除它们。

1) **显性列表依赖（正文段落）**：正文中严禁出现"首先/其次/最后"、"第一/第二"来分段。
2) **连接词过载**：严禁使用"此外/另外/总而言之/综上所述/值得注意的是"。
3) **严禁"伪互动"与"强行悬念"（重点拦截）**：
   - **禁止悬念式垫话**："你猜怎么着？"、"结果令人惊讶"、"重点来了"、"更绝的是"、"这还不算完"。——**直接说事，别卖关子。**
   - **禁止命令读者**："想想看"、"试想一下"、"你可能会问"、"要知道"、"不难发现"、"大家可以关注一下"。
   - **禁止设问/反问过渡**："这是为什么呢？因为…"、"结果呢？…"、"那该怎么办？…"。——**禁止自问自答。**
4) **严禁"口语垫话"**：
   - 删除"其实"、"事实上"、"显而易见"、"毫无疑问"、"也就是说"。
5) **翻译腔与被动语态**：禁止"被…所…"、"通过…进行…"。

---

## ✅ 写作原则（Natural Language Guidelines）

### 1) 节奏与质感
- **拒绝"水词"**：不要为了连贯而加词。如果是两层意思，就用句号隔开，不要强行用"而且/所以"连起来。
- **长短句交替**：短句用于下结论/转折，长句用于铺陈。

### 2) 真正的"人话"（Anti-Host Tone）
- **去"主持人感"**：不要像综艺主持或科普视频博主那样说话。
  - ❌ *AI喜欢*：让我们来看看这是为什么。
  - ✅ *人类写法*：原因很简单。
- **去"讲故事感"**：不要强行制造戏剧性。
  - ❌ *AI喜欢*：还有这种操作...结果你猜怎么着？它失败了。
  - ✅ *人类写法*：这操作根本行不通，直接失败。
- **口语化≠啰嗦**：
  - ❌ *AI喜欢*：我们需要利用这个工具来完成任务。
  - ✅ *人类写法*：得用这工具干活。

### 3) 段落融合策略
- **合并碎句**：AI生成的文本往往句子很碎，请将逻辑相关的碎句合并成一个紧凑的段落。
- **保留呼吸**：仅在话题通过强转折或大切换时换行。

---

## 深度润色示例（Few-Shot）

### 结构保护
- 标题、列表符、引用块、分割线、代码块、公式：**物理结构保留，仅修改内部文字**。

### 改写示例

**示例1（消除列表与连接词）**
> 输入：首先，我们需要下载。其次，配置它。最后，运行。综上所述，这很重要。
> 输出：先下载，配置好，再运行。这一步至关重要。

**示例2（去除伪互动、悬念与垫话 - 重点）**
> 输入：**想想看**，如果不复盘，会发生什么？**结果你猜怎么着？**错误重复了。**其实**，这**意味着**浪费时间。**你可能会问**，怎么复盘？
> 输出：不复盘，错误就会重复，纯属浪费时间。至于复盘的方法，往下看。

**示例3（去除翻译腔）**
> 输入：该项目**被**很多开发者**所**喜爱。**通过**使用它，可以**进行**快速开发。
> 输出：这项目很受开发者欢迎，用它能开发得更快。

---

## 现在开始
请对【输入的Markdown文本】执行深度去AI化润色。
**只输出最终 Markdown。**`;

function restoreBoldMarkers(
  output: string,
  source: string
): { text: string; restored: number } {
  const phrases = extractBoldPhrases(source);
  if (phrases.length === 0) {
    return { text: output, restored: 0 };
  }

  let updated = output;
  let restored = 0;

  for (const phrase of phrases) {
    const target = `**${phrase}**`;
    if (updated.includes(target)) {
      continue;
    }

    const index = updated.indexOf(phrase);
    if (index === -1) {
      continue;
    }

    updated = updated.replace(phrase, target);
    restored += 1;
  }

  return { text: updated, restored };
}

function extractBoldPhrases(markdown: string): string[] {
  const withoutCode = markdown
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]*`/g, "");
  const matches = Array.from(withoutCode.matchAll(/\*\*(.+?)\*\*/g));
  const phrases = matches.map(match => match[1]).filter(Boolean);

  return Array.from(new Set(phrases));
}

function ensureImagePlaceholders(
  markdown: string,
  imageCount: number
): { text: string; added: number } {
  if (imageCount <= 0) {
    return { text: markdown, added: 0 };
  }

  const matches = Array.from(markdown.matchAll(/!\[.*?\]\((\d+)\)/g));
  const used = new Set<number>();
  for (const match of matches) {
    const index = Number.parseInt(match[1], 10);
    if (!Number.isNaN(index)) {
      used.add(index);
    }
  }

  const missing: number[] = [];
  for (let i = 0; i < imageCount; i += 1) {
    if (!used.has(i)) {
      missing.push(i);
    }
  }

  if (missing.length === 0) {
    return { text: markdown, added: 0 };
  }

  const suffix = missing
    .map(index => `![配图${index + 1}](${index})`)
    .join("\n\n");

  return {
    text: `${markdown.trimEnd()}\n\n${suffix}\n`,
    added: missing.length
  };
}

/**
 * 获取默认输出路径
 */
function getDefaultOutputPath(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const runId = `article-${timestamp}`;
  return join(process.cwd(), "output", runId);
}
