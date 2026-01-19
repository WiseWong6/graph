/**
 * Research 节点
 *
 * 职责: 基于用户输入进行深度调研,生成 Brief 和 Handoff
 *
 * 数据流:
 * prompt → 输入检测 → 网络搜索 → LLM 分析 → Brief/Handoff → 文件落盘
 *
 * 设计原则:
 * - 并行执行搜索和分析
 * - 优先使用 MCP,降级到 HTTP
 * - 置信度标签系统
 */

import { existsSync, mkdirSync, writeFileSync } from "fs";
import { resolve, join } from "path";
import { ArticleState } from "../state";
import { callLLMWithFallback } from "../../../utils/llm-runner.js";

// 辅助工具
import {
  detectInputType,
  analyzeComplexity
} from "../../../utils/input-detector.js";
import {
  calculateConfidence,
  calculateFreshness,
  inferConfidenceType,
  needsCrossVerification,
  type Finding,
  type Trend
} from "../../../utils/research-scorer.js";
import {
  generateBriefMarkdown,
  generateBriefSummary,
  type BriefData
} from "../../../utils/brief-generator.js";
import {
  buildHandoff,
  handoffToYaml
} from "../../../utils/handoff-builder.js";

// 加载环境变量
import { config } from "dotenv";
config({ path: resolve(process.cwd(), ".env") });

/**
 * Research 节点主函数
 *
 * @param state - 当前状态
 * @returns 更新的状态
 */
export async function researchNode(state: ArticleState): Promise<Partial<ArticleState>> {
  const startTime = Date.now();
  console.log("[01_research] Starting research for:", state.prompt);

  // ========== 步骤 1: 输入检测 ==========
  console.log("[01_research] Step 1: Detecting input type...");
  const inputDetection = detectInputType(state.prompt);
  const complexity = analyzeComplexity(inputDetection);

  console.log(`[01_research] Input type: ${inputDetection.type}, complexity: ${complexity}`);
  console.log(`[01_research] Detected topic: ${inputDetection.topic}`);

  // ========== 步骤 2: 执行搜索（analyzeTrends 是轻量级字符串匹配，不需要并行）==========
  console.log("[01_research] Step 2: Running research...");

  const searchResults = await performSearch(inputDetection.topic);
  const trends = analyzeTrends(inputDetection.topic);

  console.log(`[01_research] Found ${searchResults.length} search results`);
  console.log(`[01_research] Identified ${trends.length} trends`);

  // ========== 步骤 3: 使用 LLM 分析结果（重构版） ==========
  console.log("[01_research] Step 3: Analyzing with LLM...");
  const analysisResult = await analyzeWithLLM(
    inputDetection.topic,
    searchResults,
    state.decisions?.selectedModel  // 传递用户选择的模型 ID
  );

  // 计算置信度
  for (const finding of analysisResult.findings) {
    finding.confidence_score = calculateConfidence(finding);
    finding.confidence_type = inferConfidenceType(finding);
    finding.cross_verified = needsCrossVerification(finding.claim) && finding.sources.length >= 2;

    // 计算时效性
    const anySourceWithDate = finding.sources.find(s => s.date);
    if (anySourceWithDate) {
      const freshness = calculateFreshness(finding);
      finding.freshness_status = freshness >= 0.8 ? "current" : freshness >= 0.4 ? "needs_update" : "outdated";
    } else {
      finding.freshness_status = "current"; // 无日期信息,默认为当前
    }
  }

  console.log(`[01_research] Generated ${analysisResult.findings.length} findings`);
  console.log(`[01_research] Average confidence: ${
    analysisResult.findings.reduce((sum, f) => sum + f.confidence_score, 0) / analysisResult.findings.length
  }`);

  // ========== 步骤 4: 生成 Brief 和 Handoff（重构版） ==========
  console.log("[01_research] Step 4: Generating Brief and Handoff...");

  const researchTimeMs = Date.now() - startTime;

  const briefData: BriefData = {
    input: state.prompt,
    detected_topic: inputDetection.topic,
    input_type: inputDetection.type,
    platform: inputDetection.platform,
    style: inputDetection.style,
    angle: inputDetection.angle,
    complexity,
    trends,
    key_findings: analysisResult.findings,
    // 新增：内容创作视角
    key_insights: analysisResult.key_insights,
    data_points: analysisResult.data_points,
    framework: analysisResult.framework,
    angles: analysisResult.angles,
    recommended_angle: analysisResult.recommended_angle,
    // 新增：完整的 Markdown 报告
    markdown_report: analysisResult.markdown_report,
    generated_at: new Date().toISOString(),
    research_time_ms: researchTimeMs
  };

  const handoffData = buildHandoff(inputDetection, trends, analysisResult.findings, researchTimeMs);

  const briefMarkdown = generateBriefMarkdown(briefData);
  const handoffYaml = handoffToYaml(handoffData);

  console.log("[01_research] Brief summary:");
  console.log(`  ${generateBriefSummary(briefData).split("\n").join("\n  ")}`);

  // ========== 步骤 5: 保存文件 ==========
  console.log("[01_research] Step 5: Saving files...");

  const outputPath = state.outputPath || getDefaultOutputPath();
  const researchDir = join(outputPath, "research");

  // 确保目录存在
  if (!existsSync(researchDir)) {
    mkdirSync(researchDir, { recursive: true });
  }

  // 保存 Brief
  const briefPath = join(researchDir, "00_brief.md");
  writeFileSync(briefPath, briefMarkdown, "utf-8");
  console.log(`[01_research] Saved Brief: ${briefPath}`);

  // 保存 Handoff
  const handoffPath = join(researchDir, "00_handoff.yaml");
  writeFileSync(handoffPath, handoffYaml, "utf-8");
  console.log(`[01_research] Saved Handoff: ${handoffPath}`);

  console.log(`[01_research] Total time: ${(researchTimeMs / 1000).toFixed(2)}s`);

  return {
    researchResult: briefMarkdown,
    topic: inputDetection.topic,
    outputPath
  };
}

