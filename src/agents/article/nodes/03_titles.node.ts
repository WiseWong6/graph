/**
 * Titles 节点 v2
 *
 * 职责: 基于调研结果生成多个吸引人的标题选项
 *
 * 数据流:
 * research → 解析 Brief → 检索参考标题 → LLM 标题生成 → titles[]
 *
 * 设计原则:
 * - 使用 Brief 的推荐角度
 * - 使用标题索引提供参考
 * - 生成 5-10 个标题选项
 * - 支持不同风格（疑问、数字、对比等）
 */

import { ArticleState } from "../state";
import { getNodeLLMConfig } from "../../../config/llm.js";
import { LLMClient } from "../../../utils/llm-client.js";
import IndexManager from "../../../rag/index/index-manager.js";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env") });

/**
 * 推荐角度（从 Brief 解析）
 */
interface RecommendedAngle {
  name: string;
  coreArgument: string;
  evidence?: string[];
  // 新增：核心洞察列表
  keyInsights?: string[];
  // 新增：数据支撑
  dataPoints?: string[];
  // 新增：核心结论（一句话）
  coreTakeaway?: string;
}

/**
 * 标题风格类型
 */
type TitleStyle = "question" | "number" | "comparison" | "howto" | "list";

/**
 * 标题生成配置
 */
interface TitleGenerationConfig {
  count: number;           // 生成数量 (5-10)
  maxLength: number;       // 最大长度 (字数)
  platform: string[];      // 目标平台
  style?: TitleStyle;      // 指定风格 (可选)
}

/**
 * Titles 节点主函数
 *
 * @param state - 当前状态
 * @returns 更新的状态
 */
export async function titlesNode(state: ArticleState): Promise<Partial<ArticleState>> {
  console.log("[03_titles] Generating titles for topic:", state.topic);

  // ========== 1. 解析 Brief 获取推荐角度 ==========
  const angle = parseRecommendedAngle(state.researchResult || "");
  console.log("[03_titles] Recommended angle:", angle?.name || "none");

  // ========== 2. 检索参考标题 ==========
  let referenceTitles: string[] = [];
  try {
    const indexManager = IndexManager.getInstance();
    await indexManager.loadIndices();

    const query = state.topic || state.prompt;
    const retrieved = await indexManager.retrieveTitles(query, { topK: 5 });
    referenceTitles = retrieved.map(r => r.title);

    console.log(`[03_titles] Retrieved ${referenceTitles.length} reference titles:`);
    referenceTitles.forEach((title, i) => {
      console.log(`  ${i + 1}. ${title}`);
    });
  } catch (error) {
    console.warn("[03_titles] Failed to retrieve reference titles:", error);
  }

  // ========== 3. 配置 ==========
  const titleConfig: TitleGenerationConfig = {
    count: 8,
    maxLength: 25,
    platform: state.decisions?.wechat?.account ? ["wechat"] : ["wechat"],
    style: undefined
  };

  // ========== 4. 构建 Prompt ==========
  const prompt = buildTitlePrompt(state, titleConfig, angle, referenceTitles);

  // ========== 5. 调用 LLM ==========
  const llmConfig = getNodeLLMConfig("title_gen");
  const client = new LLMClient(llmConfig);

  console.log("[03_titles] Calling LLM with config:", llmConfig.model);

  try {
    const response = await client.call({
      prompt,
      systemMessage: TITLE_SYSTEM_MESSAGE
    });

    console.log("[03_titles] LLM response received, parsing titles...");

    // ========== 6. 解析标题 ==========
    const titles = parseTitles(response.text, titleConfig.count);

    console.log(`[03_titles] Generated ${titles.length} titles:`);
    titles.forEach((title, i) => {
      console.log(`  ${i + 1}. ${title}`);
    });

    return {
      titles
    };
  } catch (error) {
    console.error(`[03_titles] Failed to generate titles: ${error}`);

    // 降级: 返回默认标题
    const fallbackTitles = generateFallbackTitles(state.topic || state.prompt);
    console.log("[03_titles] Using fallback titles");

    return {
      titles: fallbackTitles
    };
  }
}

