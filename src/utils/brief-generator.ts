/**
 * Brief 生成器
 *
 * 职责: 将研究结果渲染为 Markdown 格式的 Brief
 *
 * 设计原则:
 * - 清晰的模板结构
 * - 数据驱动渲染
 * - 可读性优先
 * - 内容创作视角（为写作者服务）
 *
 * 参考: research-workflow skill
 */

import type { Finding, Trend } from "./research-scorer.js";

/**
 * Brief 数据结构
 */
export interface BriefData {
  input: string;
  detected_topic: string;
  input_type: "clear" | "ambiguous";
  platform: string[];
  style?: string;
  angle?: string;
  complexity: number;

  // 趋势分析
  trends: Trend[];

  // 研究发现
  key_findings: Finding[];

  // 新增：内容创作视角
  key_insights?: string[];        // 关键洞察
  data_points?: Record<string, string>;  // 数据支撑
  framework?: string;            // 分析框架
  angles?: Angle[];              // 差异化角度
  recommended_angle?: Angle;     // 推荐角度

  // 新增：完整的 Markdown 调研报告（11 部分结构）
  markdown_report?: string;      // LLM 生成的完整报告

  // 元数据
  generated_at: string;
  research_time_ms: number;
}

/**
 * 写作角度
 */
export interface Angle {
  name: string;                  // 角度名称
  core_argument: string;         // 核心论点
  evidence: string[];            // 论据支撑
  differentiation: string;       // 差异化说明
  feasibility: number;          // 可行性评分 (0-10)
}

/**
 * 生成 Brief Markdown（重构版 - 支持完整报告）
 *
 * 优先使用 LLM 生成的完整 Markdown 报告，否则使用简化版本
 *
 * @param data - Brief 数据
 * @returns Markdown 格式的 Brief
 */
