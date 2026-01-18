"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectInputType = detectInputType;
exports.analyzeComplexity = analyzeComplexity;
/**
 * 平台关键词映射
 *
 * 数据结构优于算法 - 用查表代替 if-else
 */
var PLATFORM_KEYWORDS = {
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
var STYLE_KEYWORDS = [
    "教程", "指南", "入门", "实战", "案例分析",
    "深度", "解析", "研究", "报告",
    "轻松", "有趣", "幽默", "通俗"
];
/**
 * 角度关键词映射
 */
var ANGLE_KEYWORDS = [
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
function detectInputType(input) {
    var trimmed = input.trim();
    // 检测平台
    var platforms = detectPlatforms(trimmed);
    // 检测风格
    var style = detectStyle(trimmed);
    // 检测角度
    var angle = detectAngle(trimmed);
    // 判断输入类型
    var type = judgeInputType(trimmed);
    // 提取主题
    var topic = extractTopic(trimmed);
    return {
        type: type,
        topic: topic,
        platform: platforms.length > 0 ? platforms : ["wechat"],
        style: style,
        angle: angle
    };
}
/**
 * 检测发布平台
 */
function detectPlatforms(input) {
    var platforms = [];
    for (var _i = 0, _a = Object.entries(PLATFORM_KEYWORDS); _i < _a.length; _i++) {
        var _b = _a[_i], keyword = _b[0], platform = _b[1];
        if (input.includes(keyword)) {
            platforms.push(platform);
        }
    }
    return platforms;
}
/**
 * 检测文章风格
 */
function detectStyle(input) {
    for (var _i = 0, STYLE_KEYWORDS_1 = STYLE_KEYWORDS; _i < STYLE_KEYWORDS_1.length; _i++) {
        var keyword = STYLE_KEYWORDS_1[_i];
        if (input.includes(keyword)) {
            return keyword;
        }
    }
    return undefined;
}
/**
 * 检测文章角度
 */
function detectAngle(input) {
    for (var _i = 0, ANGLE_KEYWORDS_1 = ANGLE_KEYWORDS; _i < ANGLE_KEYWORDS_1.length; _i++) {
        var _a = ANGLE_KEYWORDS_1[_i], pattern = _a.pattern, angle = _a.angle;
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
function judgeInputType(input) {
    var clearPatterns = [
        /写一篇/,
        /写一个/,
        /生成/,
        /创作/
    ];
    var ambiguousPatterns = [
        /我想写/,
        /想做/,
        /有没有/,
        /什么/,
        /怎么/,
        /如何/
    ];
    // 先判断是否明确
    for (var _i = 0, clearPatterns_1 = clearPatterns; _i < clearPatterns_1.length; _i++) {
        var pattern = clearPatterns_1[_i];
        if (pattern.test(input)) {
            return "clear";
        }
    }
    // 再判断是否模糊
    for (var _a = 0, ambiguousPatterns_1 = ambiguousPatterns; _a < ambiguousPatterns_1.length; _a++) {
        var pattern = ambiguousPatterns_1[_a];
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
function extractTopic(input) {
    var topic = input;
    // 移除常见的引导词
    var prefixes = [
        /写一篇关于/,
        /写一个关于/,
        /我想写.*关于/,
        /生成.*关于/,
        /创作.*关于/
    ];
    for (var _i = 0, prefixes_1 = prefixes; _i < prefixes_1.length; _i++) {
        var prefix = prefixes_1[_i];
        topic = topic.replace(prefix, "");
    }
    // 移除平台关键词
    for (var _a = 0, _b = Object.keys(PLATFORM_KEYWORDS); _a < _b.length; _a++) {
        var keyword = _b[_a];
        topic = topic.replace(new RegExp(keyword, "g"), "");
    }
    // 移除风格关键词
    for (var _c = 0, STYLE_KEYWORDS_2 = STYLE_KEYWORDS; _c < STYLE_KEYWORDS_2.length; _c++) {
        var keyword = STYLE_KEYWORDS_2[_c];
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
function analyzeComplexity(detection) {
    var complexity = 1;
    // 平台数量
    if (detection.platform.length > 1)
        complexity += 1;
    // 有风格要求
    if (detection.style)
        complexity += 1;
    // 有角度要求
    if (detection.angle)
        complexity += 1;
    // 模糊输入需要更多分析
    if (detection.type === "ambiguous")
        complexity += 1;
    return Math.min(complexity, 5);
}
