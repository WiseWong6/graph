/**
 * Polish 节点
 *
 * 职责: 润色初稿,提升可读性和表达质量
 *
 * 数据流:
 * draft → LLM 润色 → polished
 *
 * 设计原则:
 * - 保持原意不变
 * - 提升表达流畅度
 * - 优化段落结构
 */

import { writeFileSync } from "fs";
import { join } from "path";
import { ArticleState } from "../state";
import { getNodeLLMConfig } from "../../../config/llm.js";
import { LLMClient } from "../../../utils/llm-client.js";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env") });

/**
 * Polish 节点主函数
 *
 * @param state - 当前状态
 * @returns 更新的状态
 */
export async function polishNode(state: ArticleState): Promise<Partial<ArticleState>> {
  console.log("[06_polish] Polishing draft...");

  if (!state.draft) {
    console.error("[06_polish] No draft to polish");
    throw new Error("Draft not found in state");
  }

  // ========== 构建 Prompt ==========
  const prompt = buildPolishPrompt(state.draft);

  // ========== 调用 LLM ==========
  const llmConfig = getNodeLLMConfig("polish");
  const client = new LLMClient(llmConfig);

  console.log("[06_polish] Calling LLM with config:", llmConfig.model);

  try {
    const response = await client.call({
      prompt,
      systemMessage: POLISH_SYSTEM_MESSAGE
    });

    console.log("[06_polish] Polish completed, length:", response.text.length);

    const polished = response.text;

    // ========== 保存润色稿 ==========
    const outputPath = state.outputPath || getDefaultOutputPath();
    const polishedPath = join(outputPath, "drafts", "06_polished.md");
    writeFileSync(polishedPath, polished, "utf-8");
    console.log("[06_polish] Saved polished:", polishedPath);

    return {
      polished
    };
  } catch (error) {
    console.error(`[06_polish] Failed to polish: ${error}`);
    // 降级: 返回原稿
    return {
      polished: state.draft
    };
  }
}

/**
 * 构建润色 Prompt
 */
function buildPolishPrompt(draft: string): string {
  return `请润色以下文章,保持原意的同时提升表达质量:

${draft}

润色要求:
1. 保持所有核心观点和信息
2. 优化句子结构,提升流畅度
3. 增加必要的过渡词
4. 适度使用修辞手法
5. 保持 Markdown 格式

请直接输出润色后的完整文章。`;
}

/**
 * System Message
 */
const POLISH_SYSTEM_MESSAGE = `你是一个专业的文字编辑,擅长润色和优化文章。

你的核心能力:
- 保持原意的优化表达
- 提升语言流畅度
- 优化段落结构
- 修正语法错误

润色原则:
1. 少即是多: 不做过度修饰
2. 保持个性: 保留作者风格
3. 清晰优先: 确保意思明确
4. 节奏感: 长短句交替

不要做的:
- 不要改变原意
- 不要添加新信息
- 不要过度使用形容词
- 不要改变文章结构`;

/**
 * 获取默认输出路径
 */
function getDefaultOutputPath(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const runId = `article-${timestamp}`;
  return join(process.cwd(), "output", runId);
}
