/**
 * Humanize 节点 v2 - 使用统一错误处理和日志
 *
 * 职责: 去除 AI 味，增加活人感和情感共鸣
 *
 * 数据流:
 * rewritten (or polished) → LLM 人化 → humanized
 *
 * 设计原则:
 * - 格式清洗：去空格、标点规范、去引号
 * - 风格重写：去 AI 味、段落融合、口语化
 * - 保留 Markdown 结构（代码/链接/图片）
 *
 * 核心差异：
 * - Polish: 语言润色，保持专业感
 * - Rewrite: 智性叙事，注入灵魂
 * - Humanize: 去机械化，增加活人感
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
const log = createLogger("08_humanize");

/**
 * Humanize 节点主函数
 *
 * @param state - 当前状态
 * @returns 更新的状态
 */
export async function humanizeNode(state: ArticleState): Promise<Partial<ArticleState>> {
  const timer = log.timer("humanize");
  log.startStep("validate_input");

  // ========== 验证输入 ==========
  // 优先使用 rewritten，降级到 polished
  const input = state.rewritten || state.polished;

  if (!input) {
    throw new ValidationError("Content not found in state (need rewritten or polished)", "rewritten|polished");
  }

  const sourceType = state.rewritten ? "rewritten" : "polished";
  log.completeStep("validate_input", { sourceType, inputLength: input.length });

  // ========== 构建 Prompt ==========
  log.startStep("build_prompt");
  // 从 confirm 节点获取用户确认的图片数量
  const imageCount = state.decisions?.images?.count || 0;
  const prompt = buildHumanizePrompt(input, imageCount);
  log.completeStep("build_prompt", { promptLength: prompt.length, imageCount });

  // ========== 调用 LLM ==========
  log.startStep("llm_call");
  const llmConfig = getNodeLLMConfig("humanize");
  const client = new LLMClient(llmConfig);

  log.info("LLM config:", { model: llmConfig.model, temperature: llmConfig.temperature });

  try {
    // 使用重试机制调用 LLM
    const response = await retry(
      () => client.call({
        prompt,
        systemMessage: HUMANIZE_SYSTEM_MESSAGE
      }),
      { maxAttempts: 3, delay: 1000 }
    )();

    log.completeStep("llm_call", {
      outputLength: response.text.length,
      usage: response.usage
    });

    const humanized = response.text;

    // ========== 保存人化稿 ==========
    log.startStep("save_output");
    const outputPath = state.outputPath || getDefaultOutputPath();
    const humanizeDir = join(outputPath, "humanize");

    if (!existsSync(humanizeDir)) {
      mkdirSync(humanizeDir, { recursive: true });
    }

    const humanizedPath = join(humanizeDir, "08_humanized.md");
    writeFileSync(humanizedPath, humanized, "utf-8");

    log.completeStep("save_output", { path: humanizedPath });
    log.success(`Complete in ${timer.log()}`);

    return {
      humanized,
      outputPath
    };
  } catch (error) {
    log.failStep("llm_call", error);
    ErrorHandler.handle(error, "08_humanize");

    // 降级: 返回原输入
    log.warn("Fallback to input content");
    return {
      humanized: input
    };
  }
}

/**
 * 构建人化 Prompt
 */
function buildHumanizePrompt(content: string, imageCount: number): string {
  let prompt = `请对以下文章进行"去机械化"处理，同时完成格式清洗和风格重写：

${content}

## 处理要求

### 阶段一：格式清洗
1. **去除中英文之间多余空格**
2. **标点符号规范化**：中文标点统一用全角，英文标点用半角
3. **去除不必要的引号**：非引用内容的引号可以去掉
4. **破折号转换**：统一使用中文破折号 ———

### 阶段二：风格重写
1. **去除 AI 味**：
   - 删除"首先/其次/综上所述/值得注意的是"等机械连接词
   - 避免"随着...的发展"、"在...背景下"等模板开头
   - 减少被动语态，多用主动表达

2. **段落融合**：
   - 相关观点自然过渡，不要用列表符号
   - 即使有多个观点，也用自然段落表达
   - 禁止："1. 2. 3." 或 "•" 等机械分点

3. **口语化表达**：
   - 适度使用："说实话/坦白讲/个人觉得/在我看来"
   - 制造共鸣："你是不是也遇到过.../有意思的是..."
   - 引导思考："为什么会这样呢?/这背后说明了什么?"

4. **节奏调整**：
   - 长短句交替，避免单调
   - 关键信息用短句强调
   - 过渡信息用长句展开

### 保护内容
- **代码块**：完全保留，不做修改
- **链接**：保留 URL 和链接文本
- **图片**：保留图片标记和描述
- **核心观点**：保持原意，只改表达
`;

  // 添加图片插入指导
  if (imageCount > 0) {
    prompt += `

## 图片插入要求
文章中共有 ${imageCount} 张配图，请在合适的位置插入图片占位符：
- 使用 Markdown 语法：\`![配图描述](索引)\`
- 索引从 0 开始：\`![配图1](0)\`、\`![配图2](1)\`、\`![配图3](2)\`
- 建议在每个核心段落后插入一张配图
- 配图描述应该简洁有力，能够呼应段落内容
- 确保索引不超过 ${imageCount - 1}

示例：
\`\`\`markdown
这是第一段内容...

![核心概念图解](0)

这是第二段内容...

![实践案例](1)

这是结论...

![总结示意图](2)
\`\`\`
`;
  }

  prompt += `

请直接输出处理后的完整文章，使用 Markdown 格式。`;

  return prompt;
}

/**
 * System Message - 去机械化专家
 */
const HUMANIZE_SYSTEM_MESSAGE = `你是一个**去机械化专家**，擅长将 AI 生成的文本转换为自然、有呼吸感的真人写作。

## 核心能力
- **格式清洗**：去除 AI 输出的典型格式问题
- **风格重写**：消除机械感，增加人的温度
- **结构保留**：保持 Markdown 结构和核心信息

## 去除 AI 味的原则

### 禁用的机械表达
- ~~"首先/其次/再次/最后"~~ → 用自然过渡
- ~~"综上所述/总而言之/由此可见"~~ → 用总结性陈述
- ~~"值得注意的是/需要指出的是"~~ → 直接陈述重点
- ~~"随着...的发展/在...背景下"~~ → 用具体场景或问题引入
- ~~"通过...可以实现/能够达到"~~ → 用主动语态

### 推荐的自然表达
- **坦白说/说实话/老实说** - 表达个人态度
- **有意思的是/令人意外的是** - 引出反直觉事实
- **这就像/打个比方** - 引入类比
- **为什么会这样?** - 引导思考
- **你是不是也遇到过...** - 制造共鸣

## 段落处理
- **禁止列表符号**：用 "更重要的是..."、"这让我想起..." 等连接
- **融合观点**：相关观点放在同一段落，自然过渡
- **长短句交替**：3-5 句的短段落 + 7-10 句的长段落

## 质量自检
输出前自问：
1. 这篇文章像真人写的吗？（有观点、有态度、有温度）
2. 是否消除了所有机械连接词？
3. 段落是否自然过渡，无列表分点？
4. 核心信息是否完整保留？

## 格式要求
- 保留 Markdown 标题结构（##, ###）
- 代码块、链接、图片完全保留
- 重点内容用 **加粗** 标注
- 短段落保持呼吸感`;

/**
 * 获取默认输出路径
 */
function getDefaultOutputPath(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const runId = `article-${timestamp}`;
  return join(process.cwd(), "output", runId);
}
