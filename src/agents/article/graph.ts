import { StateGraph, START, END } from "@langchain/langgraph";
import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite";
import { join } from "path";
import { ArticleAnnotation } from "./state";

// 导入辅助节点
import { endNode } from "./nodes/deprecated/03_end.node";

// 导入交互节点 (v2)
import { selectWechatNode } from "./nodes/00_select_wechat.node";
import { selectModelNode } from "./nodes/01_select_model.node";
import { selectTitleNode } from "./nodes/05_select_title.node";

// 导入完整流程节点 (v2)
import { researchNode } from "./nodes/02_research.node";
import { ragNode } from "./nodes/03_rag.node";
import { titlesNode } from "./nodes/04_titles.node";
import { titlesRegenerateNode } from "./nodes/04_titles_regenerate.node";
import { draftNode } from "./nodes/06_draft.node";
import { rewriteNode } from "./nodes/07_rewrite.node";
import { confirmImagesNode } from "./nodes/08_confirm.node";
import { humanizeNode } from "./nodes/09_humanize.node";
import { promptsNode } from "./nodes/10_prompts.node";
import { imagesNode } from "./nodes/11_images.node";
import { uploadImagesNode } from "./nodes/12_upload.node";
import { waitForUploadNode } from "./nodes/13_wait_for_upload.node";
import { htmlNode } from "./nodes/14_html.node";
import { draftboxNode } from "./nodes/15_draftbox.node";

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

// ========== 流程 1: 交互节点测试图 (v2) ==========

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
 * 16 节点完整流程（00-15 连续编号）：
 *
 * 前置流程:
 * START → 00_select_wechat (选公众号) → 01_select_model (选模型) → 02_research
 *
 * 第一层并行（Research 后）:
 *   02_research ─┬─→ 03_rag (RAG 检索)
 *                └─→ 04_titles (标题生成)
 *                └─→ gate_c_select_title (等待两者完成)
 *
 * 中间流程:
 * gate_c_select_title → 06_draft → 07_rewrite
 *
 * 第二层并行（Rewrite 后）:
 *   07_rewrite ─┬─→ 08_confirm → 10_prompts → 11_images → 12_upload → 13_wait_for_upload
 *               └─→ 09_humanize
 *               └─→ 14_html (汇聚点)
 *
 * 后续流程:
 * 14_html → 15_draftbox → end → END
 *
 * 节点分类:
 * - 交互节点 (4): 00_select_wechat, 01_select_model, 05_select_title, 08_confirm
 * - LLM 节点 (7): 02_research, 03_rag, 04_titles, 06_draft, 07_rewrite, 09_humanize, 10_prompts
 * - 代码节点 (5): 11_images, 12_upload, 13_wait_for_upload, 14_html, 15_draftbox
 * - 终止节点 (1): end
 *
 * 总计: 17 个节点（含 end）
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
  .addNode("gate_a_select_model", selectModelNode)

  // LLM 节点
  .addNode("02_research", researchNode)
  .addNode("03_rag", ragNode)
  .addNode("04_titles", titlesNode)
  .addNode("04_titles_regenerate", titlesRegenerateNode)
  .addNode("06_draft", draftNode)
  .addNode("07_rewrite", rewriteNode)
  .addNode("09_humanize", humanizeNode)
  .addNode("10_prompts", promptsNode)

  // 交互节点
  .addNode("gate_c_select_title", selectTitleNode)
  .addNode("08_confirm", confirmImagesNode)

  // 代码节点
  .addNode("11_images", imagesNode)
  .addNode("12_upload", uploadImagesNode)
  .addNode("13_wait_for_upload", waitForUploadNode)  // 并行同步点
  .addNode("14_html", htmlNode)
  .addNode("15_draftbox", draftboxNode)
  .addNode("end", endNode)

  // 定义流程连接
  // 前置流程
  .addEdge(START, "gate_a_select_wechat")
  .addEdge("gate_a_select_wechat", "gate_a_select_model")
  .addEdge("gate_a_select_model", "02_research")

  // 第一层并行：Research 后，RAG 和 Titles 同时执行
  .addEdge("02_research", "03_rag")
  .addEdge("02_research", "04_titles")

  // 两者都完成后，才能选择标题（使用 join 边确保同步）
  .addEdge(["03_rag", "04_titles"], "gate_c_select_title")

  // Gate C 条件边：根据用户选择决定下一步
  // - 如果选择"重新生成标题"：走专门的重新生成节点（避免 join edge 冲突）
  // - 否则：继续到 06_draft
  .addConditionalEdges(
    "gate_c_select_title",
    (state: typeof ArticleAnnotation.State) => {
      if (state.decisions?.regenerateTitles) {
        return "regenerate";
      }
      return "continue";
    },
    {
      regenerate: "04_titles_regenerate",
      continue: "06_draft"
    }
  )
  // 重新生成后回到选择节点（使用单边，不是 join，避免冲突）
  .addEdge("04_titles_regenerate", "gate_c_select_title")
  .addEdge("06_draft", "07_rewrite")

  // 并行起点：从 07_rewrite 进入 confirm 节点
  .addEdge("07_rewrite", "08_confirm")       // rewrite → confirm

  // confirm 完成后，同时触发图片分支和文本分支（无条件并行）
  // 图片分支：10_prompts → 11_images → 12_upload → 13_wait_for_upload
  // 文本分支：09_humanize
  // 两个分支在 14_html 汇聚（LangGraph 自动等待所有入边完成）
  .addEdge("08_confirm", "10_prompts")       // confirm → prompts（图片分支）
  .addEdge("08_confirm", "09_humanize")      // confirm → humanize（文本分支）

  // 图片流程：prompts → images → upload → wait_for_upload（并行同步点）
  .addEdge("10_prompts", "11_images")
  .addEdge("11_images", "12_upload")
  .addEdge("12_upload", "13_wait_for_upload")

  // 汇聚点：html 等待 humanize 和 wait_for_upload 都完成（使用 join 边确保同步）
  // wait_for_upload 只在 12_upload 完成后才触发，确保 14_html 在正确时机执行
  .addEdge(["13_wait_for_upload", "09_humanize"], "14_html")

  // 后续节点
  .addEdge("14_html", "15_draftbox")
  .addEdge("15_draftbox", "end")
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

/**
 * 主图 (默认导出完整 Article Agent Workflow v2)
 */
export const graph = fullArticleWorkflow.compile({ checkpointer });

/**
 * 备用单节点图 (使用完整工作流)
 */
export const singleNodeGraph = fullArticleWorkflow.compile({ checkpointer });
