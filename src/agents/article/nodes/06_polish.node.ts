/**
 * Polish 节点 v2 - 使用统一错误处理和日志
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

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { ArticleState } from "../state";
import { getNodeLLMConfig } from "../../../config/llm.js";
import { LLMClient } from "../../../utils/llm-client.js";
import { config } from "dotenv";
import { resolve } from "path";
import { createLogger } from "../../../utils/logger.js";
import { ErrorHandler, ValidationError, retry } from "../../../utils/errors.js";

config({ path: resolve(process.cwd(), ".env") });

// 创建节点日志
const log = createLogger("06_polish");

/**
 * Polish 节点主函数
 *
 * @param state - 当前状态
 * @returns 更新的状态
 */
export async function polishNode(state: ArticleState): Promise<Partial<ArticleState>> {
  const timer = log.timer("polish");
  log.startStep("validate_input");

  // ========== 验证输入 ==========
  if (!state.draft) {
    throw new ValidationError("Draft content not found in state", "draft");
  }

  log.completeStep("validate_input", { inputLength: state.draft.length });

  // ========== 构建 Prompt ==========
  log.startStep("build_prompt");
  const prompt = buildPolishPrompt(state.draft);
  log.completeStep("build_prompt", { promptLength: prompt.length });

  // ========== 调用 LLM ==========
  log.startStep("llm_call");
  const llmConfig = getNodeLLMConfig("polish");
  const client = new LLMClient(llmConfig);

  log.info("LLM config:", { model: llmConfig.model, temperature: llmConfig.temperature });

  try {
    // 使用重试机制调用 LLM
    const response = await retry(
      () => client.call({
        prompt,
        systemMessage: POLISH_SYSTEM_MESSAGE
      }),
      { maxAttempts: 3, delay: 1000 }
    )();

    log.completeStep("llm_call", {
      outputLength: response.text.length,
      usage: response.usage
    });

    const polished = response.text;

    // ========== 保存润色稿 ==========
    log.startStep("save_output");
    const outputPath = state.outputPath || getDefaultOutputPath();
    const polishDir = join(outputPath, "polish");

    if (!existsSync(polishDir)) {
      mkdirSync(polishDir, { recursive: true });
    }

    const polishedPath = join(polishDir, "06_polished.md");
    writeFileSync(polishedPath, polished, "utf-8");

    log.completeStep("save_output", { path: polishedPath });
    log.success(`Complete in ${timer.log()}`);

    return {
      polished
    };
  } catch (error) {
    log.failStep("llm_call", error);
    ErrorHandler.handle(error, "06_polish");

    // 降级: 返回原稿
    log.warn("Fallback to draft content");
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
