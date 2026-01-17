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
 * 构建标题生成 Prompt
 */
function buildTitlePrompt(
  state: ArticleState,
  config: TitleGenerationConfig,
  angle: RecommendedAngle | null,
  referenceTitles: string[]
): string {
  const topic = state.topic || state.prompt;

  const lines: string[] = [];

  lines.push(`请为主题"${topic}"生成 ${config.count} 个吸引人的标题。\n`);

  // 推荐角度
  if (angle) {
    lines.push("## 推荐写作角度");
    lines.push(`**${angle.name}**`);
    lines.push(`- 核心观点: ${angle.coreArgument}`);
    if (angle.evidence && angle.evidence.length > 0) {
      lines.push(`- 论据: ${angle.evidence.join("; ")}`);
    }
    lines.push("");
  }

  // 参考标题
  if (referenceTitles.length > 0) {
    lines.push("## 参考标题（同类优质标题）");
    referenceTitles.forEach((title, i) => {
      lines.push(`${i + 1}. ${title}`);
    });
    lines.push("");
  }

  lines.push("## 标题要求");
  lines.push(`  1. 长度: ${config.maxLength} 字以内`);
  lines.push("  2. 包含数字或疑问词,增加吸引力");
  lines.push("  3. 突出差异化价值");
  lines.push(`  4. 适合发布在 ${config.platform.join(" / ")}`);
  if (angle) {
    lines.push(`  5. 体现"${angle.name}"的角度`);
  }
  lines.push("");

  lines.push("## 标题风格参考");
  lines.push("  - 疑问式: XXX是什么?为什么XXX?");
  lines.push("  - 数字式: X个XXX技巧/方法");
  lines.push("  - 对比式: XXX vs YYY:哪个更好?");
  lines.push("  - 如何式: 如何XXX?XXX的完整指南");
  lines.push("  - 列表式: XXX必知/必做");
  lines.push("");

  lines.push("## 输出格式");
  lines.push("请直接输出标题列表,每行一个,不要编号。");
  lines.push("");

  return lines.join("\n");
}

/**
 * System Message
 */
const TITLE_SYSTEM_MESSAGE = `你是一个专业的标题创作专家,擅长为不同平台创作高点击率的标题。

你的核心能力:
- 洞察用户心理,抓住注意力
- 平衡吸引力和准确性
- 针对不同平台优化风格
- 避免标题党,保持价值导向

创作原则:
1. 好标题 = 好奇心 + 价值承诺
2. 开头3个字决定点击率
3. 数字和疑问词提升吸引力
4. 避免夸大和误导`;

/**
 * 解析 LLM 输出的标题
 */
function parseTitles(text: string, expectedCount: number): string[] {
  const titles: string[] = [];

  // 按行分割
  const lines = text.split("\n").map(l => l.trim()).filter(l => l);

  for (const line of lines) {
    // 跳过非标题行
    if (line.match(/^(标题|输出|示例|Note|Comment)/i)) {
      continue;
    }

    // 移除编号
    let title = line.replace(/^\d+[\.\)]\s*/, "");
    title = title.replace(/^[-•*]\s*/, "");
    title = title.replace(/^第?\d+[、.]/, "");

    // 移除引号
    title = title.replace(/^["'「『]|["'」』]$/g, "");

    // 验证长度
    if (title.length > 5 && title.length < 50) {
      titles.push(title);
    }

    if (titles.length >= expectedCount) {
      break;
    }
  }

  // 如果解析失败,返回空数组,触发降级
  return titles.length > 0 ? titles : [];
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
 * 从 Brief 中解析推荐角度
 */
function parseRecommendedAngle(briefText: string): RecommendedAngle | null {
  // 查找"推荐角度"部分
  const angleMatch = briefText.match(/##?\s*推荐角度\s*\n([\s\S]+?)(?=##|\n\n|$)/i);
  if (!angleMatch) return null;

  const angleText = angleMatch[1];

  // 提取角度名称（加粗文本）
  const nameMatch = angleText.match(/\*\*([^*]+)\*\*/);
  const name = nameMatch ? nameMatch[1].trim() : "默认角度";

  // 提取核心论点
  const argumentMatch = angleText.match(/核心论点[：:]\s*([^\n]+)/);
  const coreArgument = argumentMatch ? argumentMatch[1].trim() : "";

  // 提取论据
  const evidence: string[] = [];
  const evidenceLines = angleText.match(/^- .+/gm) || [];
  for (const line of evidenceLines) {
    const evidenceText = line.replace(/^-\s*/, "").trim();
    if (evidenceText) {
      evidence.push(evidenceText);
    }
  }

  if (!name && !coreArgument) {
    return null;
  }

  return {
    name: name || "推荐角度",
    coreArgument: coreArgument || angleText.slice(0, 100),
    evidence: evidence.length > 0 ? evidence : undefined
  };
}
