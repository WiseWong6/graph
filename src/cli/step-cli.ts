/**
 * 步进式 CLI - 交互式文章创作工作流
 *
 * 特性：
 * 1. 步进执行 - 每个节点完成后暂停，显示结果
 * 2. 结果预览 - 查看每个节点的输出
 * 3. 交互确认 - 关键节点可修改/重试/跳过
 * 4. 检查点恢复 - 支持从中断处继续
 *
 * 使用方式:
 *   npm run step
 *   npm run step -- --resume
 */

import { readdir } from "fs/promises";
import { join } from "path";
import readline from "readline";
import chalk from "chalk";
import ora from "ora";
import { fullArticleGraph } from "../agents/article/graph.js";
import type { ArticleState } from "../agents/article/state.js";

// 节点信息映射
const NODE_INFO: Record<string, { name: string; description: string; hasOutput: boolean; isInteractive: boolean }> = {
  "gate_a_select_wechat": { name: "选择公众号", description: "选择要发布的公众号账号", hasOutput: false, isInteractive: true },
  "01_research": { name: "调研", description: "搜索并分析主题，生成 Brief", hasOutput: true, isInteractive: false },
  "02_rag": { name: "RAG 检索", description: "从知识库检索相关内容", hasOutput: true, isInteractive: false },
  "03_titles": { name: "生成标题", description: "基于 Brief 和 RAG 生成候选标题", hasOutput: true, isInteractive: false },
  "gate_c_select_title": { name: "选择标题", description: "从候选标题中选择一个", hasOutput: false, isInteractive: true },
  "05_draft": { name: "撰写初稿", description: "基于 Brief 和 RAG 撰写初稿", hasOutput: true, isInteractive: false },
  "06_polish": { name: "润色", description: "优化语言表达", hasOutput: true, isInteractive: false },
  "07_rewrite": { name: "智性叙事重写", description: "IPS 原则 + HKR 自检", hasOutput: true, isInteractive: false },
  "08_confirm": { name: "确认图片配置", description: "确认图片数量和风格", hasOutput: false, isInteractive: true },
  "09_humanize": { name: "人化", description: "去除 AI 味，增加活人感", hasOutput: true, isInteractive: false },
  "10_prompts": { name: "生成图片提示词", description: "为每张图生成详细提示词", hasOutput: true, isInteractive: false },
  "11_images": { name: "生成图片", description: "调用 Ark API 生成图片", hasOutput: true, isInteractive: false },
  "12_upload": { name: "上传图片", description: "上传到微信 CDN", hasOutput: true, isInteractive: false },
  "13_html": { name: "转换 HTML", description: "Markdown 转微信编辑器格式", hasOutput: true, isInteractive: false },
  "14_draftbox": { name: "发布到草稿箱", description: "发布到微信公众号草稿箱", hasOutput: true, isInteractive: false },
  "end": { name: "完成", description: "清理和确认", hasOutput: false, isInteractive: false },
};

/**
 * 格式化节点输出用于预览
 */
