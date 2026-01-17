/**
 * Titles 节点
 *
 * 职责: 基于调研结果生成多个吸引人的标题选项
 *
 * 数据流:
 * research → key_findings → LLM 标题生成 → titles[]
 *
 * 设计原则:
 * - 生成 5-10 个标题选项
 * - 支持不同风格（疑问、数字、对比等）
 * - 突出差异化价值
 */

import { ArticleState } from "../state";
import { getNodeLLMConfig } from "../../../config/llm.js";
import { LLMClient } from "../../../utils/llm-client.js";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env") });

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

  // ========== 配置 ==========
  const titleConfig: TitleGenerationConfig = {
    count: 8,
    maxLength: 25,
    platform: state.decisions?.wechat?.account ? ["wechat"] : ["wechat"],
    style: undefined // 不指定风格,让 LLM 自由发挥
  };

  // ========== 构建 Prompt ==========
  const prompt = buildTitlePrompt(state, titleConfig);

  // ========== 调用 LLM ==========
  const llmConfig = getNodeLLMConfig("title_gen");
  const client = new LLMClient(llmConfig);

  console.log("[03_titles] Calling LLM with config:", llmConfig.model);

  try {
    const response = await client.call({
      prompt,
      systemMessage: TITLE_SYSTEM_MESSAGE
    });

    console.log("[03_titles] LLM response received, parsing titles...");

    // ========== 解析标题 ==========
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
function buildTitlePrompt(state: ArticleState, config: TitleGenerationConfig): string {
  const topic = state.topic || state.prompt;

  // 提取关键要点
  let keyPoints: string[] = [];
  if (state.researchResult) {
    // 简化版: 从 researchResult 中提取要点
    // 实际应该解析 Brief 结构
    keyPoints = [
      "基于最新调研",
      "数据支撑",
      "实用性强"
    ];
  }

  const lines: string[] = [];

  lines.push(`请为主题"${topic}"生成 ${config.count} 个吸引人的标题。\n`);

  if (keyPoints.length > 0) {
    lines.push("参考要点:");
    keyPoints.forEach((point, i) => {
      lines.push(`  ${i + 1}. ${point}`);
    });
    lines.push("");
  }

  lines.push("标题要求:");
  lines.push(`  1. 长度: ${config.maxLength} 字以内`);
  lines.push("  2. 包含数字或疑问词,增加吸引力");
  lines.push("  3. 突出差异化价值");
  lines.push(`  4. 适合发布在 ${config.platform.join(" / ")}`);
  lines.push("");

  lines.push("标题风格参考:");
  lines.push("  - 疑问式: XXX是什么?为什么XXX?");
  lines.push("  - 数字式: X个XXX技巧/方法");
  lines.push("  - 对比式: XXX vs YYY:哪个更好?");
  lines.push("  - 如何式: 如何XXX?XXX的完整指南");
  lines.push("  - 列表式: XXX必知/必做");
  lines.push("");

  lines.push("输出格式:");
  lines.push("请直接输出标题列表,每行一个,不要编号。");
  lines.push("");
  lines.push("示例:");
  lines.push("  AI Agent 是什么?一文读懂自动化未来");
  lines.push("  2026年AI Agent发展报告:从概念到应用");
  lines.push("  10个AI Agent实战案例:企业如何落地");

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
