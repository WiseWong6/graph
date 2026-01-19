/**
 * Titles Regenerate 节点
 *
 * 职责: 重新生成标题（避免与 join edge 产生冲突）
 *
 * 为什么需要单独的节点:
 * - LangGraph 的 join edge (.addEdge([parent1, parent2], child)) 会触发"响应式"行为
 * - 每当任一父节点完成时，都会触发子节点执行
 * - 当用户选择"重新生成标题"时，04_titles 重新完成后会再次触发 gate_c_select_title
 * - 但由于状态同步问题，可能导致交互界面不显示
 *
 * 解决方案:
 * - 创建专门的重新生成节点 04_titles_regenerate
 * - 重新生成后使用单边回到 gate_c_select_title（不是 join）
 * - 避免与 join edge 的响应式行为冲突
 *
 * 设计原则:
 * - 复用 titlesNode 的逻辑
 * - 清除 regenerateTitles 标志，防止无限循环
 */

import { ArticleState } from "../state";
import { titlesNode } from "./04_titles.node.js";

/**
 * 标题重新生成节点
 *
 * @param state - 当前状态
 * @returns 更新的状态
 */
export async function titlesRegenerateNode(
  state: ArticleState
): Promise<Partial<ArticleState>> {
  console.log("[04_titles_regenerate] 重新生成标题\n");

  // 复用原有的标题生成逻辑
  const result = await titlesNode(state);

  // 清除重新生成标志，防止无限循环
  return {
    ...result,
    decisions: {
      ...result.decisions,
      regenerateTitles: false
    }
  };
}

/**
 * 节点信息（用于文档和调试）
 */
export const titlesRegenerateNodeInfo = {
  name: "titles_regenerate",
  type: "llm" as const,
  description: "重新生成标题（避免与 join edge 冲突）",
  writes: ["titles", "decisions.regenerateTitles"]
};
