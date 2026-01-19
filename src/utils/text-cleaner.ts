/**
 * 文本清洗工具
 *
 * 职责: 处理确定性的文本格式化规则 (Linus's "Good Taste")
 * 避免让 LLM 处理它不擅长的字符级精确操作
 */

/**
 * Markdown 结构保护处理器
 * 将文本拆分为 "普通文本" 和 "保护块" (代码/公式/链接)，仅处理普通文本
 */
export function processMarkdown(text: string, processor: (t: string) => string): string {
  // 1. 保护代码块 (```...```)
  const codeBlockRegex = /(```[\s\S]*?```)/g;
  // 2. 保护行内代码 (`...`)
  const inlineCodeRegex = /(`[^`]*`)/g;
  // 3. 保护链接/图片 (![...](...) or [...](...))
  const linkRegex = /(!?\[.*?\]\(.*?\))/g;
  // 4. 保护 HTML 标签
  const htmlRegex = /(<[^>]*>)/g;

  // 组合正则 (注意顺序)
  const pattern = new RegExp(
    [
      codeBlockRegex.source,
      inlineCodeRegex.source,
      linkRegex.source,
      htmlRegex.source
    ].join("|"),
    "g"
  );

  let lastIndex = 0;
  let result = "";
  let match;

  while ((match = pattern.exec(text)) !== null) {
    // 处理匹配前的普通文本
    const plainText = text.slice(lastIndex, match.index);
    result += processor(plainText);

    // 追加受保护的原始内容
    result += match[0];

    lastIndex = pattern.lastIndex;
  }

  // 处理剩余的普通文本
  const remaining = text.slice(lastIndex);
  result += processor(remaining);

  return result;
}

/**
 * 格式化清洗规则集合
 * 对应 Humanize Prompt 的 Phase A
 */
export function cleanTextFormatting(text: string): string {
  let processed = text;

  // 1. 破折号替换：英文或中文破折号替换为中文逗号
  // 这里的逻辑是：破折号通常打断语流，Humanize 希望更自然的连接
  processed = processed.replace(/\s*(--|——)\s*/g, "，");

  // 2. 标点中文化 (仅当标点前是中文时)
  // 避免破坏英文句子
  processed = processed
    .replace(/([\u4e00-\u9fa5])\s*,/g, "$1，")
    .replace(/([\u4e00-\u9fa5])\s*\./g, "$1。")
    .replace(/([\u4e00-\u9fa5])\s*\?/g, "$1？")
    .replace(/([\u4e00-\u9fa5])\s*!/g, "$1！")
    .replace(/([\u4e00-\u9fa5])\s*:/g, "$1：")
    .replace(/([\u4e00-\u9fa5])\s*;/g, "$1；");

  // 3. 去多余空格
  // 中文-英文之间
  processed = processed.replace(/([\u4e00-\u9fa5])\s+([a-zA-Z0-9])/g, "$1$2");
  processed = processed.replace(/([a-zA-Z0-9])\s+([\u4e00-\u9fa5])/g, "$1$2");
  
  // 数字-单位 (简单启发式：数字后接中文)
  processed = processed.replace(/(\d+)\s+([\u4e00-\u9fa5])/g, "$1$2");

  // 4. 去引号 (针对强调性短语)
  // 例如 "核心" -> 核心
  // 限制长度为 10 以避免误伤长引语/对话
  processed = processed.replace(/(["'“])([\u4e00-\u9fa5a-zA-Z0-9]{1,10})(["'”])/g, "$2");

  // 5. 去空行 (段落间只留一个空行)
  // 将 3 个及以上换行符替换为 2 个
  processed = processed.replace(/\n{3,}/g, "\n\n");

  return processed;
}

/**
 * 执行 Humanize 格式化 (对外入口)
 */
export function humanizeFormat(markdown: string): string {
  return processMarkdown(markdown, cleanTextFormatting);
}
