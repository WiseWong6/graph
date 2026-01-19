/**
 * Wait For Upload 节点 - 并行同步点
 *
 * 职责: 等待 10_images 完成后再让 08_humanize 继续
 *
 * 解决的问题:
 * - 08_humanize 和 09_prompts→10_images 并行执行
 * - 12_html 需要等待 08_humanize AND 11_upload 都完成
 * - 但 LangGraph 可能在 08_humanize 完成时就触发 12_html
 * - 此节点确保 08_humanize 分支等待 10_images 完成后才触发 12_html
 *
 * 数据流:
 * (等待 imagePaths 存在) → 12_html
 */

import { ArticleState } from "../state.js";

/**
 * Wait For Upload 节点主函数
 *
 * @param state - 当前状态
 * @returns 更新的状态
 */
export async function waitForUploadNode(state: ArticleState): Promise<Partial<ArticleState>> {
  console.log("[wait_for_upload] ========== START ==========");
  console.log("[wait_for_upload] imagePaths exists:", !!state.imagePaths);
  console.log("[wait_for_upload] imagePaths.length:", state.imagePaths?.length || 0);

  // 检查 imagePaths 是否存在
  if (!state.imagePaths || state.imagePaths.length === 0) {
    console.log("[wait_for_upload] No imagePaths found, skipping sync");
    console.log("[wait_for_upload] ========== END ==========");
    return {};
  }

  console.log(`[wait_for_upload] imagePaths exists with ${state.imagePaths.length} paths`);
  console.log("[wait_for_upload] 10_images has completed, allowing 08_humanize to proceed");
  console.log("[wait_for_upload] ========== END ==========");

  // 不需要返回任何状态更新，只是作为同步点
  return {};
}