/**
 * 执行网络搜索
 *
 * 使用并行搜索管理器，自动协调多个搜索源
 *
 * 优先级:
 * 1. mcp-webresearch (Google 搜索，第一优先级)
 * 2. DuckDuckGo (免费搜索，第二优先级)
 * 3. Firecrawl (付费搜索，第三优先级)
 */
async function performSearch(topic: string): Promise<Array<{
  title: string;
  url: string;
  description?: string;
  date?: Date;
}>> {
  console.log("[01_research] 使用并行搜索管理器...");

  const { createParallelSearchManager } = await import("../../../adapters/parallel-search.js");
  const searchManager = createParallelSearchManager();

  const { results, sources, metadata } = await searchManager.parallelSearch(topic, {
    limit: 15,  // 增加到 15 个结果以获得更全面的调研素材
    timeout: 30000,  // 30 秒 - Playwright 需要时间启动浏览器
    minResults: 3,
    enableFirecrawl: !!process.env.FIRECRAWL_API_KEY
  });

  console.log(`[01_research] 搜索完成: ${results.length} 个结果`);
  console.log(`[01_research] 数据源: ${sources.join(", ")}`);
  console.log(`[01_research] 详情:`, metadata.bySource);

  return results.map(r => ({
    title: r.title,
    url: r.url,
    description: r.snippet
  }));
}

/**
 * 分析趋势（同步版本 - 纯字符串匹配）
 *
 * 简化版: 使用关键词检测
 * TODO: 集成真实的趋势分析 API（届时改为 async）
 */
function analyzeTrends(topic: string): Trend[] {
  // 简化实现: 基于主题生成模拟趋势
  // 在生产环境中,这里应该调用真实的趋势分析 API

  const trends: Trend[] = [];

  // 检测是否有增长相关关键词
  const growthKeywords = ["AI", "人工智能", "机器学习", "LLM", "大模型", "Agent"];
  const hasGrowth = growthKeywords.some(kw => topic.toLowerCase().includes(kw.toLowerCase()));

  if (hasGrowth) {
    trends.push({
      topic: `${topic} 相关技术`,
      signal_strength: "high",
      growth_rate: "+65%",
      time_window: "过去 60 天",
      confidence_score: 0.85
    });
  }

  return trends;
}

