/**
 * Wait For Upload 节点 - 并行同步点
 *
 * 职责: 作为 12_html 的同步点，确保 11_upload 完成后再汇聚
 *
 * 解决的问题:
 * - 08_humanize 和 09_prompts→10_images→11_upload 并行执行
 * - 12_html 需要等待 08_humanize AND 11_upload 都完成
 * - 此节点仅作为图片分支完成后的同步点
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
  console.log("[wait_for_upload] 11_upload has completed, waiting to join with 08_humanize");
  console.log("[wait_for_upload] ========== END ==========");

  // 不需要返回任何状态更新，只是作为同步点
  return {};
}
