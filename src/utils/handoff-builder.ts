/**
 * Handoff 构建器
 *
 * 职责: 生成结构化的 Handoff YAML 文件,供后续节点使用
 *
 * 设计原则:
 * - 清晰的数据结构
 * - 可序列化
 * - 向后兼容
 */

import type { Finding, Trend } from "./research-scorer.js";
import type { InputDetectionResult } from "./input-detector.js";

/**
 * Handoff 数据结构
 */
export interface HandoffData {
  version: string;
  generated_at: string;

  // 输入分析
  input: {
    original: string;
    detected_topic: string;
    type: "clear" | "ambiguous";
    platform: string[];
    style?: string;
    angle?: string;
    complexity: number;
  };

  // 趋势分析
  trends: Trend[];

  // 关键发现
  findings: Finding[];

  // 提取的关键要点
  key_points: string[];

  // 推荐角度
  recommended_angles: string[];

  // 元数据
  metadata: {
    research_time_ms: number;
    sources_count: number;
    confidence_avg: number;
  };
}

/**
 * 构建 Handoff 数据
 *
 * @param input - 输入检测结果
 * @param trends - 趋势列表
 * @param findings - 研究发现列表
 * @param researchTimeMs - 研究耗时
 * @returns Handoff 数据
 */
export function buildHandoff(
  input: InputDetectionResult,
  trends: Trend[],
  findings: Finding[],
  researchTimeMs: number
): HandoffData {
  // 计算平均置信度
  const confidenceAvg = findings.length > 0
    ? findings.reduce((sum, f) => sum + f.confidence_score, 0) / findings.length
    : 0;

  // 统计来源数量
  const sourcesCount = findings.reduce((sum, f) => sum + f.sources.length, 0);

  // 提取关键要点
  const keyPoints = findings
    .sort((a, b) => b.confidence_score - a.confidence_score)
    .slice(0, 5)
    .map(f => f.claim);

  // 推荐角度
  const recommendedAngles = recommendAngles(input, findings);

  return {
    version: "2.0",
    generated_at: new Date().toISOString(),

    input: {
      original: input.topic,
      detected_topic: input.topic,
      type: input.type,
      platform: input.platform,
      style: input.style,
      angle: input.angle,
      complexity: calculateComplexity(input)
    },

    trends,
    findings,

    key_points: keyPoints,
    recommended_angles: recommendedAngles,

    metadata: {
      research_time_ms: researchTimeMs,
      sources_count: sourcesCount,
      confidence_avg: confidenceAvg
    }
  };
}

/**
 * 计算复杂度
 */
function calculateComplexity(input: InputDetectionResult): number {
  let complexity = 1;

  if (input.platform.length > 1) complexity += 1;
  if (input.style) complexity += 1;
  if (input.angle) complexity += 1;
  if (input.type === "ambiguous") complexity += 1;

  return Math.min(complexity, 5);
}

/**
 * 推荐文章角度
 */
function recommendAngles(input: InputDetectionResult, findings: Finding[]): string[] {
  const angles: string[] = [];

  // 基于输入的角度
  if (input.angle) {
    angles.push(formatAngle(input.angle));
  }

  // 基于发现的角度
  const hasData = findings.some(f => f.confidence_type === "FACT" && f.claim.includes("数据"));
  const hasTrend = findings.some(f => f.claim.includes("增长") || f.claim.includes("趋势"));

  if (hasData) angles.push("数据驱动");
  if (hasTrend) angles.push("趋势分析");

  // 默认角度
  if (angles.length === 0) {
    angles.push("入门介绍", "实践指南");
  }

  return angles;
}

/**
 * 格式化角度名称
 */
function formatAngle(angle: string | undefined): string {
  if (!angle) return "通用";

  const angleNames: Record<string, string> = {
    tutorial: "教程指南",
    case_study: "案例分析",
    deep_dive: "深度解析",
    comparison: "对比分析",
    trend: "趋势分析",
    troubleshooting: "问题解决"
  };

  return angleNames[angle] || angle;
}

/**
 * 将 Handoff 转换为 YAML
 *
 * @param handoff - Handoff 数据
 * @returns YAML 字符串
 */
export function handoffToYaml(handoff: HandoffData): string {
  const lines: string[] = [];

  lines.push(`# Research Handoff v${handoff.version}`);
  lines.push(`# Generated: ${handoff.generated_at}`);
  lines.push("");

  // 输入分析
  lines.push("input:");
  lines.push(`  original: "${escapeYaml(handoff.input.original)}"`);
  lines.push(`  detected_topic: "${escapeYaml(handoff.input.detected_topic)}"`);
  lines.push(`  type: ${handoff.input.type}`);
  lines.push(`  platform:`);
  for (const platform of handoff.input.platform) {
    lines.push(`    - ${platform}`);
  }
  if (handoff.input.style) {
    lines.push(`  style: "${escapeYaml(handoff.input.style)}"`);
  }
  if (handoff.input.angle) {
    lines.push(`  angle: "${escapeYaml(handoff.input.angle)}"`);
  }
  lines.push(`  complexity: ${handoff.input.complexity}`);
  lines.push("");

  // 趋势
  if (handoff.trends.length > 0) {
    lines.push("trends:");
    for (const trend of handoff.trends) {
      lines.push(`  - topic: "${escapeYaml(trend.topic)}"`);
      lines.push(`    signal_strength: ${trend.signal_strength}`);
      lines.push(`    growth_rate: ${trend.growth_rate}`);
      lines.push(`    time_window: ${trend.time_window}`);
      lines.push(`    confidence_score: ${trend.confidence_score}`);
    }
    lines.push("");
  }

  // 关键要点
  if (handoff.key_points.length > 0) {
    lines.push("key_points:");
    for (const point of handoff.key_points) {
      lines.push(`  - "${escapeYaml(point)}"`);
    }
    lines.push("");
  }

  // 推荐角度
  if (handoff.recommended_angles.length > 0) {
    lines.push("recommended_angles:");
    for (const angle of handoff.recommended_angles) {
      lines.push(`  - "${escapeYaml(angle)}"`);
    }
    lines.push("");
  }

  // 元数据
  lines.push("metadata:");
  lines.push(`  research_time_ms: ${handoff.metadata.research_time_ms}`);
  lines.push(`  sources_count: ${handoff.metadata.sources_count}`);
  lines.push(`  confidence_avg: ${handoff.metadata.confidence_avg.toFixed(3)}`);

  return lines.join("\n");
}

/**
 * YAML 字符串转义
 */
function escapeYaml(str: string): string {
  return str
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
}

/**
 * 从 YAML 解析 Handoff
 *
 * @param _yaml - YAML 字符串
 * @returns Handoff 数据
 *
 * TODO: 实现 YAML 解析器
 */
export function handoffFromYaml(_yaml: string): HandoffData {
  // 简化版: 使用 js-yaml 库
  // const yaml = require('js-yaml');
  // return yaml.load(yaml) as HandoffData;

  throw new Error("handoffFromYaml not yet implemented");
}