export function generateBriefMarkdown(data: BriefData): string {
  // 如果存在完整的 Markdown 报告，直接返回
  if (data.markdown_report) {
    return data.markdown_report;
  }

  // 否则使用原有的简化版本
  const lines: string[] = [];

  // 标题
  lines.push(`# 内容调研报告：${data.detected_topic}\n`);

  // 调研概述
  lines.push("## 调研概述\n");
  lines.push(`- **主题**: ${data.detected_topic}`);
  lines.push(`- **调研时间**: ${data.generated_at.split("T")[0]}`);
  lines.push(`- **时效性窗口**: 近6个月`);
  lines.push(`- **调研深度**: ${data.complexity <= 2 ? "浅层分析" : data.complexity <= 4 ? "中等分析" : "深度分析"}`);
  lines.push("");
  lines.push("---\n");

  // 关键洞察（新增）
  if (data.key_insights && data.key_insights.length > 0) {
    lines.push("## 核心洞察\n");
    data.key_insights.forEach((insight, index) => {
      lines.push(`### ${index + 1}. ${insight.split("：")[0]}`);
      const detail = insight.split("：").slice(1).join("：");
      lines.push("");
      lines.push(detail);
      lines.push("");
      lines.push("---\n");
    });
  }

  // 分析框架（新增）
  if (data.framework) {
    lines.push("## 关键概念框架\n");
    lines.push(`### ${data.framework.split("\n")[0]}`);
    lines.push("");
    lines.push("```");
    data.framework.split("\n").slice(1).forEach(line => {
      lines.push(line);
    });
    lines.push("```");
    lines.push("");
    lines.push("---\n");
  }

  // 数据支撑（新增）
  if (data.data_points && Object.keys(data.data_points).length > 0) {
    lines.push("## 数据引用清单\n");
    Object.entries(data.data_points).forEach(([key, value]) => {
      lines.push(`${key}. ${value}`);
    });
    lines.push("");
    lines.push("---\n");
  }

  // 核心发现（重构）
  if (data.key_findings.length > 0) {
    lines.push("## 核心发现\n");
    lines.push("");

    // 按置信度分组
    const facts = data.key_findings.filter(f => f.confidence_type === "FACT");
    const beliefs = data.key_findings.filter(f => f.confidence_type === "BELIEF");
    const contradictions = data.key_findings.filter(f => f.confidence_type === "CONTRADICTION");
    const assumptions = data.key_findings.filter(f => f.confidence_type === "ASSUMPTION");

    let index = 1;

    if (facts.length > 0) {
      facts.forEach((finding) => {
        lines.push(`### ${index}. ${finding.claim.substring(0, 50)}...`);
        lines.push("");
        lines.push(formatFindingWithInsights(finding));
        lines.push("");
        lines.push("---\n");
        index++;
      });
    }

    if (beliefs.length > 0) {
      beliefs.forEach((finding) => {
        lines.push(`### ${index}. ${finding.claim.substring(0, 50)}...`);
        lines.push("");
        lines.push(formatFindingWithInsights(finding));
        lines.push("");
        lines.push("---\n");
        index++;
      });
    }

    if (contradictions.length > 0) {
      contradictions.forEach((finding) => {
        lines.push(`### ${index}. ${finding.claim.substring(0, 50)}...`);
        lines.push("");
        lines.push(formatFindingWithInsights(finding));
        lines.push("");
        lines.push("---\n");
        index++;
      });
    }

    if (assumptions.length > 0) {
      assumptions.forEach((finding) => {
        lines.push(`### ${index}. ${finding.claim.substring(0, 50)}...`);
        lines.push("");
        lines.push(formatFindingWithInsights(finding));
        lines.push("");
        lines.push("---\n");
        index++;
      });
    }
  }

  // 差异化角度建议（新增）
  if (data.angles && data.angles.length > 0) {
    lines.push("## 差异化角度建议\n");
    data.angles.forEach((angle, index) => {
      lines.push(`### 角度${index + 1}：${angle.name}`);
      lines.push(`- 核心论点：${angle.core_argument}`);
      lines.push(`- 论据支撑：${angle.evidence.slice(0, 2).join("、")}${angle.evidence.length > 2 ? " 等" : ""}`);
      lines.push(`- 差异化：${angle.differentiation}`);
      lines.push(`- 可行性评分：${"⭐".repeat(Math.round(angle.feasibility / 2))} (${angle.feasibility}/10)`);
      lines.push("");
    });
    lines.push("---\n");
  }

  // 推荐写作角度（新增）
  if (data.recommended_angle) {
    lines.push("## 推荐写作角度\n");
    lines.push(`**推荐：${data.recommended_angle.name}**\n`);
    lines.push("**理由**:");
    lines.push(`1. ${data.recommended_angle.core_argument}`);
    if (data.recommended_angle.evidence.length > 0) {
      lines.push(`2. 论据支撑：${data.recommended_angle.evidence.join("、")}`);
    }
    if (data.recommended_angle.differentiation) {
      lines.push(`3. 差异化价值：${data.recommended_angle.differentiation}`);
    }
    lines.push("");
    lines.push("---\n");
  }

  // 后续步骤（新增）
  lines.push("## 后续步骤\n");
  lines.push(`1. ✅ 使用推荐角度「${data.recommended_angle?.name || "待定"}」开始创作`);
  lines.push(`2. 或查看其他角度方案，手动选择一个`);
  lines.push("");
  lines.push("---\n");

  // 参考资料
  lines.push("## 参考资料\n");
  const allSources = new Map<string, { title: string; url: string; date?: Date | string }>();
  data.key_findings.forEach(finding => {
    finding.sources.forEach(source => {
      allSources.set(source.url, {
        title: source.title,
        url: source.url,
        date: source.date
      });
    });
  });
  Array.from(allSources.values()).forEach((source, index) => {
    let dateStr = "";
    if (source.date) {
      if (source.date instanceof Date) {
        dateStr = ` (${source.date.toISOString().split("T")[0]})`;
      } else {
        dateStr = ` (${source.date})`;
      }
    }
    lines.push(`${index + 1}. [${source.title}](${source.url})${dateStr}`);
  });
  lines.push("");

  // 元数据
  lines.push("---\n");
  lines.push(`**生成时间**: ${data.generated_at}`);
  lines.push(`**研究耗时**: ${(data.research_time_ms / 1000).toFixed(2)}s`);
  lines.push("");

  return lines.join("\n");
}

