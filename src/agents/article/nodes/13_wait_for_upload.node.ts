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
  console.log("[wait_for_upload] imagePaths 存在:", !!state.imagePaths);
  console.log("[wait_for_upload] imagePaths 数量:", state.imagePaths?.length || 0);
  console.log("[wait_for_upload] uploadedImageUrls 存在:", !!state.uploadedImageUrls);
  console.log("[wait_for_upload] uploadedImageUrls 数量:", state.uploadedImageUrls?.length || 0);

  // 检查 imagePaths 是否存在
  if (!state.imagePaths || state.imagePaths.length === 0) {
    console.log("[wait_for_upload] 没有图片需要上传，跳过验证");
    console.log("[wait_for_upload] ========== END ==========");
    return {};
  }

  // 验证上传结果
  if (!state.uploadedImageUrls) {
    console.error("[wait_for_upload] ❌ 错误：uploadedImageUrls 不存在");
    console.error("[wait_for_upload] 这意味着 12_upload 节点没有正确执行");
    throw new Error("图片上传未完成：uploadedImageUrls 数据缺失，请检查 12_upload 节点");
  }

  if (state.uploadedImageUrls.length === 0) {
    console.error("[wait_for_upload] ❌ 错误：uploadedImageUrls 为空数组");
    console.error("[wait_for_upload] 这意味着所有图片上传都失败了");
    throw new Error("图片上传失败：所有图片上传均未成功，请检查网络连接和微信配置");
  }

  if (state.uploadedImageUrls.length !== state.imagePaths.length) {
    console.error(`[wait_for_upload] ❌ 错误：上传数量不匹配`);
    console.error(`[wait_for_upload] 预期 ${state.imagePaths.length} 张，实际 ${state.uploadedImageUrls.length} 张`);
    throw new Error(`图片上传不完整：预期 ${state.imagePaths.length} 张，实际成功 ${state.uploadedImageUrls.length} 张`);
  }

  console.log(`[wait_for_upload] ✅ 图片上传验证通过：${state.uploadedImageUrls.length}/${state.imagePaths.length}`);
  console.log("[wait_for_upload] 等待 08_humanize 节点完成");
  console.log("[wait_for_upload] ========== END ==========");

  // 不需要返回任何状态更新，只是作为同步点
  return {};
}