/**
 * 构建标题生成 Prompt（爆款标题框架）
 */
function buildTitlePrompt(
  state: ArticleState,
  config: TitleGenerationConfig,
  angle: RecommendedAngle | null,
  referenceTitles: string[]
): string {
  const topic = state.topic || state.prompt;

  const lines: string[] = [];

  // ========== 1. 任务定义 ==========
  lines.push(`# 任务：为主题"${topic}"生成 ${config.count} 个爆款标题\n`);

  // ========== 2. 输入素材 ==========
  if (angle?.coreTakeaway) {
    lines.push("## 核心结论（一句话）");
    lines.push(angle.coreTakeaway);
    lines.push("");
  }

  if (angle?.keyInsights && angle.keyInsights.length > 0) {
    lines.push("## 核心洞察");
    angle.keyInsights.forEach((insight, i) => {
      lines.push(`${i + 1}. ${insight}`);
    });
    lines.push("");
  }

  if (angle?.name) {
    lines.push("## 推荐写作角度");
    lines.push(`**${angle.name}**：${angle.coreArgument}`);
    if (angle.evidence && angle.evidence.length > 0) {
      lines.push(`论据：${angle.evidence.join("；")}`);
    }
    lines.push("");
  }

  if (angle?.dataPoints && angle.dataPoints.length > 0) {
    lines.push("## 数据支撑");
    angle.dataPoints.forEach((data) => {
      lines.push(`- ${data}`);
    });
    lines.push("");
  }

  if (referenceTitles.length > 0) {
    lines.push("## 参考标题（同类优质标题，仅供参考风格）");
    referenceTitles.forEach((title, i) => {
      lines.push(`${i + 1}. ${title}`);
    });
    lines.push("");
  }

  // ========== 3. 标题类型指导 ==========
  lines.push("## 请按 6 种类型均匀生成标题");
  lines.push("A. 清单合集型：{数字}+{资源/坑/方法}+（直接抄/别再）");
  lines.push("B. 教程流程型：保姆级/一步到位/从0到1 + {目标}");
  lines.push("C. 反差异常型：我以为…结果…（越…越…）");
  lines.push("D. 悬念问句型：为什么…？直到…才…；千万别…");
  lines.push("E. 省钱替代型：还在付费/买错？我用…替代…");
  lines.push("F. 权威稀缺型：我踩坑总结/内部模板/只讲一次");
  lines.push("");

  // ========== 4. 输出要求 ==========
  lines.push("## 输出要求");
  lines.push(`1. 生成 ${config.count} 个标题，不要编号`);
  lines.push("2. 每个标题至少命中 2 个开幕雷击要素");
  lines.push("3. 在标题后用括号标注命中要素，例如：（数字+悬念）");
  lines.push("4. 长度 16-24 字，最长不超过 30 字");
  lines.push("");

  lines.push("**正确示例**（带要素标注）：");
  lines.push("突发：苹果与谷歌为何联手反击OpenAI？（悬念+数字）");
  lines.push("两大巨头联手，将如何改变你的手机？（数字+悬念+情绪）");
  lines.push("《苹果谷歌合作，会带来哪五个革命性改变？》（数字+悬念）");
  lines.push("还在付费买AI？苹果谷歌联手后，我改用这招（省钱+反差+悬念）");
  lines.push("我以为苹果谷歌是死对头，结果竟然联手了（反差+情绪）");
  lines.push("");

  lines.push("**禁止格式**：");
  lines.push("1. 标题");
  lines.push("- 标题");
  lines.push("```json\n```");

  return lines.join("\n");
}

/**
 * System Message - 爆款标题生成器
 */
