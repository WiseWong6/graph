#!/usr/bin/env tsx
/**
 * Titles 节点 CLI 测试
 *
 * 单点测试标题生成，使用模拟 Brief 输入
 */

import { titlesNode } from "../agents/article/nodes/04_titles.node.js";
import { createInterface } from "readline";

// ANSI 颜色
const colors = {
  reset: "\x1b[0m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  gray: "\x1b[90m",
};

function print(color: keyof typeof colors, text: string) {
  process.stdout.write(`${colors[color]}${text}${colors.reset}`);
}

function printHeader() {
  console.clear();
  print("cyan", "\n╔═══════════════════════════════════════════════════════════════╗\n");
  print("cyan", "║         Titles Node - 单点测试                                ║\n");
  print("cyan", "╚═══════════════════════════════════════════════════════════════╝\n\n");
  print("gray", "  输入主题生成标题 | 输入 'exit' 退出\n\n");
}

/**
 * 模拟 Brief 输出（用于单点测试）
 */
const MOCK_BRIEF = `# 调研报告: {TOPIC}

## 核心洞察
1. **认知重构**: 大多数人对{TOPIC}的理解停留在表面，缺乏系统性思考
2. **实践缺失**: 理论丰富但落地困难，关键在于执行力
3. **跨学科视角**: 从心理学和行为经济学角度重新审视
4. **数据支撑**: 最新研究显示，采用正确方法的成功率提升300%

## 概念框架
\`\`\`
核心层: {TOPIC}的本质定义
  └── 原理层: 为什么有效
      └── 方法层: 具体执行步骤
          └── 应用层: 不同场景的变体
\`\`\`

## 数据支撑
- 研究显示: 85%的从业者因方法不当而失败
- 成功案例: 采用系统化方法的团队效率提升2-3倍
- 行业趋势: 2026年相关工具市场规模预计达到50亿

## 推荐角度
**从认知到行动: {TOPIC}的完整实践指南**
- 核心论点: 理论结合实践，提供可落地的完整方案
- 论据:
  - 认知模型: 三个关键误区解析
  - 行动框架: 四步执行法
  - 案例分析: 真实成功案例拆解
- 可行性评分: 高 (有大量数据支撑)

## 差异化角度建议
1. **逆向思维法**: 从失败案例中提炼成功要素 (可行性: 中)
2. **跨学科融合**: 结合心理学和行为科学 (可行性: 高)
3. **极简实践**: 7天快速上手指南 (可行性: 高)

推荐采用**跨学科融合**角度，既有深度又有实践价值。
`;

async function main() {
  printHeader();

  print("yellow", "说明: 使用模拟 Brief，跳过 Research 节点\n");
  print("gray", "模型配置: Anthropic Haiku (claude-3-5-haiku-20241022)\n\n");

  while (true) {
    print("green", "> 主题: ");
    const topic = await readLine();

    if (!topic) continue;
    if (topic.toLowerCase() === "exit") {
      print("yellow", "\n再见!\n");
      process.exit(0);
    }

    console.log();
    print("gray", "---------------------------------------------------------------\n");
    print("yellow", `正在生成标题: ${topic}\n`);
    print("gray", "---------------------------------------------------------------\n\n");

    const startTime = Date.now();

    try {
      // 使用模拟 Brief
      const mockBrief = MOCK_BRIEF.replace(/{TOPIC}/g, topic);

      const result = await titlesNode({
        prompt: topic,
        topic,
        researchResult: mockBrief,  // 使用模拟 Brief
        ragContent: "",
        titles: [],
        draft: "",
        rewritten: "",
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

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      print("gray", "---------------------------------------------------------------\n");
      print("green", `完成 (${duration}s)\n`);
      print("gray", "---------------------------------------------------------------\n\n");

      // 显示生成的标题
      if (result.titles && result.titles.length > 0) {
        print("cyan", "生成的标题:\n\n");
        result.titles.forEach((title, i) => {
          console.log(`  ${i + 1}. ${title}`);
        });
        console.log();
      } else {
        print("yellow", "未生成标题 (可能解析失败)\n\n");
      }
    } catch (error) {
      print("gray", "---------------------------------------------------------------\n");
      print("yellow", `错误: ${error}\n`);
      print("gray", "---------------------------------------------------------------\n\n");
    }
  }
}

function readLine(): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question("", (answer: string) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

main().catch(console.error);
