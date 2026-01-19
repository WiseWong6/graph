import { ArticleState } from "../../state";

/**
 * End node for article generation workflow
 * Logs completion and final output location
 *
 * @param state - Current article workflow state
 * @returns Partial state with completed status
 */
export async function endNode(
  state: ArticleState
): Promise<Partial<ArticleState>> {
  console.log("[end] Workflow completed");
  console.log("[end] Output:", state.outputPath);

  return {
    status: "completed",
  };
}