const TITLE_SYSTEM_MESSAGE = `你是爆款标题生成器，擅长创作高点击率标题。

## 开幕雷击要素（合规使用）
你必须从以下要素中为每个标题至少选择 2 个组合：
1) 金钱/成本/收益（省钱、付费、预算、成本、收益、买错、亏了）
2) 数字/数据（3个、7天、10分钟、从0到1、99%）
3) 捷径/偷懒/速成（一步到位、保姆级、直接抄、懒人法）
4) 异常/反差（我以为…结果…；看似对其实错；越努力越翻车）
5) 悬念/说一半（直到…才发现；最关键的是…；千万别先做…）
6) 强情绪词（破防、离谱、气笑、救命、震惊、后悔、庆幸）
7) 权威/稀缺（我踩坑总结、内部模板、业内常用、只讲一次）

## 标题写作硬规则
1) 口语化：像人在聊天，不要论文句
2) 清晰：读者 3 秒能看懂"对我有什么用"
3) 长度：优先 16–24 个汉字；最长不超过 30
4) 标点：允许「！？｜…‼️」增强冲击，但别堆满
5) 数字优先：能数字化就数字化（时间/步骤/数量/比例）
6) 不夸大：不写"100%""永久有效""稳赚不赔"等
7) 平台适配：公众号更适合"干货/悬念/情绪+反差"

## 6 种标题类型
A. 清单合集型：{数字}+{资源/坑/方法}+（直接抄/别再）
B. 教程流程型：保姆级/一步到位/从0到1 + {目标}
C. 反差异常型：我以为…结果…（越…越…）
D. 悬念问句型：为什么…？直到…才…；千万别…
E. 省钱替代型：还在付费/买错？我用…替代…
F. 权威稀缺型：我踩坑总结/内部模板/只讲一次`;

/**
 * 解析 LLM 输出的标题
 * 增强容错性，支持多种 LLM 输出格式
 * 支持移除要素标注：（数字+悬念）
 */