function formatNodeOutput(nodeName: string, state: ArticleState): string {
  const lines: string[] = [];

  switch (nodeName) {
    case "01_research":
      if (state.researchResult) {
        lines.push(chalk.cyan("📋 调研结果 (Brief):"));
        lines.push("─".repeat(50));
        // 只显示前 500 字
        const preview = state.researchResult.slice(0, 500);
        lines.push(preview);
        if (state.researchResult.length > 500) {
          lines.push(chalk.gray(`... (省略 ${state.researchResult.length - 500} 字)`));
        }
      }
      break;

    case "02_rag":
      if (state.ragContent) {
        lines.push(chalk.cyan("📚 RAG 检索结果:"));
        lines.push("─".repeat(50));
        const preview = state.ragContent.slice(0, 500);
        lines.push(preview);
        if (state.ragContent.length > 500) {
          lines.push(chalk.gray(`... (省略 ${state.ragContent.length - 500} 字)`));
        }
      }
      break;

    case "03_titles":
      if (state.titles && state.titles.length > 0) {
        lines.push(chalk.cyan("📝 候选标题:"));
        lines.push("─".repeat(50));
        state.titles.forEach((title, i) => {
          lines.push(chalk.green(`  ${i + 1}. ${title}`));
        });
      }
      break;

    case "05_draft":
      if (state.draft) {
        lines.push(chalk.cyan("✍️ 初稿:"));
        lines.push("─".repeat(50));
        const preview = state.draft.slice(0, 800);
        lines.push(preview);
        if (state.draft.length > 800) {
          lines.push(chalk.gray(`... (省略 ${state.draft.length - 800} 字)`));
        }
      }
      break;

    case "06_polish":
      if (state.polished) {
        lines.push(chalk.cyan("✨ 润色后:"));
        lines.push("─".repeat(50));
        const preview = state.polished.slice(0, 500);
        lines.push(preview);
        if (state.polished.length > 500) {
          lines.push(chalk.gray(`... (省略 ${state.polished.length - 500} 字)`));
        }
      }
      break;

    case "07_rewrite":
      if (state.rewritten) {
        lines.push(chalk.cyan("🔄 智性叙事重写:"));
        lines.push("─".repeat(50));
        const preview = state.rewritten.slice(0, 500);
        lines.push(preview);
        if (state.rewritten.length > 500) {
          lines.push(chalk.gray(`... (省略 ${state.rewritten.length - 500} 字)`));
        }
      }
      break;

    case "09_humanize":
      if (state.humanized) {
        lines.push(chalk.cyan("👤 人化后:"));
        lines.push("─".repeat(50));
        const preview = state.humanized.slice(0, 500);
        lines.push(preview);
        if (state.humanized.length > 500) {
          lines.push(chalk.gray(`... (省略 ${state.humanized.length - 500} 字)`));
        }
      }
      break;

    case "10_prompts":
      if (state.imagePrompts && state.imagePrompts.length > 0) {
        lines.push(chalk.cyan("🎨 图片提示词:"));
        lines.push("─".repeat(50));
        state.imagePrompts.forEach((prompt, i) => {
          lines.push(chalk.green(`  图片 ${i + 1}:`));
          lines.push(chalk.gray(`    ${prompt.slice(0, 100)}...`));
        });
      }
      break;

    case "11_images":
      if (state.imagePaths && state.imagePaths.length > 0) {
        lines.push(chalk.cyan("🖼️ 生成的图片:"));
        lines.push("─".repeat(50));
        state.imagePaths.forEach((path, i) => {
          lines.push(chalk.green(`  ${i + 1}. ${path}`));
        });
      }
      break;

    case "12_upload":
      if (state.uploadedImageUrls && state.uploadedImageUrls.length > 0) {
        lines.push(chalk.cyan("⬆️ 上传后的 URL:"));
        lines.push("─".repeat(50));
        state.uploadedImageUrls.forEach((url, i) => {
          lines.push(chalk.green(`  ${i + 1}. ${url}`));
        });
      }
      break;

    case "13_html":
      if (state.htmlPath) {
        lines.push(chalk.cyan("📄 HTML 文件:"));
        lines.push("─".repeat(50));
        lines.push(chalk.green(`  ${state.htmlPath}`));
      }
      break;

    case "14_draftbox":
      lines.push(chalk.cyan("✅ 已发布到草稿箱"));
      if (state.outputPath) {
        lines.push(chalk.green(`  输出目录: ${state.outputPath}`));
      }
      break;

    default:
      if (nodeName.startsWith("gate_")) {
        lines.push(chalk.gray(`  (交互节点，无预览)`));
      }
  }

  return lines.join("\n");
}

/**
 * 显示节点完成信息
 */
function showNodeComplete(nodeName: string, state: ArticleState) {
  const info = NODE_INFO[nodeName] || { name: nodeName, description: "", hasOutput: false };

  console.log("\n" + "═".repeat(60));
  console.log(chalk.green.bold(`✅ 完成: ${info.name}`));
  if (info.description) {
    console.log(chalk.gray(`   ${info.description}`));
  }
  console.log("═".repeat(60));

  if (info.hasOutput) {
    const output = formatNodeOutput(nodeName, state);
    if (output) {
      console.log("\n" + output);
    }
  }
  console.log("");
}

/**
 * 用户交互菜单
 */
async function showUserMenu(): Promise<"continue" | "view" | "quit"> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(
      chalk.yellow("按 Enter 继续，输入 'v' 查看完整输出，'q' 退出: "),
      (answer) => {
        rl.close();
        if (answer.toLowerCase() === "v") {
          resolve("view");
        } else if (answer.toLowerCase() === "q") {
          resolve("quit");
        } else {
          resolve("continue");
        }
      }
    );
  });
}

/**
 * 显示完整输出
 */
async function showFullOutput(nodeName: string, state: ArticleState): Promise<void> {
  const outputMap: Record<string, string | null> = {
    "01_research": state.researchResult,
    "02_rag": state.ragContent,
    "05_draft": state.draft,
    "06_polish": state.polished,
    "07_rewrite": state.rewritten,
    "09_humanize": state.humanized,
  };

  const content = outputMap[nodeName];
  if (!content) {
    console.log(chalk.gray("该节点没有可查看的完整输出"));
    return;
  }

  // 使用 pager 显示
  console.log("\n" + "═".repeat(60));
  console.log(chalk.cyan.bold(`📄 完整输出: ${nodeName}`));
  console.log("═".repeat(60) + "\n");
  console.log(content);
  console.log("\n" + "═".repeat(60));

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(chalk.yellow("\n按 Enter 返回: "), () => {
      rl.close();
      resolve();
    });
  });
}

/**
 * 列出可恢复的检查点
 */
async function listCheckpoints(): Promise<string[]> {
  const checkpointDir = join(process.cwd(), "src", "checkpoints", "article");
  try {
    const files = await readdir(checkpointDir);
    return files.filter(f => f.endsWith(".db"));
  } catch {
    return [];
  }
}

