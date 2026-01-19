/**
 * Prompt Parser Utility
 *
 * 用于解析 LLM 输出中的结构化元数据
 */

/**
 * HKR 评分结果
 */
export interface HKRScore {
  h: number;        // Hook - 好奇心分数
  k: number;        // Knowledge - 新知分数
  r: number;        // Relevance - 相关性分数
  reason_h?: string;  // H 分数理由
  reason_k?: string;  // K 分数理由
  reason_r?: string;  // R 分数理由
}

/**
 * 从 LLM 输出中解析 HKR 评分
 *
 * 新格式：[[HKR]] H=3(理由) K=5(理由) R=4(理由) [[/HKR]]
 * 不兼容旧格式 HKR: H=4, K=5, R=4
 *
 * @param output - LLM 输出的文本
 * @returns HKR 评分对象，如果未找到则返回 null
 */
export function parseHKRScore(output: string): HKRScore | null {
  // 匹配 [[HKR]] ... [[/HKR]] 块
  const blockMatch = output.match(/\[\[HKR\]\](.*?)\[\[\/HKR\]\]/s);
  if (!blockMatch) return null;

  const content = blockMatch[1];

  // 提取 H=3(...) K=5(...) R=4(...)
  const hMatch = content.match(/H\s*=\s*(\d+)\s*\(([^)]*)\)/);
  const kMatch = content.match(/K\s*=\s*(\d+)\s*\(([^)]*)\)/);
  const rMatch = content.match(/R\s*=\s*(\d+)\s*\(([^)]*)\)/);

  if (!hMatch || !kMatch || !rMatch) return null;

  return {
    h: parseInt(hMatch[1], 10),
    k: parseInt(kMatch[1], 10),
    r: parseInt(rMatch[1], 10),
    reason_h: hMatch[2]?.trim() || '',
    reason_k: kMatch[2]?.trim() || '',
    reason_r: rMatch[2]?.trim() || ''
  };
}

/**
 * 计算HKR平均分
 *
 * @param score - HKR 评分对象
 * @returns 平均分 (0-5)
 */
export function getHKRAverage(score: HKRScore): number {
  return ((score.h + score.k + score.r) / 3).toFixed(1) as unknown as number;
}

/**
 * 检查 HKR 评分是否通过阈值
 *
 * @param score - HKR 评分对象
 * @param threshold - 通过阈值 (默认 3.0)
 * @returns 是否通过
 */
export function isHKRPassing(score: HKRScore, threshold: number = 3.0): boolean {
  return score.h >= threshold && score.k >= threshold && score.r >= threshold;
}