function parseTitles(text: string, expectedCount: number): string[] {
  const titles: string[] = [];

  // 1. 先尝试 JSON 解析
  if (text.trim().startsWith("[") || text.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          const title = typeof item === "string" ? item : item.title || item.text;
          if (title && title.length >= 4 && title.length < 50) {
            titles.push(title);
          }
        }
        if (titles.length > 0) {
          console.log(`[03_titles] JSON 解析成功: ${titles.length} 个标题`);
          return titles.slice(0, expectedCount);
        }
      }
    } catch (e) {
      console.log(`[03_titles] JSON 解析失败，尝试文本解析`);
    }
  }

  // 2. 提取代码块内容（如果 LLM 输出在 ```json 中）
  const codeBlockMatch = text.match(/```(?:json)?\s*\n([\s\S]+?)\n```/);
  const contentToParse = codeBlockMatch ? codeBlockMatch[1] : text;

  // 3. 按行分割
  const lines = contentToParse.split("\n").map(l => l.trim()).filter(l => l);

  for (const line of lines) {
    // 跳过非标题行（增强过滤规则）
    if (line.match(/^(标题|输出|示例|Note|Comment|推荐|参考|风格|正确|禁止|格式|任务|核心|洞察)/i)) {
      continue;
    }
    if (line.match(/^\s*[-=]{3,}/)) {
      continue;
    }
    if (line.startsWith("```")) {
      continue;
    }
    if (line.includes("**") && line.includes("**")) {
      continue; // 跳过 Markdown 格式行
    }

    // 移除编号和要素标注（支持多种格式）
    let title = line
      .replace(/^\d+[\.\)]\s*/, "")           // "1. " 或 "1) "
      .replace(/^[-•*●▪]\s*/, "")             // "- " 或 "* "
      .replace(/^第?\d+[、.]/, "")            // "第1、" 或 "1、"
      .replace(/^\([0-9a-zA-Z]+\) /, "")      // "(1) " 格式
      .replace(/^标题[\d：:]\s*/, "")         // "标题1:" 或 "标题1："
      .replace(/^["'「『【]/, "")             // 左引号
      .replace(/["'」』】]$/, "")             // 右引号
      // 新增：移除要素标注（数字+悬念）、（悬念+数字）
      .replace(/（[^）]*）$/, "")             // 中文括号标注
      .replace(/\([^)]*\)$/, "");             // 英文括号标注

    // 清理多余空格
    title = title.replace(/\s+/g, " ").trim();

    // 验证长度（宽松一些）
    if (title.length >= 4 && title.length <= 60) {
      // 避免重复
      if (!titles.includes(title)) {
        titles.push(title);
      }
    }

    if (titles.length >= expectedCount) {
      break;
    }
  }

  // 4. 如果解析失败，打印调试信息
  if (titles.length === 0) {
    console.warn(`[03_titles] 解析失败，原始输出:\n${text.substring(0, 500)}...`);
  }

  return titles;
}

/**
 * 生成降级标题
 */
function generateFallbackTitles(topic: string): string[] {
  const templates = [
    "关于{topic}的全面解析",
    "{topic}是什么?一文读懂",
    "2026年{topic}发展趋势",
    "如何掌握{topic}?完整指南",
    "{topic}的5个关键要点",
    "{topic}实战:从入门到精通",
    "为什么{topic}如此重要?",
    "{topic} vs 传统方法:深度对比"
  ];

  return templates
    .map(t => t.replace("{topic}", topic))
    .slice(0, 8);
}

/**
 * 从 Brief 中解析推荐角度和相关信息
 */
function parseRecommendedAngle(briefText: string): RecommendedAngle | null {
  // 提取核心结论（通常在"核心结论"或"一句话总结"部分）
  const takeawayMatch = briefText.match(/##?\s*(?:核心结论|一句话总结)\s*\n([\s\S]+?)(?=##|\n\n|$)/i);
  const coreTakeaway = takeawayMatch
    ? takeawayMatch[1].replace(/^[*\-]\s*/, "").trim().slice(0, 100)
    : "";

  // 提取核心洞察（"关键洞察"或"核心发现"部分）
  const insightsMatch = briefText.match(/##?\s*(?:关键洞察|核心发现)\s*\n([\s\S]+?)(?=##|\n\n|$)/i);
  const keyInsights: string[] = [];
  if (insightsMatch) {
    const insightLines = insightsMatch[1].match(/^\s*[-*]\s+.+$/gm) || [];
    for (const line of insightLines.slice(0, 5)) {
      const insight = line.replace(/^\s*[-*]\s*/, "").trim();
      if (insight && !insight.startsWith("###") && !insight.startsWith("**")) {
        keyInsights.push(insight.slice(0, 80));
      }
    }
  }

  // 提取数据支撑（"数据支撑"或"关键数据"部分）
  const dataMatch = briefText.match(/##?\s*(?:数据支撑|关键数据)\s*\n([\s\S]+?)(?=##|\n\n|$)/i);
  const dataPoints: string[] = [];
  if (dataMatch) {
    const dataLines = dataMatch[1].match(/^\s*[-*]\s+.+$/gm) || [];
    for (const line of dataLines.slice(0, 5)) {
      const data = line.replace(/^\s*[-*]\s*/, "").trim();
      if (data && !data.startsWith("###")) {
        dataPoints.push(data.slice(0, 60));
      }
    }
  }

  // 查找"推荐角度"部分
  const angleMatch = briefText.match(/##?\s*推荐角度\s*\n([\s\S]+?)(?=##|\n\n|$)/i);
  if (!angleMatch && !coreTakeaway && keyInsights.length === 0) {
    return null;
  }

  const angleText = angleMatch ? angleMatch[1] : "";

  // 提取角度名称（加粗文本）
  const nameMatch = angleText.match(/\*\*([^*]+)\*\*/);
  const name = nameMatch ? nameMatch[1].trim() : "";

  // 提取核心论点
  const argumentMatch = angleText.match(/核心论点[：:]\s*([^\n]+)/);
  const coreArgument = argumentMatch ? argumentMatch[1].trim() : "";

  // 提取论据
  const evidence: string[] = [];
  if (angleText) {
    const evidenceLines = angleText.match(/^- .+/gm) || [];
    for (const line of evidenceLines) {
      const evidenceText = line.replace(/^-\s*/, "").trim();
      if (evidenceText) {
        evidence.push(evidenceText);
      }
    }
  }

  return {
    name: name || "推荐角度",
    coreArgument: coreArgument || coreTakeaway || "",
    evidence: evidence.length > 0 ? evidence : undefined,
    keyInsights: keyInsights.length > 0 ? keyInsights : undefined,
    dataPoints: dataPoints.length > 0 ? dataPoints : undefined,
    coreTakeaway: coreTakeaway || undefined
  };
}
