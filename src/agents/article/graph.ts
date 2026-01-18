import { StateGraph, START, END } from "@langchain/langgraph";
import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite";
import { join } from "path";
import { ArticleAnnotation } from "./state";

// 导入 MVP 节点
import { simpleLlmNode } from "./nodes/01_simple_llm.node";
import { simpleLlmNode2 } from "./nodes/02_simple_llm.node";
import { simpleLlmNode3 } from "./nodes/03_simple_llm.node";
import { saveOutputNode } from "./nodes/02_save_output.node";
import { endNode } from "./nodes/03_end.node";

// 导入交互节点 (v2)
import { selectWechatNode } from "./nodes/00_select_wechat.node";
import { selectTitleNode } from "./nodes/04_select_title.node";

// 导入完整流程节点 (v2)
import { researchNode } from "./nodes/01_research.node";
import { ragNode } from "./nodes/02_rag.node";
import { titlesNode } from "./nodes/03_titles.node";
import { draftNode } from "./nodes/05_draft.node";
import { polishNode } from "./nodes/06_polish.node";
import { rewriteNode } from "./nodes/07_rewrite.node";
import { confirmImagesNode } from "./nodes/08_confirm.node";
import { humanizeNode } from "./nodes/09_humanize.node";
import { promptsNode } from "./nodes/10_prompts.node";
import { imagesNode } from "./nodes/11_images.node";
import { uploadImagesNode } from "./nodes/12_upload.node";
import { htmlNode } from "./nodes/13_html.node";
import { draftboxNode } from "./nodes/14_draftbox.node";

/**
 * Checkpoint 配置
 *
 * 使用 SQLite 持久化状态,支持中断和恢复
 *
 * TODO: 生产环境应使用环境变量配置路径
 */
const checkpointer = SqliteSaver.fromConnString(
  join(process.cwd(), "src", "checkpoints", "article", "checkpoints.db")
);

// ========== 流程 1: 多节点测试图（MVP） ==========

/**
 * 多节点测试图（3 个 LLM 节点并行）
 *
 * 并行流程: START → [llm_1, llm_2, llm_3] → save → end → END
 *
 * 节点职责:
 * - llm_1: 调用 LLM 生成文本 (配置1)
 * - llm_2: 调用 LLM 生成文本 (配置2)
 * - llm_3: 调用 LLM 生成文本 (配置3)
 * - save: 保存所有输出到文件系统
 * - end: 清理和确认
 *
 * 设计原则:
 * - 每个节点只做一件事
 * - 并行执行提高效率
 * - 无条件分支,无特殊情况
 */
const multiNodeWorkflow = new StateGraph(ArticleAnnotation)
  .addNode("llm_1", simpleLlmNode)
  .addNode("llm_2", simpleLlmNode2)
  .addNode("llm_3", simpleLlmNode3)
  .addNode("save", saveOutputNode)
  .addNode("end", endNode)
  .addEdge(START, "llm_1")
  .addEdge(START, "llm_2")
  .addEdge(START, "llm_3")
  .addEdge("llm_1", "save")
  .addEdge("llm_2", "save")
  .addEdge("llm_3", "save")
  .addEdge("save", "end")
  .addEdge("end", END);

// ========== 流程 2: 交互节点测试图 (v2) ==========

/**
 * 交互节点测试图
 *
 * 测试 3 个交互节点:
 * - Gate A (select_wechat): 启动时选择公众号
 * - Gate B (confirm_images): 确认图片配置
 * - Gate C (select_title): 选择标题
 *
 * 流程: START → Gate A → Gate B → Gate C → end → END
 *
 * 注意: 这是一个简化的测试流程，用于验证交互节点功能。
 * 完整流程将在后续阶段实现。
 */
const interactiveTestWorkflow = new StateGraph(ArticleAnnotation)
  .addNode("gate_a_select_wechat", selectWechatNode)
  .addNode("gate_b_confirm_images", confirmImagesNode)
  .addNode("gate_c_select_title", selectTitleNode)
  .addNode("end", endNode)
  .addEdge(START, "gate_a_select_wechat")
  .addEdge("gate_a_select_wechat", "gate_b_confirm_images")
  .addEdge("gate_b_confirm_images", "gate_c_select_title")
  .addEdge("gate_c_select_title", "end")
  .addEdge("end", END);

// ========== 导出编译后的图实例 ==========

/**
 * 主图 (MVP 多节点测试)
 */
export const graph = multiNodeWorkflow.compile({ checkpointer });

/**
 * 备用单节点图
 */
export const singleNodeGraph = multiNodeWorkflow.compile({ checkpointer });

