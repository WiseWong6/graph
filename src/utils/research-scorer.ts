/**
 * Research 置信度计算器
 *
 * 职责: 计算研究发现、趋势的置信度和时效性
 *
 * 设计原则:
 * - 数据驱动,可配置
 * - 清晰的评分标准
 * - 可测试
 */

/**
 * 置信度类型
 */
export type ConfidenceType = "FACT" | "BELIEF" | "CONTRADICTION" | "ASSUMPTION";

/**
 * 信息来源
 */
export interface Source {
  url: string;
  title: string;
  date?: Date;
  domain: string;
}

/**
 * 研究发现
 */
export interface Finding {
  claim: string;
  confidence_type: ConfidenceType;
  confidence_score: number;  // 0.0-1.0
  sources: Source[];
  cross_verified: boolean;
  freshness_status: "current" | "needs_update" | "outdated";
}

/**
 * 趋势信号
 */
export interface Trend {
  topic: string;
  signal_strength: "high" | "medium" | "low";
  growth_rate: string;  // "+65%"
  time_window: string;
  confidence_score: number;
}

/**
 * 时效性窗口类型
 */
export type RecencyWindow = "ai" | "volatile" | "default";

/**
 * 时效性窗口配置 (天数)
 *
 * AI 领域变化快,需要最新信息 (60 天)
 * 快速变化领域需要较新信息 (30 天)
 * 默认情况接受一年内的信息 (365 天)
 */
const RECENCY_WINDOWS: Record<RecencyWindow, number> = {
  ai: 60,
  volatile: 30,
  default: 365
};

/**
 * AI 相关关键词
 */
const AI_KEYWORDS = [
  "AI", "人工智能", "机器学习", "深度学习", "LLM", "大模型",
  "GPT", "Claude", "Agent", "LangChain", "RAG"
];

/**
 * 快速变化领域关键词
 */
const VOLATILE_KEYWORDS = [
  "区块链", "Web3", "crypto", "加密货币",
  "元宇宙", "VR", "AR"
];

/**
 * 计算信息置信度
 *
 * @param finding - 研究发现
 * @returns 置信度评分 (0.0-1.0)
 */
export function calculateConfidence(finding: Finding): number {
  let score = 0.0;

  // 基础分: 来源数量
  const sourceCount = finding.sources.length;
  if (sourceCount >= 2) score += 0.3;
  else if (sourceCount >= 1) score += 0.1;

  // 交叉验证加分
  if (finding.cross_verified) score += 0.3;

  // 来源质量加分 (域名启发式)
  const domainQuality = calculateDomainQuality(finding.sources);
  score += domainQuality * 0.2;

  // 时效性加分
  const freshness = calculateFreshness(finding);
  score += freshness * 0.2;

  return Math.min(score, 1.0);
}

/**
 * 计算时效性评分
 *
 * @param finding - 研究发现
 * @returns 时效性评分 (0.0-1.0)
 */
export function calculateFreshness(finding: Finding): number {
  const now = new Date();
  const sourcesWithDates = finding.sources.filter(s => s.date);

  if (sourcesWithDates.length === 0) {
    return 0.3; // 无日期信息,给较低分
  }

  // 计算平均天数
  const totalDays = sourcesWithDates.reduce((sum, source) => {
    const days = (now.getTime() - (source.date?.getTime() || 0)) / (1000 * 60 * 60 * 24);
    return sum + days;
  }, 0);

  const avgDays = totalDays / sourcesWithDates.length;

  // 根据主题确定时效性窗口
  const window = determineRecencyWindow(finding.claim);
  const maxDays = RECENCY_WINDOWS[window];

  // 计算评分 (越新越高)
  if (avgDays <= maxDays * 0.25) return 1.0;
  if (avgDays <= maxDays * 0.5) return 0.8;
  if (avgDays <= maxDays) return 0.6;
  if (avgDays <= maxDays * 1.5) return 0.4;
  if (avgDays <= maxDays * 2) return 0.2;
  return 0.1;
}

/**
 * 确定时效性窗口类型
 */
function determineRecencyWindow(topic: string): RecencyWindow {
  const lower = topic.toLowerCase();

  for (const keyword of AI_KEYWORDS) {
    if (lower.includes(keyword.toLowerCase())) {
      return "ai";
    }
  }

  for (const keyword of VOLATILE_KEYWORDS) {
    if (lower.includes(keyword.toLowerCase())) {
      return "volatile";
    }
  }

  return "default";
}

/**
 * 计算域名质量
 *
 * 权威域名加分
 */
function calculateDomainQuality(sources: Source[]): number {
  const authoritativeDomains = [
    "edu", "gov", "org",
    "nature.com", "science.org", "ieee.org",
    "arxiv.org", "scholar.google.com"
  ];

  let qualityScore = 0.0;
  for (const source of sources) {
    for (const authDomain of authoritativeDomains) {
      if (source.domain.includes(authDomain)) {
        qualityScore += 0.5;
        break;
      }
    }
  }

  return Math.min(qualityScore / sources.length, 1.0);
}

/**
 * 计算趋势信号强度
 *
 * @param trend - 趋势数据
 * @returns 信号强度
 */
export function calculateSignalStrength(trend: Trend): "high" | "medium" | "low" {
  // 基于增长率和置信度判断
  const growthMatch = trend.growth_rate.match(/([+\-]?\d+)/);
  if (!growthMatch) return "low";

  const growth = parseInt(growthMatch[1]);
  const confidence = trend.confidence_score;

  if (confidence >= 0.8 && Math.abs(growth) >= 50) return "high";
  if (confidence >= 0.6 && Math.abs(growth) >= 20) return "medium";
  return "low";
}

/**
 * 判断信息是否需要交叉验证
 *
 * @param claim - 声明内容
 * @returns 是否需要交叉验证
 */
export function needsCrossVerification(claim: string): boolean {
  // 数字、百分比、具体数据需要验证
  const needsVerificationPatterns = [
    /\d+%/,
    /\d+\s*(万|亿|千|million|billion)/i,
    /增长.*\d+/,
    /下降.*\d+/,
    /研究表明/,
    /数据显示/
  ];

  return needsVerificationPatterns.some(pattern => pattern.test(claim));
}

/**
 * 检测信息矛盾
 *
 * @param findings - 多个研究发现
 * @returns 是否存在矛盾
 */
export function detectContradictions(findings: Finding[]): boolean {
  // 简化版: 检查相反的关键词
  const contradictKeywords = [
    ["增长", "下降"],
    ["成功", "失败"],
    ["有效", "无效"],
    ["支持", "反对"]
  ];

  const claims = findings.map(f => f.claim.toLowerCase());

  for (const [word1, word2] of contradictKeywords) {
    const hasWord1 = claims.some(c => c.includes(word1));
    const hasWord2 = claims.some(c => c.includes(word2));
    if (hasWord1 && hasWord2) {
      return true;
    }
  }

  return false;
}

/**
 * 推断置信度类型
 *
 * @param finding - 研究发现
 * @returns 置信度类型
 */
export function inferConfidenceType(finding: Finding): ConfidenceType {
  if (detectContradictions([finding])) {
    return "CONTRADICTION";
  }

  if (finding.sources.length === 0) {
    return "ASSUMPTION";
  }

  if (finding.cross_verified && finding.confidence_score >= 0.8) {
    return "FACT";
  }

  if (finding.sources.length >= 1) {
    return "BELIEF";
  }

  return "ASSUMPTION";
}