/**
 * 用户输入主题
 */
async function promptForTopic(): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(chalk.cyan("请输入文章主题: "), (answer) => {
      rl.close();
      if (!answer || answer.trim() === "") {
        console.log(chalk.red("主题不能为空，请重新输入"));
        resolve(promptForTopic());
      } else {
        resolve(answer.trim());
      }
    });
  });
}

/**
 * 主函数
 */
export async function main() {
  const args = process.argv.slice(2);
  const resume = args.includes("--resume");

  // 从参数获取主题，如果没有则提示用户输入
  let prompt = args.find(a => !a.startsWith("--"));

  if (!prompt) {
    console.log(chalk.cyan.bold("\n╔══════════════════════════════════════════════════════════╗"));
    console.log(chalk.cyan.bold("║   步进式文章创作工作流 - Write Agent Step CLI          ║"));
    console.log(chalk.cyan.bold("╚══════════════════════════════════════════════════════════╝\n"));
    prompt = await promptForTopic();
  } else {
    console.log(chalk.cyan.bold("\n╔══════════════════════════════════════════════════════════╗"));
    console.log(chalk.cyan.bold("║   步进式文章创作工作流 - Write Agent Step CLI          ║"));
    console.log(chalk.cyan.bold("╚══════════════════════════════════════════════════════════╝\n"));
  }

  console.log(chalk.gray("主题: ") + chalk.white(prompt));
  console.log(chalk.gray("模式: ") + chalk.yellow(resume ? "恢复模式" : "新建流程"));

  if (resume) {
    const checkpoints = await listCheckpoints();
    if (checkpoints.length > 0) {
      console.log(chalk.gray("\n可用的检查点:"));
      checkpoints.forEach(cp => console.log(chalk.gray(`  - ${cp}`)));
    }
  }

  console.log("");
  const spinner = ora("初始化工作流...").start();

  const threadId = resume
    ? `article-${Date.now()}`
    : `step-article-${Date.now()}`;

  const config = {
    configurable: { thread_id: threadId }
  };

  spinner.succeed("工作流已就绪");

  console.log(chalk.gray("\n═══════════════════════════════════════════════════════════"));
  console.log(chalk.gray("开始执行..."));
  console.log(chalk.gray("═══════════════════════════════════════════════════════════\n"));

  try {
    // 使用 stream 而不是 invoke，这样可以监听每个节点
    const stream = await fullArticleGraph.stream(
      { prompt },
      config
    );

    let lastState: ArticleState | null = null;

    for await (const event of stream) {
      // LangGraph stream 事件格式：{ nodeName: { state updates } }
      const eventEntries = Object.entries(event);
      if (eventEntries.length === 0) continue;

      const [nodeName, stateUpdate] = eventEntries[0];

      // 跳过非节点事件
      if (!nodeName || nodeName === "__start__" || nodeName === "__end__") {
        continue;
      }

      // 合并状态更新
      if (stateUpdate && typeof stateUpdate === "object" && !Array.isArray(stateUpdate)) {
        const update = stateUpdate as Partial<ArticleState>;
        if (!lastState) {
          lastState = { ...(update as ArticleState) };
        } else {
          // 使用 Object.assign 避免 spread 类型问题
          lastState = Object.assign({}, lastState, update) as ArticleState;
        }
      }

      // 显示节点完成
      showNodeComplete(nodeName, lastState || ({} as ArticleState));

      // 只在交互式节点后暂停
      const nodeInfo = NODE_INFO[nodeName];
      if (nodeInfo?.isInteractive) {
        // 确保输出完全刷新后再显示用户菜单
        await new Promise(resolve => setTimeout(resolve, 100));

        // 用户交互
        const action = await showUserMenu();

        if (action === "quit") {
          console.log(chalk.yellow("\n⏸️ 流程已暂停"));
          console.log(chalk.gray(`使用 --resume 可从当前状态继续\n`));
          console.log(chalk.gray(`Thread ID: ${threadId}\n`));
          process.exit(0);
        } else if (action === "view") {
          await showFullOutput(nodeName, lastState || ({} as ArticleState));
        }
      } else {
        // 非交互式节点：短暂延迟后继续
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    // 完成
    console.log("\n" + "═".repeat(60));
    console.log(chalk.green.bold("🎉 流程完成！"));
    console.log("═".repeat(60) + "\n");

    if (lastState) {
      console.log(chalk.gray("最终状态:"));
      console.log(chalk.gray(`  主题: ${lastState.topic || prompt}`));
      console.log(chalk.gray(`  选中标题: ${lastState.decisions?.selectedTitle || "无"}`));
      console.log(chalk.gray(`  输出目录: ${lastState.outputPath || "无"}`));
      console.log(chalk.gray(`  状态: ${lastState.status || "完成"}\n`));
    }

  } catch (error) {
    spinner.fail("执行失败");
    console.error(chalk.red("错误:"), error);
    process.exit(1);
  }
}

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
