"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fullArticleGraph = exports.interactiveGraph = exports.singleNodeGraph = exports.graph = void 0;
var langgraph_1 = require("@langchain/langgraph");
var langgraph_checkpoint_sqlite_1 = require("@langchain/langgraph-checkpoint-sqlite");
var path_1 = require("path");
var state_1 = require("./state");
// 导入 MVP 节点
var _01_simple_llm_node_1 = require("./nodes/01_simple_llm.node");
var _02_simple_llm_node_1 = require("./nodes/02_simple_llm.node");
var _03_simple_llm_node_1 = require("./nodes/03_simple_llm.node");
var _02_save_output_node_1 = require("./nodes/02_save_output.node");
var _03_end_node_1 = require("./nodes/03_end.node");
// 导入交互节点 (v2)
var _00_select_wechat_node_1 = require("./nodes/00_select_wechat.node");
var _04_select_title_node_1 = require("./nodes/04_select_title.node");
// 导入完整流程节点 (v2)
var _01_research_node_1 = require("./nodes/01_research.node");
var _02_rag_node_1 = require("./nodes/02_rag.node");
var _03_titles_node_1 = require("./nodes/03_titles.node");
var _05_draft_node_1 = require("./nodes/05_draft.node");
var _06_polish_node_1 = require("./nodes/06_polish.node");
var _07_rewrite_node_1 = require("./nodes/07_rewrite.node");
var _08_confirm_node_1 = require("./nodes/08_confirm.node");
var _09_humanize_node_1 = require("./nodes/09_humanize.node");
var _10_prompts_node_1 = require("./nodes/10_prompts.node");
var _11_images_node_1 = require("./nodes/11_images.node");
var _12_upload_node_1 = require("./nodes/12_upload.node");
var _13_html_node_1 = require("./nodes/13_html.node");
var _14_draftbox_node_1 = require("./nodes/14_draftbox.node");
/**
 * Checkpoint 配置
 *
 * 使用 SQLite 持久化状态,支持中断和恢复
 *
 * TODO: 生产环境应使用环境变量配置路径
 */
var checkpointer = langgraph_checkpoint_sqlite_1.SqliteSaver.fromConnString((0, path_1.join)(process.cwd(), "src", "checkpoints", "article", "checkpoints.db"));
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
var multiNodeWorkflow = new langgraph_1.StateGraph(state_1.ArticleAnnotation)
    .addNode("llm_1", _01_simple_llm_node_1.simpleLlmNode)
    .addNode("llm_2", _02_simple_llm_node_1.simpleLlmNode2)
    .addNode("llm_3", _03_simple_llm_node_1.simpleLlmNode3)
    .addNode("save", _02_save_output_node_1.saveOutputNode)
    .addNode("end", _03_end_node_1.endNode)
    .addEdge(langgraph_1.START, "llm_1")
    .addEdge(langgraph_1.START, "llm_2")
    .addEdge(langgraph_1.START, "llm_3")
    .addEdge("llm_1", "save")
    .addEdge("llm_2", "save")
    .addEdge("llm_3", "save")
    .addEdge("save", "end")
    .addEdge("end", langgraph_1.END);
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
var interactiveTestWorkflow = new langgraph_1.StateGraph(state_1.ArticleAnnotation)
    .addNode("gate_a_select_wechat", _00_select_wechat_node_1.selectWechatNode)
    .addNode("gate_b_confirm_images", _08_confirm_node_1.confirmImagesNode)
    .addNode("gate_c_select_title", _04_select_title_node_1.selectTitleNode)
    .addNode("end", _03_end_node_1.endNode)
    .addEdge(langgraph_1.START, "gate_a_select_wechat")
    .addEdge("gate_a_select_wechat", "gate_b_confirm_images")
    .addEdge("gate_b_confirm_images", "gate_c_select_title")
    .addEdge("gate_c_select_title", "end")
    .addEdge("end", langgraph_1.END);
// ========== 导出编译后的图实例 ==========
/**
 * 主图 (MVP 多节点测试)
 */
exports.graph = multiNodeWorkflow.compile({ checkpointer: checkpointer });
/**
 * 备用单节点图
 */
exports.singleNodeGraph = multiNodeWorkflow.compile({ checkpointer: checkpointer });
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
exports.interactiveGraph = interactiveTestWorkflow.compile({ checkpointer: checkpointer });
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
var fullArticleWorkflow = new langgraph_1.StateGraph(state_1.ArticleAnnotation)
    // 交互节点
    .addNode("gate_a_select_wechat", _00_select_wechat_node_1.selectWechatNode)
    // LLM 节点
    .addNode("01_research", _01_research_node_1.researchNode)
    .addNode("02_rag", _02_rag_node_1.ragNode)
    .addNode("03_titles", _03_titles_node_1.titlesNode)
    .addNode("05_draft", _05_draft_node_1.draftNode)
    .addNode("06_polish", _06_polish_node_1.polishNode)
    .addNode("07_rewrite", _07_rewrite_node_1.rewriteNode)
    .addNode("09_humanize", _09_humanize_node_1.humanizeNode)
    .addNode("10_prompts", _10_prompts_node_1.promptsNode)
    // 交互节点
    .addNode("gate_c_select_title", _04_select_title_node_1.selectTitleNode)
    .addNode("08_confirm", _08_confirm_node_1.confirmImagesNode)
    // 代码节点
    .addNode("11_images", _11_images_node_1.imagesNode)
    .addNode("12_upload", _12_upload_node_1.uploadImagesNode)
    .addNode("13_html", _13_html_node_1.htmlNode)
    .addNode("14_draftbox", _14_draftbox_node_1.draftboxNode)
    .addNode("end", _03_end_node_1.endNode)
    // 定义流程连接
    // 前置流程
    .addEdge(langgraph_1.START, "gate_a_select_wechat")
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
    // 并行起点：从 07_rewrite 分出两个分支
    .addEdge("07_rewrite", "08_confirm") // 分支 1: 确认图片配置
    .addEdge("07_rewrite", "09_humanize") // 分支 2: 等待 confirm 结果
    // confirm 完成后，触发 prompts 和 humanize
    .addEdge("08_confirm", "10_prompts") // prompts 基于 draft 生成提示词
    .addEdge("08_confirm", "09_humanize") // confirm → humanize (传递 imageCount)
    // 图片流程：prompts → images → upload
    .addEdge("10_prompts", "11_images")
    .addEdge("11_images", "12_upload")
    // 汇聚点：html 等待 humanize 和 upload 都完成
    .addEdge("09_humanize", "13_html")
    .addEdge("12_upload", "13_html")
    // 后续节点
    .addEdge("13_html", "14_draftbox")
    .addEdge("14_draftbox", "end")
    .addEdge("end", langgraph_1.END);
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
exports.fullArticleGraph = fullArticleWorkflow.compile({ checkpointer: checkpointer });