/**
 * 格式化单个发现（带关键洞察）
 */
function formatFindingWithInsights(finding: Finding): string {
  const lines: string[] = [];

  // 置信度标签（使用参考文件的格式）
  const confidenceType = finding.confidence_type === "FACT" ? "FACT" :
                         finding.confidence_type === "BELIEF" ? "BELIEF" :
                         finding.confidence_type === "CONTRADICTION" ? "CONTRADICTION" :
                         finding.confidence_type === "ASSUMPTION" ? "ASSUMPTION" : "BELIEF";

  const confPercent = (finding.confidence_score * 100).toFixed(0);

  lines.push(`[${confidenceType} | conf: ${confPercent}] ${finding.claim}`);
  lines.push("");

  // 来源列表
  if (finding.sources.length > 0) {
    const firstSource = finding.sources[0];
    let dateStr = "无日期";
    if (firstSource.date) {
      if (firstSource.date instanceof Date) {
        dateStr = firstSource.date.toISOString().split("T")[0];
      } else {
        dateStr = firstSource.date;
      }
    }
    lines.push(`→ [${firstSource.title}](${firstSource.url}) — (${getSourceDomain(firstSource.url)}, ${dateStr})`);

    if (finding.cross_verified) {
      lines.push(`验证: 由 ${finding.sources.length} 个独立来源确认`);
    }
  }

  lines.push("");

  // 尝试提取关键洞察（从 claim 中）
  const insights = extractInsightsFromClaim(finding.claim);
  if (insights.length > 0) {
    lines.push("**关键洞察**:");
    insights.forEach(insight => {
      lines.push(`- ${insight}`);
    });
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * 从声明中提取关键洞察
 */
function extractInsightsFromClaim(claim: string): string[] {
  const insights: string[] = [];

  // 简单的启发式规则提取洞察
  if (claim.includes("陷阱") || claim.includes("困境") || claim.includes("悖论")) {
    insights.push("识别核心矛盾或困境");
  }
  if (claim.includes("增长") || claim.includes("下降") || claim.includes("%")) {
    insights.push("提取数据变化趋势");
  }
  if (claim.includes("vs") || claim.includes("对比") || claim.includes("相比")) {
    insights.push("对比分析关键差异");
  }

  return insights;
}

/**
 * 获取来源域名
 */
function getSourceDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace("www.", "");
  } catch {
    return "未知来源";
  }
}

/**
 * 生成摘要
 *
 * @param data - Brief 数据
 * @returns 摘要文本
 */
export function generateBriefSummary(data: BriefData): string {
  const lines: string[] = [];

  lines.push(`主题: ${data.detected_topic}`);
  lines.push(`找到 ${data.key_findings.length} 个关键发现`);
  lines.push(`发现 ${data.trends.length} 个相关趋势`);

  const factCount = data.key_findings.filter(f => f.confidence_type === "FACT").length;
  if (factCount > 0) {
    lines.push(`其中 ${factCount} 个已验证事实`);
  }

  return lines.join("\n");
}

/**
 * 提取关键要点
 *
 * @param data - Brief 数据
 * @param maxCount - 最大数量
 * @returns 关键要点列表
 */
export function extractKeyPoints(data: BriefData, maxCount: number = 5): string[] {
  // 按置信度排序
  const sorted = [...data.key_findings].sort((a, b) => b.confidence_score - a.confidence_score);

  return sorted.slice(0, maxCount).map(f => f.claim);
}
