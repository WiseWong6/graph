#!/usr/bin/env tsx
/**
 * Research → Titles 完整流程测试
 */

import { researchNode } from "../src/agents/article/nodes/01_research.node.js";
import { titlesNode } from "../src/agents/article/nodes/03_titles.node.js";

const topic = process.argv[2] || "人工智能";

console.log("===========================================");
console.log(`  测试主题: ${topic}`);
console.log("  流程: Research → Titles");
console.log("===========================================\n");

// ========== 1. Research 节点 ==========
console.log("[1/2] 运行 Research 节点...\n");
const researchStart = Date.now();

const researchResult = await researchNode({
  prompt: topic,
  topic,
  researchResult: "",
  ragContent: "",
  titles: [],
  draft: "",
  polished: "",
  humanized: "",
  imagePrompts: [],
  imagePaths: [],
  uploadedImageUrls: [],
  htmlPath: "",
  decisions: {},
  outputPath: "",
  status: "",
  runId: "",
  generatedText: "",
  generatedText2: "",
  generatedText3: "",
} as any);

const researchTime = ((Date.now() - researchStart) / 1000).toFixed(2);
console.log(`\n✅ Research 完成 (${researchTime}s)\n`);

// ========== 2. Titles 节点 ==========
console.log("[2/2] 运行 Titles 节点...\n");
const titlesStart = Date.now();

const titlesResult = await titlesNode({
  ...researchResult,
  titles: [],
} as any);

const titlesTime = ((Date.now() - titlesStart) / 1000).toFixed(2);
console.log(`\n✅ Titles 完成 (${titlesTime}s)\n`);

// ========== 3. 输出结果 ==========
console.log("===========================================");
console.log("  生成的标题");
console.log("===========================================\n");

if (titlesResult.titles && titlesResult.titles.length > 0) {
  titlesResult.titles.forEach((title, i) => {
    console.log(`  ${i + 1}. ${title}`);
  });
  console.log(`\n共 ${titlesResult.titles.length} 个标题\n`);
} else {
  console.log("  (无标题生成)\n");
}

console.log("===========================================");
console.log(`  总耗时: ${((Date.now() - researchStart) / 1000).toFixed(2)}s`);
console.log("===========================================\n");

// 显示 Brief 路径
if (researchResult.outputPath) {
  console.log(`Brief 路径: ${researchResult.outputPath}/research/00_brief.md\n`);
}
