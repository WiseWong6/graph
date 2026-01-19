/**
 * RAG 结果格式化工具
 *
 * 将检索结果转换为 Markdown 格式
 */

import type { RAGContent } from "../index/schema.js";

// 内置轻量级中文词典（基于常见词汇）
const CHINESE_DICT = new Set([
  // 技术术语
  "人工智能", "机器学习", "深度学习", "算法", "数据结构", "编程", "代码", "架构", "设计", "模式",
  "框架", "库", "接口", "API", "前端", "后端", "数据库", "服务器", "客户端", "浏览器",
  "操作系统", "内核", "驱动", "网络", "协议", "安全", "加密", "解密", "性能", "优化",
  "调试", "测试", "部署", "发布", "版本", "迭代", "重构", "模块", "组件", "函数",
  "变量", "参数", "返回值", "异常", "错误", "日志", "配置", "依赖", "构建", "编译",

  // 通用词汇
  "分析", "研究", "设计", "开发", "实现", "测试", "部署", "运维", "监控", "优化",
  "文档", "说明", "注释", "示例", "教程", "指南", "参考", "手册", "规范", "标准",
  "问题", "解决", "方案", "方法", "策略", "技巧", "经验", "实践", "原则", "理念",
  "思考", "理解", "掌握", "学习", "进步", "成长", "创新", "突破", "挑战", "机遇",

  // 内容创作
  "标题", "摘要", "正文", "结尾", "段落", "章节", "目录", "索引", "标签", "分类",
  "作者", "来源", "发布", "更新", "编辑", "审核", "推荐", "热门", "最新", "相关",
  "搜索", "检索", "查询", "匹配", "过滤", "排序", "分页", "导航", "菜单", "按钮",

  // 三字词
  "程序员", "开发者", "工程师", "设计师", "产品经理", "项目经理", "架构师", "技术总监",
  "开源", "闭源", "源码", "代码库", "版本库", "分支", "合并", "冲突", "提交", "推送",

  // 双字词
  "技术", "系统", "软件", "硬件", "网络", "数据", "信息", "知识", "经验", "能力",
  "工具", "平台", "服务", "应用", "程序", "脚本", "命令", "参数", "选项", "配置",
  "项目", "任务", "计划", "目标", "结果", "效果", "影响", "作用", "意义", "价值",

  // 常见通用词
  "官方", "社区", "用户", "客户", "产品", "功能", "特性", "需求", "场景", "流程",
  "规则", "标准", "规范", "指南", "教程", "文档", "说明", "介绍", "概述", "背景",
  "历史", "未来", "趋势", "发展", "变化", "更新", "升级", "改进", "提升", "优化",
  "问题", "错误", "缺陷", "故障", "异常", "风险", "挑战", "困难", "障碍", "限制",
  "原因", "因素", "条件", "要求", "标准", "原则", "方法", "方式", "手段", "途径",
  "步骤", "过程", "阶段", "环节", "流程", "周期", "时间", "周期", "速度", "效率",
  "质量", "数量", "规模", "范围", "程度", "水平", "等级", "级别", "层次", "维度",
  "关系", "联系", "关联", "影响", "作用", "效果", "结果", "成果", "收益", "价值",
  "成本", "费用", "价格", "预算", "投资", "回报", "收益", "利润", "效益", "效果",
  "团队", "组织", "公司", "企业", "机构", "部门", "小组", "成员", "人员", "角色",
  "职责", "责任", "权限", "权利", "义务", "要求", "期望", "目标", "指标", "标准",
  "策略", "计划", "方案", "规划", "设计", "开发", "实施", "部署", "运维", "监控"
]);

// 最大匹配分词（Forward Maximum Matching）
function maximumMatch(text: string, maxWordLength: number = 4): string[] {
  const words: string[] = [];
  let i = 0;

  while (i < text.length) {
    let matched = false;

    // 从最长到最短尝试匹配
    for (let len = Math.min(maxWordLength, text.length - i); len >= 2; len--) {
      const word = text.slice(i, i + len);
      if (CHINESE_DICT.has(word)) {
        words.push(word);
        i += len;
        matched = true;
        break;
      }
    }

    // 未匹配，跳过单字
    if (!matched) {
      i++;
    }
  }

  return words;
}

/**
 * 格式化为 Markdown
 */
export function formatRAGContent(data: RAGContent): string {
  let md = `# RAG 检索结果\n\n`;
  md += `**主题**: ${data.topic}\n\n`;
  md += `**检索时间**: ${data.stats.retrievalTime}ms\n\n`;

  // 相关金句
  if (data.quotes && data.quotes.length > 0) {
    md += `## 相关金句 (${data.quotes.length})\n\n`;
    data.quotes.forEach((q, i) => {
      md += `### ${i + 1}. ${q.content}\n\n`;
      if (q.metadata.source_title) {
        md += `> 来源: ${q.metadata.source_title}`;
        if (q.metadata.author) {
          md += ` | ${q.metadata.author}`;
        }
        md += `\n\n`;
      }
    });
  }

  // 相关文章片段
  if (data.articles && data.articles.length > 0) {
    md += `## 相关文章片段 (${data.articles.length})\n\n`;
    data.articles.forEach((a, i) => {
      const title = a.metadata?.title || "无标题";
      md += `### ${i + 1}. ${title}\n\n`;

      // 截取前 500 字（防御性检查）
      if (a.content && a.content.length > 0) {
        const preview = a.content.length > 500
          ? a.content.slice(0, 500) + "..."
          : a.content;
        md += `${preview}\n\n`;
      }

      if (a.metadata?.author) {
        md += `> 来源: ${a.metadata.author}\n\n`;
      }
    });
  }

  // 参考标题
  if (data.titles && data.titles.length > 0) {
    md += `## 参考标题 (${data.titles.length})\n\n`;
    data.titles.forEach((t, i) => {
      md += `${i + 1}. ${t.title}\n`;
    });
    md += `\n`;
  }

  // 统计信息
  md += `---\n\n`;
  md += `**统计**: 金句 ${data.stats.quotesCount} 条 | 文章 ${data.stats.articlesCount} 篇`;
  if (data.stats.titlesCount) {
    md += ` | 标题 ${data.stats.titlesCount} 个`;
  }
  md += `\n`;

  return md;
}

/**
 * 从 Brief 提取关键词
 */
export function extractKeywords(brief: string): string[] {
  // 使用最大匹配分词算法
  const words = maximumMatch(brief);

  // 去重并返回前 10 个
  return Array.from(new Set(words)).slice(0, 10);
}

/**
 * 构建查询字符串
 */
export function buildQuery(topic: string, keywords: string[]): string {
  return `${topic} ${keywords.join(" ")}`;
}
