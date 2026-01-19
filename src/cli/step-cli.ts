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

import readline from "readline";
import chalk from "chalk";
import ora from "ora";
import { fullArticleGraph } from "../agents/article/graph.js";
import type { ArticleState } from "../agents/article/state.js";
import { ResumeManager } from "./resume-manager.js";

/**
 * 节点耗时汇总
 */
interface TimingSummary {
  nodeName: string;
  displayName: string;
  duration: number;  // 毫秒
  startTime: number;
}

// 节点信息映射
const NODE_INFO: Record<string, { name: string; description: string; hasOutput: boolean; isInteractive: boolean }> = {
  "gate_a_select_wechat": { name: "选择公众号", description: "选择要发布的公众号账号", hasOutput: false, isInteractive: true },
  "01_research": { name: "调研", description: "搜索并分析主题，生成 Brief", hasOutput: true, isInteractive: false },
  "02_rag": { name: "RAG 检索", description: "从知识库检索相关内容", hasOutput: true, isInteractive: false },
  "03_titles": { name: "生成标题", description: "基于 Brief 和 RAG 生成候选标题", hasOutput: true, isInteractive: false },
  "gate_c_select_title": { name: "选择标题", description: "从候选标题中选择一个", hasOutput: false, isInteractive: true },
  "05_draft": { name: "撰写初稿", description: "基于 Brief 和 RAG 撰写初稿", hasOutput: true, isInteractive: false },
  "06_rewrite": { name: "智性叙事重写", description: "IPS 原则 + HKR 自检", hasOutput: true, isInteractive: false },
  "07_confirm": { name: "确认图片配置", description: "确认图片数量和风格", hasOutput: false, isInteractive: true },
  "08_humanize": { name: "人化", description: "去除 AI 味，增加活人感", hasOutput: true, isInteractive: false },
  "09_prompts": { name: "生成图片提示词", description: "为每张图生成详细提示词", hasOutput: true, isInteractive: false },
  "10_images": { name: "生成图片", description: "调用 Ark API 生成图片", hasOutput: true, isInteractive: false },
  "11_upload": { name: "上传图片", description: "上传到微信 CDN", hasOutput: true, isInteractive: false },
  "12_html": { name: "转换 HTML", description: "Markdown 转微信编辑器格式", hasOutput: true, isInteractive: false },
  "13_draftbox": { name: "发布到草稿箱", description: "发布到微信公众号草稿箱", hasOutput: true, isInteractive: false },
  "end": { name: "完成", description: "清理和确认", hasOutput: false, isInteractive: false },
};


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
    "06_rewrite": state.rewritten,
    "08_humanize": state.humanized,
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

function renderDashboardLine(content: string, width: number): string {
  const innerWidth = width - 2;
  const safe = content.length > innerWidth
    ? content.slice(0, innerWidth)
    : content.padEnd(innerWidth, " ");
  return `|${safe}|`;
}

function renderSeparator(width: number, title?: string): string {
  if (!title) {
    return `+${"-".repeat(width - 2)}+`;
  }
  const innerWidth = width - 2;
  const paddedTitle = ` ${title} `;
  const remaining = innerWidth - paddedTitle.length;
  const left = Math.max(0, Math.floor(remaining / 2));
  const right = Math.max(0, remaining - left);
  return `+${"-".repeat(left)}${paddedTitle}${"-".repeat(right)}+`;
}

function showTimingDashboard(
  summaries: TimingSummary[],
  workflowStartTime: number,
  totalWaitMs: number,
  threadId: string
): void {
  const totalDuration = Date.now() - workflowStartTime;
  const computeDuration = Math.max(0, totalDuration - totalWaitMs);
  const width = 78;

  console.log("");
  console.log(renderSeparator(width, "TASK TIME DASHBOARD"));
  console.log(renderDashboardLine(`Run: ${threadId}  Mode: step`, width));
  console.log(renderDashboardLine(
    `Total (wall): ${(totalDuration / 1000).toFixed(1)}s  ` +
    `Wait excluded: ${(totalWaitMs / 1000).toFixed(1)}s  ` +
    `Compute: ${(computeDuration / 1000).toFixed(1)}s`,
    width
  ));

  if (summaries.length === 0) {
    console.log(renderSeparator(width, "Nodes (compute)"));
    console.log(renderDashboardLine("No node timing data.", width));
    console.log(renderSeparator(width));
    return;
  }

  console.log(renderSeparator(width, "Nodes (compute)"));

  const ordered = [...summaries].sort((a, b) => a.startTime - b.startTime);
  const maxDuration = Math.max(...ordered.map(item => item.duration), 1);
  const labelWidth = 16;
  const durationWidth = 7;
  const innerWidth = width - 2;

  for (const item of ordered) {
    const label = item.displayName.padEnd(labelWidth, " ");
    const durationText = `${(item.duration / 1000).toFixed(1)}s`.padStart(durationWidth, " ");
    const prefix = `${label} ${durationText} |`;
    const barWidth = Math.max(4, innerWidth - prefix.length);
    const barLength = Math.max(1, Math.round((item.duration / maxDuration) * barWidth));
    const bar = "#".repeat(barLength).padEnd(barWidth, " ");
    console.log(renderDashboardLine(prefix + bar, width));
  }

  console.log(renderSeparator(width));
}

