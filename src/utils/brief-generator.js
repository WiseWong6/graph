"use strict";
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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateBriefMarkdown = generateBriefMarkdown;
exports.generateBriefSummary = generateBriefSummary;
exports.extractKeyPoints = extractKeyPoints;
/**
 * 生成 Brief Markdown（重构版 - 内容创作视角）
 *
 * @param data - Brief 数据
 * @returns Markdown 格式的 Brief
 */
function generateBriefMarkdown(data) {
    var _a;
    var lines = [];
    // 标题
    lines.push("# \u5185\u5BB9\u8C03\u7814\u62A5\u544A\uFF1A".concat(data.detected_topic, "\n"));
    // 调研概述
    lines.push("## 调研概述\n");
    lines.push("- **\u4E3B\u9898**: ".concat(data.detected_topic));
    lines.push("- **\u8C03\u7814\u65F6\u95F4**: ".concat(data.generated_at.split("T")[0]));
    lines.push("- **\u65F6\u6548\u6027\u7A97\u53E3**: \u8FD16\u4E2A\u6708");
    lines.push("- **\u8C03\u7814\u6DF1\u5EA6**: ".concat(data.complexity <= 2 ? "浅层分析" : data.complexity <= 4 ? "中等分析" : "深度分析"));
    lines.push("");
    lines.push("---\n");
    // 关键洞察（新增）
    if (data.key_insights && data.key_insights.length > 0) {
        lines.push("## 核心洞察\n");
        data.key_insights.forEach(function (insight, index) {
            lines.push("### ".concat(index + 1, ". ").concat(insight.split("：")[0]));
            var detail = insight.split("：").slice(1).join("：");
            lines.push("");
            lines.push(detail);
            lines.push("");
            lines.push("---\n");
        });
    }
    // 分析框架（新增）
    if (data.framework) {
        lines.push("## 关键概念框架\n");
        lines.push("### ".concat(data.framework.split("\n")[0]));
        lines.push("");
        lines.push("```");
        data.framework.split("\n").slice(1).forEach(function (line) {
            lines.push(line);
        });
        lines.push("```");
        lines.push("");
        lines.push("---\n");
    }
    // 数据支撑（新增）
    if (data.data_points && Object.keys(data.data_points).length > 0) {
        lines.push("## 数据引用清单\n");
        Object.entries(data.data_points).forEach(function (_a) {
            var key = _a[0], value = _a[1];
            lines.push("".concat(key, ". ").concat(value));
        });
        lines.push("");
        lines.push("---\n");
    }
    // 核心发现（重构）
    if (data.key_findings.length > 0) {
        lines.push("## 核心发现\n");
        lines.push("");
        // 按置信度分组
        var facts = data.key_findings.filter(function (f) { return f.confidence_type === "FACT"; });
        var beliefs = data.key_findings.filter(function (f) { return f.confidence_type === "BELIEF"; });
        var contradictions = data.key_findings.filter(function (f) { return f.confidence_type === "CONTRADICTION"; });
        var assumptions = data.key_findings.filter(function (f) { return f.confidence_type === "ASSUMPTION"; });
        var index_1 = 1;
        if (facts.length > 0) {
            facts.forEach(function (finding) {
                lines.push("### ".concat(index_1, ". ").concat(finding.claim.substring(0, 50), "..."));
                lines.push("");
                lines.push(formatFindingWithInsights(finding));
                lines.push("");
                lines.push("---\n");
                index_1++;
            });
        }
        if (beliefs.length > 0) {
            beliefs.forEach(function (finding) {
                lines.push("### ".concat(index_1, ". ").concat(finding.claim.substring(0, 50), "..."));
                lines.push("");
                lines.push(formatFindingWithInsights(finding));
                lines.push("");
                lines.push("---\n");
                index_1++;
            });
        }
        if (contradictions.length > 0) {
            contradictions.forEach(function (finding) {
                lines.push("### ".concat(index_1, ". ").concat(finding.claim.substring(0, 50), "..."));
                lines.push("");
                lines.push(formatFindingWithInsights(finding));
                lines.push("");
                lines.push("---\n");
                index_1++;
            });
        }
        if (assumptions.length > 0) {
            assumptions.forEach(function (finding) {
                lines.push("### ".concat(index_1, ". ").concat(finding.claim.substring(0, 50), "..."));
                lines.push("");
                lines.push(formatFindingWithInsights(finding));
                lines.push("");
                lines.push("---\n");
                index_1++;
            });
        }
    }
    // 差异化角度建议（新增）
    if (data.angles && data.angles.length > 0) {
        lines.push("## 差异化角度建议\n");
        data.angles.forEach(function (angle, index) {
            lines.push("### \u89D2\u5EA6".concat(index + 1, "\uFF1A").concat(angle.name));
            lines.push("- \u6838\u5FC3\u8BBA\u70B9\uFF1A".concat(angle.core_argument));
            lines.push("- \u8BBA\u636E\u652F\u6491\uFF1A".concat(angle.evidence.slice(0, 2).join("、")).concat(angle.evidence.length > 2 ? " 等" : ""));
            lines.push("- \u5DEE\u5F02\u5316\uFF1A".concat(angle.differentiation));
            lines.push("- \u53EF\u884C\u6027\u8BC4\u5206\uFF1A".concat("⭐".repeat(Math.round(angle.feasibility / 2)), " (").concat(angle.feasibility, "/10)"));
            lines.push("");
        });
        lines.push("---\n");
    }
    // 推荐写作角度（新增）
    if (data.recommended_angle) {
        lines.push("## 推荐写作角度\n");
        lines.push("**\u63A8\u8350\uFF1A".concat(data.recommended_angle.name, "**\n"));
        lines.push("**理由**:");
        lines.push("1. ".concat(data.recommended_angle.core_argument));
        if (data.recommended_angle.evidence.length > 0) {
            lines.push("2. \u8BBA\u636E\u652F\u6491\uFF1A".concat(data.recommended_angle.evidence.join("、")));
        }
        if (data.recommended_angle.differentiation) {
            lines.push("3. \u5DEE\u5F02\u5316\u4EF7\u503C\uFF1A".concat(data.recommended_angle.differentiation));
        }
        lines.push("");
        lines.push("---\n");
    }
    // 后续步骤（新增）
    lines.push("## 后续步骤\n");
    lines.push("1. \u2705 \u4F7F\u7528\u63A8\u8350\u89D2\u5EA6\u300C".concat(((_a = data.recommended_angle) === null || _a === void 0 ? void 0 : _a.name) || "待定", "\u300D\u5F00\u59CB\u521B\u4F5C"));
    lines.push("2. \u6216\u67E5\u770B\u5176\u4ED6\u89D2\u5EA6\u65B9\u6848\uFF0C\u624B\u52A8\u9009\u62E9\u4E00\u4E2A");
    lines.push("");
    lines.push("---\n");
    // 参考资料
    lines.push("## 参考资料\n");
    var allSources = new Map();
    data.key_findings.forEach(function (finding) {
        finding.sources.forEach(function (source) {
            allSources.set(source.url, {
                title: source.title,
                url: source.url,
                date: source.date
            });
        });
    });
    Array.from(allSources.values()).forEach(function (source, index) {
        var dateStr = "";
        if (source.date) {
            if (source.date instanceof Date) {
                dateStr = " (".concat(source.date.toISOString().split("T")[0], ")");
            }
            else {
                dateStr = " (".concat(source.date, ")");
            }
        }
        lines.push("".concat(index + 1, ". [").concat(source.title, "](").concat(source.url, ")").concat(dateStr));
    });
    lines.push("");
    // 元数据
    lines.push("---\n");
    lines.push("**\u751F\u6210\u65F6\u95F4**: ".concat(data.generated_at));
    lines.push("**\u7814\u7A76\u8017\u65F6**: ".concat((data.research_time_ms / 1000).toFixed(2), "s"));
    lines.push("");
    return lines.join("\n");
}
/**
 * 格式化单个发现（带关键洞察）
 */
