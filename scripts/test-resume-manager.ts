/**
 * Test script for ResumeManager
 *
 * Tests:
 * 1. List all threads
 * 2. List checkpoints for a thread
 * 3. Resume from a checkpoint
 */

import { fullArticleGraph } from "../src/agents/article/graph.js";
import { ResumeManager } from "../src/cli/resume-manager.js";
import chalk from "chalk";

async function main() {
  console.log(chalk.cyan.bold("\n╔══════════════════════════════════════════════════════════╗"));
  console.log(chalk.cyan.bold("║   ResumeManager 测试脚本                                 ║"));
  console.log(chalk.cyan.bold("╚══════════════════════════════════════════════════════════╝\n"));

  const manager = new ResumeManager(fullArticleGraph);

  // Test 1: List all threads
  console.log(chalk.yellow("测试 1: 列出所有 threads"));
  console.log(chalk.gray("─".repeat(60)));

  const threads = await manager.listThreads();

  if (threads.length === 0) {
    console.log(chalk.gray("没有找到任何 thread。"));
    console.log(chalk.gray("提示: 先运行 'npm run step' 创建一些 checkpoints。\n"));
    return;
  }

  console.log(chalk.green(`找到 ${threads.length} 个 threads:\n`));

  for (const thread of threads) {
    const statusIcon = thread.status === "completed" ? "✅" :
                       thread.status === "failed" ? "❌" : "⏸️";
    console.log(chalk.gray(`  ${statusIcon} ${thread.threadId}`));
    console.log(chalk.gray(`     主题: ${thread.topic || "无"}`));
    console.log(chalk.gray(`     最后节点: ${thread.lastNode}`));
    console.log(chalk.gray(`     更新时间: ${thread.updatedAt.toLocaleString()}\n`));
  }

  // Test 2: List checkpoints for the first thread
  if (threads.length > 0) {
    const firstThread = threads[0];
    console.log(chalk.yellow("\n测试 2: 列出第一个 thread 的 checkpoints"));
    console.log(chalk.gray("─".repeat(60)));

    const checkpoints = await manager.listCheckpoints(firstThread.threadId);

    console.log(chalk.green(`找到 ${checkpoints.length} 个 checkpoints:\n`));

    for (const cp of checkpoints) {
      console.log(chalk.gray(`  [${cp.step}] ${cp.checkpointId.slice(0, 20)}...`));
      console.log(chalk.gray(`      节点: ${cp.node}`));
      console.log(chalk.gray(`      时间: ${cp.timestamp.toLocaleString()}\n`));
    }

    // Test 3: Show resume options (don't actually resume)
    console.log(chalk.yellow("\n测试 3: 恢复选项"));
    console.log(chalk.gray("─".repeat(60)));
    console.log(chalk.gray("要恢复执行，运行:"));
    console.log(chalk.cyan(`  npm run step -- --resume\n`));
  }
}

main().catch(console.error);