/**
 * 主函数
 */
export async function main() {
  const args = process.argv.slice(2);
  const resume = args.includes("--resume");

  console.log(chalk.cyan.bold("\n╔══════════════════════════════════════════════════════════╗"));
  console.log(chalk.cyan.bold("║   步进式文章创作工作流 - Write Agent Step CLI          ║"));
  console.log(chalk.cyan.bold("╚══════════════════════════════════════════════════════════╝\n"));

  let prompt: string;
  let threadId: string;

  // 恢复模式
  if (resume) {
    const manager = new ResumeManager(fullArticleGraph);

    // 选择 thread
    const selectedThreadId = await manager.selectThread();
    if (!selectedThreadId) {
      // 用户选择新建会话
      prompt = await promptForTopic();
      threadId = `step-article-${Date.now()}`;
    } else {
      threadId = selectedThreadId;

      // 选择 checkpoint
      const checkpointId = await manager.selectCheckpoint(threadId);
      if (!checkpointId) {
        // 用户选择返回，重新选择 thread
        return main();
      }

      // 恢复执行
      console.log("");
      const spinner = ora("初始化工作流...").start();
      spinner.succeed("工作流已就绪");

      await manager.resume(threadId, checkpointId);
      return;
    }
  } else {
    // 新建流程
    // 从参数获取主题，如果没有则提示用户输入
    const argPrompt = args.find(a => !a.startsWith("--"));
    prompt = argPrompt || await promptForTopic();
    threadId = `step-article-${Date.now()}`;
  }

  console.log(chalk.gray("主题: ") + chalk.white(prompt));
  console.log(chalk.gray("模式: ") + chalk.yellow(resume ? "恢复模式" : "新建流程"));

  console.log("");
  const spinner = ora("初始化工作流...").start();

  const config = {
    configurable: { thread_id: threadId }
  };

  spinner.succeed("工作流已就绪");

  console.log(chalk.gray("\n═══════════════════════════════════════════════════════════"));
  console.log(chalk.gray("开始执行..."));
  console.log(chalk.gray("═══════════════════════════════════════════════════════════\n"));

  try {
    // 使用 streamEvents 而不是 stream，以获得节点生命周期事件
    // 这允许我们检测并行执行（on_chain_start）和完成时间
    let eventStream: AsyncIterable<unknown>;
    let useEventsMode = true;

    try {
      eventStream = await fullArticleGraph.streamEvents(
        { prompt },
        {
          ...config,
          version: "v2"  // 必须指定 v2 版本以获得完整事件
        }
      );
    } catch (eventsError) {
      // 降级：如果 streamEvents 不可用，使用原始 stream 方法
      console.log(chalk.yellow("⚠️ 并行检测不可用，使用基础模式"));
      eventStream = await fullArticleGraph.stream({ prompt }, config);
      useEventsMode = false;
    }

    // 并行执行追踪器
    interface ParallelTracker {
      activeNodes: Map<string, number>;  // nodeName → startTime
      completedNodes: Set<string>;
      lastState: ArticleState | null;
      isWaitingForInteraction: boolean;  // 是否正在等待交互节点完成
      parallelCompletionSummaries: Map<string, { displayName: string; duration: string }>;  // 并行节点摘要收集
      interactiveWaitMs: Map<string, number>;
      postMenuWaitMsTotal: number;
    }

    const tracker: ParallelTracker = {
      activeNodes: new Map(),
      completedNodes: new Set(),
      lastState: null,
      isWaitingForInteraction: false,
      parallelCompletionSummaries: new Map(),
      interactiveWaitMs: new Map(),
      postMenuWaitMsTotal: 0
    };

    // 耗时汇总收集
    const timingSummaries: TimingSummary[] = [];
    let workflowStartTime: number = Date.now();

    // 用户节点列表（用于过滤内部事件）
    const USER_NODES = new Set([
      "gate_a_select_wechat", "01_research", "02_rag", "03_titles",
      "gate_c_select_title", "05_draft", "06_rewrite", "07_confirm",
      "08_humanize", "09_prompts", "10_images", "11_upload",
      "12_html", "13_draftbox", "end"
    ]);

    for await (const event of eventStream) {
      // 根据模式解析事件
      let eventType: string | undefined;
      let nodeName: string | undefined;
      let stateUpdate: Partial<ArticleState> | undefined;

      if (useEventsMode) {
        // streamEvents 模式：{ event, name, data }
        const ev = event as { event: string; name: string; data?: { output?: unknown } };
        eventType = ev.event;
        nodeName = ev.name;
        if (eventType === "on_chain_end" && ev.data?.output) {
          stateUpdate = ev.data.output as Partial<ArticleState>;
        }
      } else {
        // stream 模式（降级）：{ nodeName: { state updates } }
        const ev = event as Record<string, unknown>;
        const entries = Object.entries(ev);
        if (entries.length > 0) {
          nodeName = entries[0][0];
          stateUpdate = entries[0][1] as Partial<ArticleState>;
          eventType = "on_chain_end"; // stream 只产生完成事件
        }
      }

      // 跳过内部事件（如 __start__, __end__, ChannelWrite 等）
      if (!nodeName || nodeName.startsWith("__")) continue;
      if (!USER_NODES.has(nodeName)) continue;

      // 节点启动事件 - 检测并行执行
      if (eventType === "on_chain_start") {
        // 如果是交互节点启动，标记正在等待交互
        if (NODE_INFO[nodeName]?.isInteractive) {
          tracker.isWaitingForInteraction = true;
        }

        // 如果正在等待交互，不显示后台节点的启动信息
        if (tracker.isWaitingForInteraction && !NODE_INFO[nodeName]?.isInteractive) {
          tracker.activeNodes.set(nodeName, Date.now());
          continue;
        }
        tracker.activeNodes.set(nodeName, Date.now());

        const activeCount = tracker.activeNodes.size;
        const nodeInfo = NODE_INFO[nodeName];
        const displayName = nodeInfo?.name || nodeName;

        // 检查前一个节点是否是交互节点
        const prevNode = Array.from(tracker.completedNodes).pop();
        const wasInteractive = prevNode && NODE_INFO[prevNode]?.isInteractive;

        if (activeCount > 1) {
          // 检测到并行执行
          const nodes = Array.from(tracker.activeNodes.keys())
            .map(n => NODE_INFO[n]?.name || n)
            .join(" + ");

          // 如果前一个节点是交互节点，显示更温和的提示
          if (wasInteractive) {
            console.log(chalk.dim(`⏳ 后台执行: ${nodes}`));
          } else {
            console.log(chalk.yellow(`⚡ 并行执行 [${activeCount}]: ${nodes}`));
          }
        } else if (!wasInteractive) {
          // 单节点执行，且前一个节点不是交互节点
          console.log(chalk.gray(`▶️ ${displayName}`));
        }
        // 如果前一个是交互节点，不显示启动信息（避免干扰用户体验）
      }

      // 节点完成事件
      if (eventType === "on_chain_end") {
        const startTime = tracker.activeNodes.get(nodeName) || Date.now();
        const endTime = Date.now();
        let durationMs = endTime - startTime;
        let interactionWaitMs = 0;
        tracker.activeNodes.delete(nodeName);
        tracker.completedNodes.add(nodeName);

        const nodeInfo = NODE_INFO[nodeName];
        const displayName = nodeInfo?.name || nodeName;

        if (nodeInfo?.isInteractive) {
          const waitMsFromUpdate = stateUpdate?.decisions?.timings?.[nodeName];
          const waitMsFromState = tracker.lastState?.decisions?.timings?.[nodeName];
          interactionWaitMs = typeof waitMsFromUpdate === "number"
            ? waitMsFromUpdate
            : typeof waitMsFromState === "number"
              ? waitMsFromState
              : 0;
          if (interactionWaitMs > 0) {
            const previous = tracker.interactiveWaitMs.get(nodeName) || 0;
            tracker.interactiveWaitMs.set(nodeName, previous + interactionWaitMs);
            durationMs = Math.max(0, durationMs - interactionWaitMs);
          }
        }

        const duration = (durationMs / 1000).toFixed(1);

        // 收集耗时数据
        if (nodeInfo) {
          timingSummaries.push({
            nodeName,
            displayName,
            duration: durationMs,
            startTime
          });
        }

        // 合并状态更新
        if (stateUpdate && typeof stateUpdate === "object") {
          if (!tracker.lastState) {
            tracker.lastState = { ...(stateUpdate as ArticleState) };
          } else {
            tracker.lastState = Object.assign({}, tracker.lastState, stateUpdate) as ArticleState;
          }
        }

        // 如果是交互节点完成，取消等待标记并显示完成信息
        if (nodeInfo?.isInteractive) {
          tracker.isWaitingForInteraction = false;
          console.log(chalk.dim(`✓ ${displayName} (${duration}s)`));
        } else if (!tracker.isWaitingForInteraction) {
          // 非交互节点，且不在等待交互中，才显示完成信息
          if (nodeInfo?.hasOutput) {
            console.log(chalk.green(`✅ ${displayName} (${duration}s)`));
          } else {
            console.log(chalk.dim(`✓ ${displayName} (${duration}s)`));
          }
        }

        // 如果还有活跃节点，显示剩余进度（但不在等待交互时）
        if (tracker.activeNodes.size > 0 && !tracker.isWaitingForInteraction) {
          const remaining = Array.from(tracker.activeNodes.keys())
            .map(n => NODE_INFO[n]?.name || n);
          console.log(chalk.dim(`   ⏳ 进行中: ${remaining.join(", ")}`));
        }

        // 并行节点处理：收集摘要或显示
        // 如果已有摘要收集，或删除前活跃节点>1，则是并行执行
        const wasParallelExecution = tracker.parallelCompletionSummaries.size > 0 ||
          (tracker.activeNodes.size + 1 > 1);

        if (nodeInfo?.hasOutput && tracker.lastState && !tracker.isWaitingForInteraction) {
          if (wasParallelExecution) {
            // 并行节点：收集摘要
            tracker.parallelCompletionSummaries.set(nodeName, {
              displayName,
              duration
            });

            // 当最后一个并行节点完成时，显示简洁摘要
            if (tracker.activeNodes.size === 0) {
              const summaries = Array.from(tracker.parallelCompletionSummaries.entries())
                .map(([_, info]) => `✅ ${info.displayName} (${info.duration}s)`)
                .join(" | ");

              console.log(chalk.dim(`   ${summaries}`));
              tracker.parallelCompletionSummaries.clear();
            }
          }
          // 非并行节点：不自动显示输出预览（用户可通过 'v' 查看）
        }
      }

      // 交互节点：等待用户输入
      if (eventType === "on_chain_end" && NODE_INFO[nodeName]?.isInteractive) {
        // 确保输出完全刷新后再显示用户菜单
        await new Promise(resolve => setTimeout(resolve, 100));

        // 用户交互
        const menuWaitStart = Date.now();
        const action = await showUserMenu();

        if (action === "quit") {
          console.log(chalk.yellow("\n⏸️ 流程已暂停"));
          console.log(chalk.gray(`使用 --resume 可从当前状态继续\n`));
          console.log(chalk.gray(`Thread ID: ${threadId}\n`));
          process.exit(0);
        } else if (action === "view" && tracker.lastState) {
          await showFullOutput(nodeName, tracker.lastState);
        }
        tracker.postMenuWaitMsTotal += Date.now() - menuWaitStart;
      } else if (eventType === "on_chain_end") {
        // 非交互式节点：短暂延迟后继续
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    // 完成
    console.log("\n" + "═".repeat(60));
    console.log(chalk.green.bold("🎉 流程完成！"));
    console.log("═".repeat(60) + "\n");

    if (tracker.lastState) {
      console.log(chalk.gray("最终状态:"));
      console.log(chalk.gray(`  主题: ${tracker.lastState.topic || prompt}`));
      console.log(chalk.gray(`  选中标题: ${tracker.lastState.decisions?.selectedTitle || "无"}`));
      console.log(chalk.gray(`  输出目录: ${tracker.lastState.outputPath || "无"}`));
      console.log(chalk.gray(`  状态: ${tracker.lastState.status || "完成"}\n`));
    }

    const interactiveWaitMsTotal = Array.from(tracker.interactiveWaitMs.values())
      .reduce((sum, value) => sum + value, 0);
    const totalWaitMs = interactiveWaitMsTotal + tracker.postMenuWaitMsTotal;
    showTimingDashboard(timingSummaries, workflowStartTime, totalWaitMs, threadId);

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
