/**
 * 输入检测器
 *
 * 职责: 分析用户输入,提取关键信息
 *
 * 设计原则:
 * - 一次性判断,避免多层嵌套
 * - 数据驱动,而非逻辑分支
 * - 可测试,可扩展
 */

/**
 * 发布平台类型
 */
export type Platform = "wechat" | "xiaohongshu" | "zhihu" | "all";

/**
 * 输入类型检测结果
 */
export interface InputDetectionResult {
  type: "clear" | "ambiguous";
  topic: string;
  platform: Platform[];
  style?: string;
  angle?: string;
}

/**
 * 平台关键词映射
 *
 * 数据结构优于算法 - 用查表代替 if-else
 */
const PLATFORM_KEYWORDS: Record<string, Platform> = {
  "微信": "wechat",
  "公众号": "wechat",
  "wx": "wechat",
  "小红书": "xiaohongshu",
  "xhs": "xiaohongshu",
  "知乎": "zhihu",
  "zh": "zhihu"
};

/**
 * 风格关键词映射
 */
const STYLE_KEYWORDS = [
  "教程", "指南", "入门", "实战", "案例分析",
  "深度", "解析", "研究", "报告",
  "轻松", "有趣", "幽默", "通俗"
];

/**
 * 角度关键词映射
 */
const ANGLE_KEYWORDS = [
  { pattern: /教程|入门|指南/, angle: "tutorial" },
  { pattern: /案例|实践|应用/, angle: "case_study" },
  { pattern: /深度|解析|原理/, angle: "deep_dive" },
  { pattern: /对比|区别|差异/, angle: "comparison" },
  { pattern: /趋势|发展|未来/, angle: "trend" },
  { pattern: /问题|错误|坑/, angle: "troubleshooting" }
];

/**
 * 检测输入类型
 *
 * @param input - 用户输入
 * @returns 检测结果
 */
export function detectInputType(input: string): InputDetectionResult {
  const trimmed = input.trim();

  // 检测平台
  const platforms = detectPlatforms(trimmed);

  // 检测风格
  const style = detectStyle(trimmed);

  // 检测角度
  const angle = detectAngle(trimmed);

  // 判断输入类型
  const type = judgeInputType(trimmed);

  // 提取主题
  const topic = extractTopic(trimmed);

  return {
    type,
    topic,
    platform: platforms.length > 0 ? platforms : ["wechat"],
    style,
    angle
  };
}

/**
 * 检测发布平台
 */
function detectPlatforms(input: string): Platform[] {
  const platforms: Platform[] = [];

  for (const [keyword, platform] of Object.entries(PLATFORM_KEYWORDS)) {
    if (input.includes(keyword)) {
      platforms.push(platform);
    }
  }

  return platforms;
}

/**
 * 检测文章风格
 */
function detectStyle(input: string): string | undefined {
  for (const keyword of STYLE_KEYWORDS) {
    if (input.includes(keyword)) {
      return keyword;
    }
  }
  return undefined;
}

/**
 * 检测文章角度
 */
function detectAngle(input: string): string | undefined {
  for (const { pattern, angle } of ANGLE_KEYWORDS) {
    if (pattern.test(input)) {
      return angle;
    }
  }
  return undefined;
}

/**
 * 判断输入类型
 *
 * 明确标题: "写一篇关于 XXX 的文章"
 * 模糊想法: "我想写一个关于 XXX 的内容", "有没有 XXX 相关的素材"
 */
function judgeInputType(input: string): "clear" | "ambiguous" {
  const clearPatterns = [
    /写一篇/,
    /写一个/,
    /生成/,
    /创作/
  ];

  const ambiguousPatterns = [
    /我想写/,
    /想做/,
    /有没有/,
    /什么/,
    /怎么/,
    /如何/
  ];

  // 先判断是否明确
  for (const pattern of clearPatterns) {
    if (pattern.test(input)) {
      return "clear";
    }
  }

  // 再判断是否模糊
  for (const pattern of ambiguousPatterns) {
    if (pattern.test(input)) {
      return "ambiguous";
    }
  }

  // 默认为明确
  return "clear";
}

/**
 * 提取核心主题
 *
 * 从输入中提取最关键的主题词
 */
function extractTopic(input: string): string {
  let topic = input;

  // 移除常见的引导词
  const prefixes = [
    /写一篇关于/,
    /写一个关于/,
    /我想写.*关于/,
    /生成.*关于/,
    /创作.*关于/
  ];

  for (const prefix of prefixes) {
    topic = topic.replace(prefix, "");
  }

  // 移除平台关键词
  for (const keyword of Object.keys(PLATFORM_KEYWORDS)) {
    topic = topic.replace(new RegExp(keyword, "g"), "");
  }

  // 移除风格关键词
  for (const keyword of STYLE_KEYWORDS) {
    topic = topic.replace(new RegExp(keyword, "g"), "");
  }

  // 清理并返回
  return topic.trim().replace(/的$|的文章$/, "");
}

/**
 * 分析输入复杂度
 *
 * 返回 1-5 的复杂度评分
 * 1: 单一主题,无特殊要求
 * 5: 多主题,多平台,有特殊要求
 */
export function analyzeComplexity(detection: InputDetectionResult): number {
  let complexity = 1;

  // 平台数量
  if (detection.platform.length > 1) complexity += 1;

  // 有风格要求
  if (detection.style) complexity += 1;

  // 有角度要求
  if (detection.angle) complexity += 1;

  // 模糊输入需要更多分析
  if (detection.type === "ambiguous") complexity += 1;

  return Math.min(complexity, 5);
}