function formatFindingWithInsights(finding) {
    var lines = [];
    // 置信度标签（使用参考文件的格式）
    var confidenceType = finding.confidence_type === "FACT" ? "FACT" :
        finding.confidence_type === "BELIEF" ? "BELIEF" :
            finding.confidence_type === "CONTRADICTION" ? "CONTRADICTION" :
                finding.confidence_type === "ASSUMPTION" ? "ASSUMPTION" : "BELIEF";
    var confPercent = (finding.confidence_score * 100).toFixed(0);
    lines.push("[".concat(confidenceType, " | conf: ").concat(confPercent, "] ").concat(finding.claim));
    lines.push("");
    // 来源列表
    if (finding.sources.length > 0) {
        var firstSource = finding.sources[0];
        var dateStr = "无日期";
        if (firstSource.date) {
            if (firstSource.date instanceof Date) {
                dateStr = firstSource.date.toISOString().split("T")[0];
            }
            else {
                dateStr = firstSource.date;
            }
        }
        lines.push("\u2192 [".concat(firstSource.title, "](").concat(firstSource.url, ") \u2014 (").concat(getSourceDomain(firstSource.url), ", ").concat(dateStr, ")"));
        if (finding.cross_verified) {
            lines.push("\u9A8C\u8BC1: \u7531 ".concat(finding.sources.length, " \u4E2A\u72EC\u7ACB\u6765\u6E90\u786E\u8BA4"));
        }
    }
    lines.push("");
    // 尝试提取关键洞察（从 claim 中）
    var insights = extractInsightsFromClaim(finding.claim);
    if (insights.length > 0) {
        lines.push("**关键洞察**:");
        insights.forEach(function (insight) {
            lines.push("- ".concat(insight));
        });
        lines.push("");
    }
    return lines.join("\n");
}
/**
 * 从声明中提取关键洞察
 */
function extractInsightsFromClaim(claim) {
    var insights = [];
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
function getSourceDomain(url) {
    try {
        var urlObj = new URL(url);
        return urlObj.hostname.replace("www.", "");
    }
    catch (_a) {
        return "未知来源";
    }
}
/**
 * 生成摘要
 *
 * @param data - Brief 数据
 * @returns 摘要文本
 */
function generateBriefSummary(data) {
    var lines = [];
    lines.push("\u4E3B\u9898: ".concat(data.detected_topic));
    lines.push("\u627E\u5230 ".concat(data.key_findings.length, " \u4E2A\u5173\u952E\u53D1\u73B0"));
    lines.push("\u53D1\u73B0 ".concat(data.trends.length, " \u4E2A\u76F8\u5173\u8D8B\u52BF"));
    var factCount = data.key_findings.filter(function (f) { return f.confidence_type === "FACT"; }).length;
    if (factCount > 0) {
        lines.push("\u5176\u4E2D ".concat(factCount, " \u4E2A\u5DF2\u9A8C\u8BC1\u4E8B\u5B9E"));
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
function extractKeyPoints(data, maxCount) {
    if (maxCount === void 0) { maxCount = 5; }
    // 按置信度排序
    var sorted = __spreadArray([], data.key_findings, true).sort(function (a, b) { return b.confidence_score - a.confidence_score; });
    return sorted.slice(0, maxCount).map(function (f) { return f.claim; });
}