/**
 * 使用 LLM 分析搜索结果（重构版 - 内容创作视角）
 */
async function analyzeWithLLM(
  topic: string,
  searchResults: Array<{
    title: string;
    url: string;
    description?: string;
  }>,
  selectedModelId?: string  // 新增：用户选择的模型 ID
): Promise<{
  findings: Finding[];
  key_insights?: string[];
  data_points?: Record<string, string>;
  framework?: string;
  angles?: Array<{
    name: string;
    core_argument: string;
    evidence: string[];
    differentiation: string;
    feasibility: number;
  }>;
  recommended_angle?: {
    name: string;
    core_argument: string;
    evidence: string[];
    differentiation: string;
    feasibility: number;
  };
  markdown_report?: string;  // 新增：完整的 Markdown 报告
}> {
  if (searchResults.length === 0) {
    console.log("[01_research] No search results to analyze");
    return { findings: [] };
  }

  // 构建分析 Prompt（重构版 - 11 部分结构化报告）
  const searchResultsText = searchResults
    .map((r, i) => `${i + 1}. ${r.title}\n   URL: ${r.url}\n   摘要: ${r.description || "无摘要"}\n`)
    .join("\n");

  const prompt = `你是一位资深的内容创作调研专家，擅长从搜索结果中生成深度调研报告。

## 主题
${topic}

## 搜索结果
(${searchResults.length} 条搜索结果)
${searchResultsText}

---

## 任务
请基于搜索结果生成一份**完整的调研报告（Markdown 格式）**，包含以下部分：

### 一、核心事件概览
- **事件本质**：用一句话总结这个主题的核心
- **技术/产品定位**：这是什么？解决什么问题？
- **关键方/支持方**：主要的参与者、公司、组织

### 二、技术架构分析（如适用）
如果主题涉及技术产品：
- **核心组件/模块**：由哪些主要部分组成
- **技术特点**：技术栈、架构风格
- **设计原则**：遵循的设计理念

### 三、应用场景/案例（如适用）
- **具体案例**：1-2 个典型应用案例
- **技术实现**：如何实现
- **用户体验**：用户如何使用

### 四、市场影响与商业价值
- **对用户的价值**：解决什么痛点
- **对行业的影响**：改变了什么
- **商业模式**：如何盈利（如适用）

### 五、竞争格局（如适用）
- **国际对标**：与国外类似产品/技术对比
- **差异化优势**：有什么独特之处
- **竞争态势**：竞争激烈程度

### 六、技术趋势研判（如适用）
- **行业趋势**：该领域的发展方向
- **技术演进**：技术会如何发展
- **未来预测**：1-3 年的预测

### 七、写作角度建议（3 个）
为每个角度提供：
- **角度名称**
- **核心观点**：1-2 句话
- **核心要点**：3-5 个要点
- **优势**：为什么这个角度好

### 八、内容 Brief 建议
- **标题建议**（3 个候选标题）
- **核心结构**：文章建议的结构（如：引言-3个主体部分-结论）
- **关键数据点**：文章中应该包含的关键数据

### 九、风险与挑战（如适用）
- **技术挑战**：实现难度
- **市场挑战**：市场接受度
- **竞争挑战**：竞争对手威胁

### 十、信息源说明
- **信息源列表**：主要参考的搜索结果（标题 + URL）
- **置信度评估**：标注信息来源的置信度
  - FACT：有明确数据或多个来源确认的事实
  - BELIEF：行业共识或专家观点
  - ASSUMPTION：基于有限信息的合理推测

---

## 输出格式

请直接输出完整的 Markdown 报告，使用以下标题层级：

\`\`\`markdown
# ${topic} 调研报告

## 一、核心事件概览
### 事件本质
...

### 技术/产品定位
...

## 二、技术架构分析
...

## 七、写作角度建议
### 角度 1：[角度名称]
**核心观点**：...
**核心要点**：
- ...
- ...
**优势**：...

## 八、内容 Brief 建议
### 标题建议
1. ...
2. ...
3. ...

### 核心结构
...

### 关键数据点
...
\`\`\`

注意：
1. 如果某个部分不适用（如非技术主题），可以简写或跳过
2. 保持报告的专业性和可读性
3. 数据和观点必须来自搜索结果，不要编造`;

  try {
    const { response } = await callLLMWithFallback(selectedModelId, "research", {
      prompt,
      systemMessage: "你是一位资深的内容创作调研专家。输出完整的 Markdown 调研报告，确保结构清晰、内容详实。"
    });

    // 解析 LLM 输出（Markdown 格式）
    const analysisResult = parseMarkdownReport(response.text, searchResults);

    console.log(`[01_research] LLM 分析完成:`);
    console.log(`  - ${analysisResult.findings.length} 个关键发现`);
    console.log(`  - ${analysisResult.key_insights?.length || 0} 个关键洞察`);
    console.log(`  - ${analysisResult.angles?.length || 0} 个写作角度`);
    console.log(`  - 推荐角度: ${analysisResult.recommended_angle?.name || "未定"}`);

    return analysisResult;
  } catch (error) {
    console.error(`[01_research] LLM analysis failed: ${error}`);
    // 降级: 为每个搜索结果创建一个简单的 finding
    return {
      findings: searchResults.slice(0, 5).map(result => ({
        claim: result.description || result.title,
        confidence_type: "BELIEF" as const,
        confidence_score: 0.5,
        sources: [{
          url: result.url,
          title: result.title,
          domain: new URL(result.url).hostname
        }],
        cross_verified: false,
        freshness_status: "current" as const
      }))
    };
  }
}

