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
import { getNodeLLMConfig } from "../../../config/llm.js";
import { LLMClient } from "../../../utils/llm-client.js";

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

  // ========== 步骤 2: 并行执行搜索和分析 ==========
  console.log("[01_research] Step 2: Running parallel research...");

  const [searchResults, trends] = await Promise.all([
    performSearch(inputDetection.topic),
    analyzeTrends(inputDetection.topic)
  ]);

  console.log(`[01_research] Found ${searchResults.length} search results`);
  console.log(`[01_research] Identified ${trends.length} trends`);

  // ========== 步骤 3: 使用 LLM 分析结果（重构版） ==========
  console.log("[01_research] Step 3: Analyzing with LLM...");
  const analysisResult = await analyzeWithLLM(inputDetection.topic, searchResults);

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
    limit: 10,
    timeout: 8000,
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
 * 分析趋势
 *
 * 简化版: 使用关键词检测
 * TODO: 集成真实的趋势分析 API
 */
async function analyzeTrends(topic: string): Promise<Trend[]> {
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
  }>
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
}> {
  if (searchResults.length === 0) {
    console.log("[01_research] No search results to analyze");
    return { findings: [] };
  }

  const llmConfig = getNodeLLMConfig("research");
  const client = new LLMClient(llmConfig);

  // 构建分析 Prompt（内容创作视角）
  const searchResultsText = searchResults
    .map((r, i) => `${i + 1}. ${r.title}\n   URL: ${r.url}\n   摘要: ${r.description || "无摘要"}\n`)
    .join("\n");

  const prompt = `你是一位专业的内容创作研究员，擅长从搜索结果中提取创作素材和洞察。

主题: ${topic}

搜索结果 (${searchResults.length} 条):
${searchResultsText}

请从**内容创作视角**分析这些结果，输出以下内容：

1. **关键发现** (3-5个)
   - 核心观点（claim）
   - 支持来源数量

2. **关键洞察** (3-5个)
   - 从搜索结果中提炼的核心洞察
   - 每个洞察用"洞察名称：详细说明"的格式

3. **数据支撑**
   - 提取所有具体数字、百分比、对比数据
   - 格式：{"关键指标": "具体数值"}

4. **分析框架** (如果适用)
   - 构建一个分析框架来组织内容
   - 格式：用分层结构表示（如"第一层：... 第二层：..."）

5. **差异化角度建议** (3个)
   - 为这个主题设计3个不同的写作角度
   - 每个角度包含：名称、核心论点、论据支撑、差异化说明、可行性评分(0-10)

6. **推荐写作角度**
   - 从3个角度中选择最优的一个
   - 给出推荐理由（3条以上）

输出格式(JSON):
{
  "findings": [
    {"claim": "观点", "sources_count": 2}
  ],
  "key_insights": [
    "规模陷阱与效率困境：连锁餐饮在扩张过程中面临单店效率与规模脱钩的问题"
  ],
  "data_points": {
    "海底捞2020年客单价": "110元",
    "海底捞2024年客单价": "97.5元"
  },
  "framework": "第一层：路径依赖\n第二层：体系成本刚性\n...",
  "angles": [
    {
      "name": "组织管理视角",
      "core_argument": "西贝的困境是组织能力陷阱，不是个人心理问题",
      "evidence": ["中央厨房模式的效率悖论", "体系成本刚性"],
      "differentiation": "与《贾国龙的心魔》（个人心理）形成互补",
      "feasibility": 9
    }
  ],
  "recommended_angle": {
    "name": "组织管理视角",
    "core_argument": "西贝的困境是组织能力陷阱",
    "evidence": ["证据1", "证据2"],
    "differentiation": "与参考文章形成互补",
    "feasibility": 9
  }
}`;

  try {
    const response = await client.call({
      prompt,
      systemMessage: "你是一位专业的内容创作研究员，擅长从搜索结果中提炼创作素材、洞察和框架。你的输出必须严格符合 JSON 格式。"
    });

    // 解析 LLM 输出
    const analysisResult = parseLLMAnalysisOutput(response.text, searchResults);

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
 * 解析 LLM 分析输出（重构版 - 更健壮的 JSON 解析）
 */
function parseLLMAnalysisOutput(
  text: string,
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
} {
  const result: any = {
    findings: [],
    key_insights: [],
    data_points: {},
    framework: "",
    angles: [],
    recommended_angle: null
  };

  try {
    // 尝试多种方式提取 JSON
    let jsonStr = "";

    // 方法 1: 尝试直接解析整个文本
    try {
      JSON.parse(text);
      jsonStr = text;
    } catch {
      // 方法 2: 提取 JSON 代码块
      const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (codeBlockMatch) {
        jsonStr = codeBlockMatch[1];
      } else {
        // 方法 3: 查找 {...}
        const braceMatch = text.match(/\{[\s\S]*\}/);
        if (braceMatch) {
          jsonStr = braceMatch[0];
        } else {
          throw new Error("No JSON found");
        }
      }
    }

    const parsed = JSON.parse(jsonStr);

    // 解析 findings
    if (parsed.findings && Array.isArray(parsed.findings)) {
      result.findings = parsed.findings.map((item: any) => ({
        claim: item.claim,
        confidence_type: "BELIEF",
        confidence_score: 0.7,
        sources: searchResults.slice(0, item.sources_count || 1).map(r => ({
          url: r.url,
          title: r.title,
          domain: new URL(r.url).hostname
        })),
        cross_verified: (item.sources_count || 1) >= 2,
        freshness_status: "current"
      }));
    }

    // 复制其他字段
    if (parsed.key_insights && Array.isArray(parsed.key_insights)) {
      result.key_insights = parsed.key_insights;
    }
    if (parsed.data_points) {
      result.data_points = parsed.data_points;
    }
    if (parsed.framework) {
      result.framework = parsed.framework;
    }
    if (parsed.angles && Array.isArray(parsed.angles)) {
      result.angles = parsed.angles;
    }
    if (parsed.recommended_angle) {
      result.recommended_angle = parsed.recommended_angle;
    }

    console.log(`[01_research] LLM JSON 解析成功`);
  } catch (error) {
    console.error(`[01_research] Failed to parse LLM analysis output: ${error}`);
    console.log(`[01_research] LLM 原始输出长度: ${text.length}`);
    // 调试：显示前 500 个字符
    console.log(`[01_research] LLM 输出预览: ${text.substring(0, 500)}...`);
  }

  // 如果解析失败或没有 findings，使用降级方案
  if (result.findings.length === 0) {
    console.log(`[01_research] 使用降级方案生成 findings`);
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
