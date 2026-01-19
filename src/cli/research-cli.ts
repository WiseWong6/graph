#!/usr/bin/env tsx
/**
 * Research 节点 CLI 对话界面
 *
 * 真实交互体验，无 mock，无测试数据
 */

import { researchNode } from "../agents/article/nodes/02_research.node.js";
import { existsSync, mkdirSync, readFileSync } from "fs";
import { resolve } from "path";
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
  print("cyan", "║         Research Agent - 真实对话模式                            ║\n");
  print("cyan", "╚═══════════════════════════════════════════════════════════════╝\n\n");
  print("gray", "  输入主题开始调研 | 输入 'exit' 退出 | 输入 'clear' 清屏\n\n");
}

async function main() {
  printHeader();

  // 确保输出目录存在
  const outputDir = resolve(process.cwd(), "output", "interactive");
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  while (true) {
    print("green", "> ");
    const prompt = await readLine();

    if (!prompt) continue;
    if (prompt.toLowerCase() === "exit") {
      print("yellow", "\n再见!\n");
      process.exit(0);
    }
    if (prompt.toLowerCase() === "clear") {
      printHeader();
      continue;
    }

    console.log();
    print("gray", "---------------------------------------------------------------\n");
    print("yellow", `正在调研: ${prompt}\n`);
    print("gray", "---------------------------------------------------------------\n\n");

    const startTime = Date.now();

    try {
      const result = await researchNode({
        prompt,
        topic: prompt,
        researchResult: "",
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

      // 显示 Brief 路径
      if (result.outputPath) {
        print("cyan", `Brief: ${result.outputPath}/research/00_brief.md\n\n`);

        // 询问是否查看 Brief
        print("yellow", "查看 Brief? (y/n) ");
        const viewAnswer = await readLine();

        if (viewAnswer?.toLowerCase() === "y") {
          const briefPath = resolve(result.outputPath, "research", "00_brief.md");
          const brief = readFileSync(briefPath, "utf-8");
          console.log("\n" + "-".repeat(70));
          console.log(brief);
          console.log("-".repeat(70) + "\n");
        }
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