/**
 * 解析 Markdown 调研报告
 *
 * 从 LLM 生成的 Markdown 报告中提取结构化数据
 */
function parseMarkdownReport(
  markdown: string,
  searchResults: Array<{ title: string; url: string; description?: string }>
): {
  findings: Finding[];
  key_insights?: string[];
  data_points?: Record<string, string>;
  framework?: string;
  angles?: Array<{
    name: string;
    core_argument: string;
    evidence: string[];
    differentiation: string;
    feasibility: number;
  }>;
  recommended_angle?: {
    name: string;
    core_argument: string;
    evidence: string[];
    differentiation: string;
    feasibility: number;
  };
  markdown_report?: string;  // 新增：保存原始 Markdown 报告
} {
  const result: any = {
    findings: [],
    key_insights: [],
    data_points: {},
    framework: "",
    angles: [],
    recommended_angle: null,
    markdown_report: markdown  // 保存原始报告
  };

  try {
    // ========== 解析核心事件概览 ==========
    const essenceMatch = markdown.match(/### 事件本质\s*\n+(.*?)(?=\n###|\n##|\n\*|$)/s);
    if (essenceMatch) {
      result.findings.push({
        claim: essenceMatch[1].trim(),
        confidence_type: "BELIEF",
        confidence_score: 0.8,
        sources: searchResults.slice(0, 2).map(r => ({
          url: r.url,
          title: r.title,
          domain: new URL(r.url).hostname
        })),
        cross_verified: searchResults.length >= 2,
        freshness_status: "current"
      });
    }

    // ========== 解析关键洞察（从各部分提取） ==========
    const insights: string[] = [];

    // 从"市场影响"部分提取
    const marketImpactMatch = markdown.match(/## 四、市场影响[\s\S]*?### 对行业的影响\s*\n+(.*?)(?=\n###|\n##|$)/s);
    if (marketImpactMatch) {
      insights.push(`行业影响：${marketImpactMatch[1].trim().substring(0, 100)}`);
    }

    // 从"技术趋势"部分提取
    const trendMatch = markdown.match(/## 六、技术趋势[\s\S]*?### 行业趋势\s*\n+(.*?)(?=\n###|\n##|$)/s);
    if (trendMatch) {
      insights.push(`行业趋势：${trendMatch[1].trim().substring(0, 100)}`);
    }

    result.key_insights = insights;

    // ========== 解析写作角度建议 ==========
    const anglesSectionMatch = markdown.match(/## 七、写作角度建议([\s\S]*?)##/);
    if (anglesSectionMatch) {
      // 更健壮的正则：匹配 LLM 实际输出的格式
      // 格式: ### 角度 1：名称\n**核心观点**：...\n**核心要点**：\n- ...\n**优势**：...
      const angleMatches = anglesSectionMatch[1].matchAll(/### 角度\s*\d+[:：]\s*(.*?)\s*\n\*\*核心观点\*\*[:：]\s*(.*?)\s*\n\*\*核心要点\*\*[:：]\s*\n([\s\S]*?)\n\*\*优势\*\*[:：]\s*(.*?)\s*(?=\n### 角度|\n##|$)/g);

      for (const match of angleMatches) {
        const name = match[1].trim();
        const coreArgument = match[2].trim();
        const pointsText = match[3].trim();
        const advantage = match[4].trim();

        // 提取要点（列表格式）
        const evidence = pointsText
          .split(/\n/)
          .map(line => line.replace(/^[-*]\s*/, "").trim())
          .filter(line => line.length > 0)
          .slice(0, 5);

        result.angles.push({
          name,
          core_argument: coreArgument,
          evidence,
          differentiation: advantage,
          feasibility: 8  // 默认评分
        });
      }
    }

    // ========== 解析标题建议 ==========
    const titlesSectionMatch = markdown.match(/### 标题建议\s*\n([\s\S]*?)(?=\n###|\n##|$)/);
    if (titlesSectionMatch) {
      const titleMatches = titlesSectionMatch[1].match(/^\d+\.\s*(.*?)$/gm);
      if (titleMatches) {
        result.title_suggestions = titleMatches.map(t => t.replace(/^\d+\.\s*/, "").trim());
      }
    }

    // ========== 解析数据点 ==========
    const dataSectionMatch = markdown.match(/### 关键数据点\s*\n([\s\S]*?)(?=\n###|\n##|$)/);
    if (dataSectionMatch) {
      const lines = dataSectionMatch[1].split('\n').filter(line => line.trim());
      const dataPoints: Record<string, string> = {};
      lines.forEach((line, i) => {
        const match = line.match(/^[-*]?\s*(.*?)[:：]\s*(.*)$/);
        if (match) {
          dataPoints[match[1].trim()] = match[2].trim();
        } else if (line.trim() && i < 10) {
          dataPoints[`数据点${i + 1}`] = line.trim().replace(/^[-*]\s*/, "");
        }
      });
      result.data_points = dataPoints;
    }

    // ========== 设置推荐角度（第一个角度） ==========
    if (result.angles && result.angles.length > 0) {
      result.recommended_angle = result.angles[0];
    }

    console.log(`[01_research] Markdown 解析成功`);
    console.log(`[01_research] - 提取 ${result.angles?.length || 0} 个写作角度`);
    console.log(`[01_research] - 提取 ${result.key_insights?.length || 0} 个关键洞察`);
  } catch (error) {
    console.error(`[01_research] Markdown 解析失败: ${error}`);
    // 使用降级方案
  }

  // 确保至少有基本的 findings
  if (result.findings.length === 0) {
    result.findings = searchResults.slice(0, 5).map(result => ({
      claim: result.description || result.title,
      confidence_type: "BELIEF",
      confidence_score: 0.5,
      sources: [{
        url: result.url,
        title: result.title,
        domain: new URL(result.url).hostname
      }],
      cross_verified: false,
      freshness_status: "current"
    }));
  }

  return result;
}

/**
 * 获取默认输出路径
 */
function getDefaultOutputPath(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const runId = `article-${timestamp}`;
  return join(process.cwd(), "output", runId);
}
