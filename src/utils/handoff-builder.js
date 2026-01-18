"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildHandoff = buildHandoff;
exports.handoffToYaml = handoffToYaml;
exports.handoffFromYaml = handoffFromYaml;
/**
 * 构建 Handoff 数据
 *
 * @param input - 输入检测结果
 * @param trends - 趋势列表
 * @param findings - 研究发现列表
 * @param researchTimeMs - 研究耗时
 * @returns Handoff 数据
 */
function buildHandoff(input, trends, findings, researchTimeMs) {
    // 计算平均置信度
    var confidenceAvg = findings.length > 0
        ? findings.reduce(function (sum, f) { return sum + f.confidence_score; }, 0) / findings.length
        : 0;
    // 统计来源数量
    var sourcesCount = findings.reduce(function (sum, f) { return sum + f.sources.length; }, 0);
    // 提取关键要点
    var keyPoints = findings
        .sort(function (a, b) { return b.confidence_score - a.confidence_score; })
        .slice(0, 5)
        .map(function (f) { return f.claim; });
    // 推荐角度
    var recommendedAngles = recommendAngles(input, findings);
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
        trends: trends,
        findings: findings,
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
function calculateComplexity(input) {
    var complexity = 1;
    if (input.platform.length > 1)
        complexity += 1;
    if (input.style)
        complexity += 1;
    if (input.angle)
        complexity += 1;
    if (input.type === "ambiguous")
        complexity += 1;
    return Math.min(complexity, 5);
}
/**
 * 推荐文章角度
 */
function recommendAngles(input, findings) {
    var angles = [];
    // 基于输入的角度
    if (input.angle) {
        angles.push(formatAngle(input.angle));
    }
    // 基于发现的角度
    var hasData = findings.some(function (f) { return f.confidence_type === "FACT" && f.claim.includes("数据"); });
    var hasTrend = findings.some(function (f) { return f.claim.includes("增长") || f.claim.includes("趋势"); });
    if (hasData)
        angles.push("数据驱动");
    if (hasTrend)
        angles.push("趋势分析");
    // 默认角度
    if (angles.length === 0) {
        angles.push("入门介绍", "实践指南");
    }
    return angles;
}
/**
 * 格式化角度名称
 */
function formatAngle(angle) {
    if (!angle)
        return "通用";
    var angleNames = {
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
function handoffToYaml(handoff) {
    var lines = [];
    lines.push("# Research Handoff v".concat(handoff.version));
    lines.push("# Generated: ".concat(handoff.generated_at));
    lines.push("");
    // 输入分析
    lines.push("input:");
    lines.push("  original: \"".concat(escapeYaml(handoff.input.original), "\""));
    lines.push("  detected_topic: \"".concat(escapeYaml(handoff.input.detected_topic), "\""));
    lines.push("  type: ".concat(handoff.input.type));
    lines.push("  platform:");
    for (var _i = 0, _a = handoff.input.platform; _i < _a.length; _i++) {
        var platform = _a[_i];
        lines.push("    - ".concat(platform));
    }
    if (handoff.input.style) {
        lines.push("  style: \"".concat(escapeYaml(handoff.input.style), "\""));
    }
    if (handoff.input.angle) {
        lines.push("  angle: \"".concat(escapeYaml(handoff.input.angle), "\""));
    }
    lines.push("  complexity: ".concat(handoff.input.complexity));
    lines.push("");
    // 趋势
    if (handoff.trends.length > 0) {
        lines.push("trends:");
        for (var _b = 0, _c = handoff.trends; _b < _c.length; _b++) {
            var trend = _c[_b];
            lines.push("  - topic: \"".concat(escapeYaml(trend.topic), "\""));
            lines.push("    signal_strength: ".concat(trend.signal_strength));
            lines.push("    growth_rate: ".concat(trend.growth_rate));
            lines.push("    time_window: ".concat(trend.time_window));
            lines.push("    confidence_score: ".concat(trend.confidence_score));
        }
        lines.push("");
    }
    // 关键要点
    if (handoff.key_points.length > 0) {
        lines.push("key_points:");
        for (var _d = 0, _e = handoff.key_points; _d < _e.length; _d++) {
            var point = _e[_d];
            lines.push("  - \"".concat(escapeYaml(point), "\""));
        }
        lines.push("");
    }
    // 推荐角度
    if (handoff.recommended_angles.length > 0) {
        lines.push("recommended_angles:");
        for (var _f = 0, _g = handoff.recommended_angles; _f < _g.length; _f++) {
            var angle = _g[_f];
            lines.push("  - \"".concat(escapeYaml(angle), "\""));
        }
        lines.push("");
    }
    // 元数据
    lines.push("metadata:");
    lines.push("  research_time_ms: ".concat(handoff.metadata.research_time_ms));
    lines.push("  sources_count: ".concat(handoff.metadata.sources_count));
    lines.push("  confidence_avg: ".concat(handoff.metadata.confidence_avg.toFixed(3)));
    return lines.join("\n");
}
/**
 * YAML 字符串转义
 */
function escapeYaml(str) {
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
function handoffFromYaml(_yaml) {
    // 简化版: 使用 js-yaml 库
    // const yaml = require('js-yaml');
    // return yaml.load(yaml) as HandoffData;
    throw new Error("handoffFromYaml not yet implemented");
}
