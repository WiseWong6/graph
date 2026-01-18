/**
 * 测试图片占位符替换功能
 */

// 测试 Markdown 中的图片占位符
const TEST_MARKDOWN = `# AI Agent 是什么？

AI Agent 是一种智能系统。

## 核心特征

![AI Agent 架构图](0)

1. **自主性**: 能够独立运行
2. **感知能力**: 通过传感器获取信息

![应用场景示例](1)

AI Agent 正在改变我们与软件交互的方式。
`;

// 模拟上传的图片 URL
const MOCK_UPLOADED_URLS = [
  "http://mmbiz.qpic.cn/mmbiz_png/abc123/def456",
  "http://mmbiz.qpic.cn/mmbiz_png/xyz789/uvw012"
];

/**
 * 替换图片索引为 CDN URL
 */
function replaceImagePlaceholders(
  markdown: string,
  uploadedUrls: string[]
): string {
  if (uploadedUrls.length === 0) {
    console.log("No uploaded URLs, skipping image replacement");
    return markdown;
  }

  // 匹配图片占位符: ![描述](索引)
  const imagePattern = /!\[(.*?)\]\((\d+)\)/g;

  let replacementCount = 0;
  const result = markdown.replace(imagePattern, (match, alt, indexStr) => {
    const index = parseInt(indexStr, 10);

    if (index < 0 || index >= uploadedUrls.length) {
      console.warn(`Invalid image index: ${index}`);
      return match;
    }

    const cdnUrl = uploadedUrls[index];
    if (!cdnUrl) {
      console.warn(`No CDN URL for index ${index}`);
      return match;
    }

    replacementCount++;
    console.log(`Replaced [${index}] → ${cdnUrl.substring(0, 40)}...`);

    return `![${alt}](${cdnUrl})`;
  });

  console.log(`Replaced ${replacementCount} image placeholders`);
  return result;
}

// ========== 运行测试 ==========

console.log("=".repeat(60));
console.log("图片占位符替换测试");
console.log("=".repeat(60));
console.log("\n原始 Markdown:");
console.log("-".repeat(60));
console.log(TEST_MARKDOWN);

console.log("\n上传的图片 URL:");
MOCK_UPLOADED_URLS.forEach((url, i) => {
  console.log(`  [${i}] ${url}`);
});

console.log("\n替换后:");
console.log("-".repeat(60));
const result = replaceImagePlaceholders(TEST_MARKDOWN, MOCK_UPLOADED_URLS);
console.log(result);

console.log("\n验证:");
if (result.includes(MOCK_UPLOADED_URLS[0]) && result.includes(MOCK_UPLOADED_URLS[1])) {
  console.log("✅ 测试通过: 图片 URL 已正确替换");
} else {
  console.log("❌ 测试失败: 图片 URL 未正确替换");
  process.exit(1);
}

console.log("\n✅ 所有测试通过！");
