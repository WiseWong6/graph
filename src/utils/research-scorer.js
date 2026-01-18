"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateConfidence = calculateConfidence;
exports.calculateFreshness = calculateFreshness;
exports.calculateSignalStrength = calculateSignalStrength;
exports.needsCrossVerification = needsCrossVerification;
exports.detectContradictions = detectContradictions;
exports.inferConfidenceType = inferConfidenceType;
/**
 * 时效性窗口配置 (天数)
 *
 * AI 领域变化快,需要最新信息 (60 天)
 * 快速变化领域需要较新信息 (30 天)
 * 默认情况接受一年内的信息 (365 天)
 */
var RECENCY_WINDOWS = {
    ai: 60,
    volatile: 30,
    default: 365
};
/**
 * AI 相关关键词
 */
var AI_KEYWORDS = [
    "AI", "人工智能", "机器学习", "深度学习", "LLM", "大模型",
    "GPT", "Claude", "Agent", "LangChain", "RAG"
];
/**
 * 快速变化领域关键词
 */
var VOLATILE_KEYWORDS = [
    "区块链", "Web3", "crypto", "加密货币",
    "元宇宙", "VR", "AR"
];
/**
 * 计算信息置信度
 *
 * @param finding - 研究发现
 * @returns 置信度评分 (0.0-1.0)
 */
function calculateConfidence(finding) {
    var score = 0.0;
    // 基础分: 来源数量
    var sourceCount = finding.sources.length;
    if (sourceCount >= 2)
        score += 0.3;
    else if (sourceCount >= 1)
        score += 0.1;
    // 交叉验证加分
    if (finding.cross_verified)
        score += 0.3;
    // 来源质量加分 (域名启发式)
    var domainQuality = calculateDomainQuality(finding.sources);
    score += domainQuality * 0.2;
    // 时效性加分
    var freshness = calculateFreshness(finding);
    score += freshness * 0.2;
    return Math.min(score, 1.0);
}
/**
 * 计算时效性评分
 *
 * @param finding - 研究发现
 * @returns 时效性评分 (0.0-1.0)
 */
function calculateFreshness(finding) {
    var now = new Date();
    var sourcesWithDates = finding.sources.filter(function (s) { return s.date; });
    if (sourcesWithDates.length === 0) {
        return 0.3; // 无日期信息,给较低分
    }
    // 计算平均天数
    var totalDays = sourcesWithDates.reduce(function (sum, source) {
        var _a;
        var days = (now.getTime() - (((_a = source.date) === null || _a === void 0 ? void 0 : _a.getTime()) || 0)) / (1000 * 60 * 60 * 24);
        return sum + days;
    }, 0);
    var avgDays = totalDays / sourcesWithDates.length;
    // 根据主题确定时效性窗口
    var window = determineRecencyWindow(finding.claim);
    var maxDays = RECENCY_WINDOWS[window];
    // 计算评分 (越新越高)
    if (avgDays <= maxDays * 0.25)
        return 1.0;
    if (avgDays <= maxDays * 0.5)
        return 0.8;
    if (avgDays <= maxDays)
        return 0.6;
    if (avgDays <= maxDays * 1.5)
        return 0.4;
    if (avgDays <= maxDays * 2)
        return 0.2;
    return 0.1;
}
/**
 * 确定时效性窗口类型
 */
function determineRecencyWindow(topic) {
    var lower = topic.toLowerCase();
    for (var _i = 0, AI_KEYWORDS_1 = AI_KEYWORDS; _i < AI_KEYWORDS_1.length; _i++) {
        var keyword = AI_KEYWORDS_1[_i];
        if (lower.includes(keyword.toLowerCase())) {
            return "ai";
        }
    }
    for (var _a = 0, VOLATILE_KEYWORDS_1 = VOLATILE_KEYWORDS; _a < VOLATILE_KEYWORDS_1.length; _a++) {
        var keyword = VOLATILE_KEYWORDS_1[_a];
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
function calculateDomainQuality(sources) {
    var authoritativeDomains = [
        "edu", "gov", "org",
        "nature.com", "science.org", "ieee.org",
        "arxiv.org", "scholar.google.com"
    ];
    var qualityScore = 0.0;
    for (var _i = 0, sources_1 = sources; _i < sources_1.length; _i++) {
        var source = sources_1[_i];
        for (var _a = 0, authoritativeDomains_1 = authoritativeDomains; _a < authoritativeDomains_1.length; _a++) {
            var authDomain = authoritativeDomains_1[_a];
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
function calculateSignalStrength(trend) {
    // 基于增长率和置信度判断
    var growthMatch = trend.growth_rate.match(/([+\-]?\d+)/);
    if (!growthMatch)
        return "low";
    var growth = parseInt(growthMatch[1]);
    var confidence = trend.confidence_score;
    if (confidence >= 0.8 && Math.abs(growth) >= 50)
        return "high";
    if (confidence >= 0.6 && Math.abs(growth) >= 20)
        return "medium";
    return "low";
}
/**
 * 判断信息是否需要交叉验证
 *
 * @param claim - 声明内容
 * @returns 是否需要交叉验证
 */
function needsCrossVerification(claim) {
    // 数字、百分比、具体数据需要验证
    var needsVerificationPatterns = [
        /\d+%/,
        /\d+\s*(万|亿|千|million|billion)/i,
        /增长.*\d+/,
        /下降.*\d+/,
        /研究表明/,
        /数据显示/
    ];
    return needsVerificationPatterns.some(function (pattern) { return pattern.test(claim); });
}
/**
 * 检测信息矛盾
 *
 * @param findings - 多个研究发现
 * @returns 是否存在矛盾
 */
function detectContradictions(findings) {
    // 简化版: 检查相反的关键词
    var contradictKeywords = [
        ["增长", "下降"],
        ["成功", "失败"],
        ["有效", "无效"],
        ["支持", "反对"]
    ];
    var claims = findings.map(function (f) { return f.claim.toLowerCase(); });
    var _loop_1 = function (word1, word2) {
        var hasWord1 = claims.some(function (c) { return c.includes(word1); });
        var hasWord2 = claims.some(function (c) { return c.includes(word2); });
        if (hasWord1 && hasWord2) {
            return { value: true };
        }
    };
    for (var _i = 0, contradictKeywords_1 = contradictKeywords; _i < contradictKeywords_1.length; _i++) {
        var _a = contradictKeywords_1[_i], word1 = _a[0], word2 = _a[1];
        var state_1 = _loop_1(word1, word2);
        if (typeof state_1 === "object")
            return state_1.value;
    }
    return false;
}
/**
 * 推断置信度类型
 *
 * @param finding - 研究发现
 * @returns 置信度类型
 */
function inferConfidenceType(finding) {
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
