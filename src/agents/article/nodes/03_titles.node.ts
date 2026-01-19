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
import { getPromptTemplate } from "../../../config/llm.js";
import { callLLMWithFallback } from "../../../utils/llm-runner.js";
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
  const topic = state.topic || state.prompt;
  const systemTemplate =
    getPromptTemplate("title_gen_system") ||
    '你是爆款标题生成器。只输出 JSON：{"titles":[...]}';
  const userTemplate =
    getPromptTemplate("title_gen_user") ||
    '主题：{topic}\n平台：{platform}\n生成数量：{count}\n最大字数：{max_length}\n参考标题：\n{reference_titles}\n仅输出 JSON：{"titles":[...]}';

  const vars = {
    topic,
    platform: (titleConfig.platform || []).join(","),
    count: String(titleConfig.count),
    max_length: String(titleConfig.maxLength),
    angle_name: angle?.name || "",
    angle_core_argument: angle?.coreArgument || "",
    core_takeaway: angle?.coreTakeaway || "",
    key_insights: (angle?.keyInsights || []).map((x) => `- ${x}`).join("\n"),
    data_points: (angle?.dataPoints || []).map((x) => `- ${x}`).join("\n"),
    reference_titles: referenceTitles.map((t) => `- ${t}`).join("\n")
  };

  const systemMessage = renderTemplate(systemTemplate, vars);
  const prompt = renderTemplate(userTemplate, vars);

  // ========== 5. 调用 LLM ==========
  console.log("[03_titles] Calling LLM...");

  try {
    const { response, config } = await callLLMWithFallback(
      state.decisions?.selectedModel,
      "title_gen",
      { prompt, systemMessage }
    );

    console.log("[03_titles] LLM model:", config.model);
    console.log("[03_titles] LLM response received, parsing titles...");

    // ========== 6. 解析标题 ==========
    const titles = parseTitles(response.text, titleConfig.count);

    console.log(`[03_titles] Generated ${titles.length} titles:`);
    titles.forEach((title, i) => {
      console.log(`  ${i + 1}. ${title}`);
    });

    // ========== 7. 合并 Brief 中的标题 ==========
    const briefTitles = extractBriefTitles(state.researchResult || "");
    console.log(`[03_titles] Extracted ${briefTitles.length} titles from brief:`);
    briefTitles.forEach((title, i) => {
      console.log(`  [Brief ${i + 1}] ${title}`);
    });

    // 合并并去重
    const allTitles = [...titles, ...briefTitles];
    const uniqueTitles = Array.from(new Set(allTitles));

    console.log(`[03_titles] Total ${uniqueTitles.length} unique titles (after merge)`);

    return {
      titles: uniqueTitles
    };
  } catch (error) {
    console.error(`[03_titles] Failed to generate titles: ${error}`);

    // 降级: 返回默认标题
    const fallbackTitles = generateFallbackTitles(state.topic || state.prompt);
    console.log("[03_titles] Using fallback titles");

    // 仍然尝试提取 Brief 标题
    const briefTitles = extractBriefTitles(state.researchResult || "");
    console.log(`[03_titles] Extracted ${briefTitles.length} titles from brief (fallback mode)`);

    // 合并并去重
    const allTitles = [...fallbackTitles, ...briefTitles];
    const uniqueTitles = Array.from(new Set(allTitles));

    return {
      titles: uniqueTitles
    };
  }
}

/**
 * 构建标题生成 Prompt（爆款标题框架）
 */
function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) => vars[key] ?? "");
}

/**
 * System Message - 爆款标题生成器
 */
/**
 * 解析 LLM 输出的标题
 * 增强容错性，支持多种 LLM 输出格式
 * 支持移除要素标注：（数字+悬念）
 */
function parseTitles(text: string, expectedCount: number): string[] {
  const jsonText = extractJsonText(text);
  if (jsonText) {
    try {
      const parsed = JSON.parse(jsonText);
      const titles = Array.isArray(parsed?.titles) ? parsed.titles : Array.isArray(parsed) ? parsed : [];
      const cleaned = normalizeTitles(titles).slice(0, expectedCount);
      if (cleaned.length > 0) return cleaned;
    } catch {}
  }

  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  return normalizeTitles(lines).slice(0, expectedCount);
}

function extractJsonText(text: string): string | null {
  const codeBlockMatch = text.match(/```(?:json)?\s*\n([\s\S]+?)\n```/);
  const candidate = codeBlockMatch ? codeBlockMatch[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return candidate.slice(start, end + 1).trim();
}

function normalizeTitles(input: any[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    let title = typeof raw === "string" ? raw : raw?.title || raw?.text;
    if (typeof title !== "string") continue;
    title = title
      .trim()
      // 1. 移除 markdown 加粗
      .replace(/\*\*\*/g, "")
      .replace(/\*\*/g, "")
      // 2. 移除序号前缀
      .replace(/^\d+[\.\)]\s*/, "")
      .replace(/^[-•*●▪]\s*/, "")
      .replace(/^第?\d+[、.]\s*/, "")
      .replace(/^标题[\d：:]\s*/, "")
      // 3. 移除书名号《》
      .replace(/^《/, "")
      .replace(/》$/, "")
      // 4. 移除尾部括号注释
      .replace(/（[^）]*）$/, "")
      .replace(/\([^)]*\)$/, "")
      // 5. 移除其他引号
      .replace(/^\s*["'「『【]/, "")
      .replace(/["'」』】]\s*$/, "")
      // 6. 合并空格
      .replace(/\s+/g, " ")
      .trim();

    if (title.length < 4 || title.length > 60) continue;
    if (seen.has(title)) continue;
    seen.add(title);
    out.push(title);
  }
  return out;
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

/**
 * 从 Brief 中提取标题
 *
 * 提取两类标题:
 * 1. 写作角度标题: "### 角度 X：标题内容" -> "标题内容"
 * 2. 标题建议: "1. 《标题》" -> "标题" (去除书名号)
 */
function extractBriefTitles(briefText: string): string[] {
  const titles: string[] = [];

  // 1. 提取写作角度标题
  // 匹配: ### 角度 [数字]：[内容]
  const angleRegex = /###\s*角度\s+\d+[：:]\s*(.+)$/gm;
  let match;
  while ((match = angleRegex.exec(briefText)) !== null) {
    const title = match[1].trim();
    if (title.length > 4 && title.length < 100) {
      titles.push(title);
    }
  }

  // 2. 提取标题建议
  // 匹配: ### 标题建议 部分
  const suggestionsMatch = briefText.match(/###\s*标题建议\s*\n([\s\S]+?)(?=##|\n\n|$)/i);
  if (suggestionsMatch) {
    const suggestionsText = suggestionsMatch[1];
    // 提取列表项: 1. 《标题》 或 1. 标题
    const itemRegex = /^\s*\d+[\.\)]\s*[《「]?(.+?)[》」]?\s*$/gm;
    while ((match = itemRegex.exec(suggestionsText)) !== null) {
      const title = match[1].trim();
      if (title.length > 4 && title.length < 100) {
        titles.push(title);
      }
    }
  }

  // 去重
  return Array.from(new Set(titles));
}