/**
 * 交互测试图 (v2)
 *
 * 使用方式:
 * ```ts
 * import { interactiveGraph } from "./graph";
 *
 * // 运行交互测试
 * const result = await interactiveGraph.invoke(
 *   { prompt: "测试", titles: ["标题1", "标题2", "标题3"] },
 *   { configurable: { thread_id: "test-interactive" } }
 * );
 * ```
 */
export const interactiveGraph = interactiveTestWorkflow.compile({ checkpointer });

// ========== 流程 3: 完整 Article Agent Workflow (v2) ==========

/**
 * 完整 Article Agent 工作流 (v2)
 *
 * 15 节点完整流程（双重并行优化）:
 *
 * 前置流程:
 * START → Gate A (选公众号) → 01_research
 *
 * 第一层并行（Research 后）:
 *   01_research ─┬─→ 02_rag (RAG 检索)
 *                └─→ 03_titles (标题生成)
 *                └─→ gate_c_select_title (等待两者完成)
 *
 * 中间流程:
 * gate_c_select_title → 05_draft → 06_polish → 07_rewrite
 *
 * 第二层并行（Rewrite 后）:
 *   07_rewrite ─┬─→ 08_confirm → 10_prompts → 11_images → 12_upload
 *               └─→ 09_humanize
 *               └─→ 13_html (汇聚点)
 *
 * 后续流程:
 * 13_html → 14_draftbox → end → END
 *
 * 节点分类:
 * - 交互节点 (3): select_wechat, select_title, confirm
 * - LLM 节点 (7): research, rag, titles, draft, polish, rewrite, humanize, prompts
 * - 代码节点 (5): images, upload, html, draftbox, end
 *
 * 设计原则:
 * - 每个节点只做一件事
 * - 数据流清晰,无循环
 * - 支持中断和恢复
 * - RAG + Titles 并行（节省检索时间）
 * - prompts + humanize 并行（节省文本处理时间）
 */
const fullArticleWorkflow = new StateGraph(ArticleAnnotation)
  // 交互节点
  .addNode("gate_a_select_wechat", selectWechatNode)

  // LLM 节点
  .addNode("01_research", researchNode)
  .addNode("02_rag", ragNode)
  .addNode("03_titles", titlesNode)
  .addNode("05_draft", draftNode)
  .addNode("06_polish", polishNode)
  .addNode("07_rewrite", rewriteNode)
  .addNode("09_humanize", humanizeNode)
  .addNode("10_prompts", promptsNode)

  // 交互节点
  .addNode("gate_c_select_title", selectTitleNode)
  .addNode("08_confirm", confirmImagesNode)

  // 代码节点
  .addNode("11_images", imagesNode)
  .addNode("12_upload", uploadImagesNode)
  .addNode("13_html", htmlNode)
  .addNode("14_draftbox", draftboxNode)
  .addNode("end", endNode)

  // 定义流程连接
  // 前置流程
  .addEdge(START, "gate_a_select_wechat")
  .addEdge("gate_a_select_wechat", "01_research")

  // 第一层并行：Research 后，RAG 和 Titles 同时执行
  .addEdge("01_research", "02_rag")
  .addEdge("01_research", "03_titles")

  // 两者都完成后，才能选择标题（LangGraph 自动等待所有入边完成）
  .addEdge("02_rag", "gate_c_select_title")
  .addEdge("03_titles", "gate_c_select_title")
  .addEdge("gate_c_select_title", "05_draft")
  .addEdge("05_draft", "06_polish")
  .addEdge("06_polish", "07_rewrite")

  // 并行起点：从 07_rewrite 进入 confirm 节点
  .addEdge("07_rewrite", "08_confirm")       // rewrite → confirm

  // confirm 完成后，并行触发 prompts 和 humanize（传递 imageCount）
  .addEdge("08_confirm", "10_prompts")       // confirm → prompts
  .addEdge("08_confirm", "09_humanize")      // confirm → humanize（并行执行）

  // 图片流程：prompts → images → upload
  .addEdge("10_prompts", "11_images")
  .addEdge("11_images", "12_upload")

  // 汇聚点：html 等待 humanize 和 upload 都完成（严格顺序）
  // 注意：必须将 upload 的边放在 humanize 之前，确保 LangGraph 正确处理
  .addEdge("12_upload", "13_html")
  .addEdge("09_humanize", "13_html")

  // 后续节点
  .addEdge("13_html", "14_draftbox")
  .addEdge("14_draftbox", "end")
  .addEdge("end", END);

/**
 * 完整 Article Agent 图 (v2)
 *
 * 使用方式:
 * ```ts
 * import { fullArticleGraph } from "./graph";
 *
 * // 运行完整流程
 * const result = await fullArticleGraph.invoke(
 *   { prompt: "写一篇关于 AI Agent 的文章" },
 *   { configurable: { thread_id: "article-001" } }
 * );
 * ```
 */
export const fullArticleGraph = fullArticleWorkflow.compile({ checkpointer });
