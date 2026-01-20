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
import inquirer from "inquirer";
import { fullArticleGraph } from "../agents/article/graph.js";
import type { ArticleState } from "../agents/article/state.js";
import { ResumeManager } from "./resume-manager.js";
import { outputCoordinator } from "../utils/llm-output.js";

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
  "gate_a_select_model": { name: "选择模型", description: "选择要使用的 LLM 模型", hasOutput: false, isInteractive: true },
  "02_research": { name: "调研", description: "搜索并分析主题，生成 Brief", hasOutput: true, isInteractive: false },
  "03_rag": { name: "RAG 检索", description: "从知识库检索相关内容", hasOutput: true, isInteractive: false },
  "04_titles": { name: "生成标题", description: "基于 Brief 和 RAG 生成候选标题", hasOutput: true, isInteractive: false },
  "gate_c_select_title": { name: "选择标题", description: "从候选标题中选择一个", hasOutput: false, isInteractive: true },
  "06_draft": { name: "撰写初稿", description: "基于 Brief 和 RAG 撰写初稿", hasOutput: true, isInteractive: false },
  "07_rewrite": { name: "智性叙事重写", description: "IPS 原则 + HKR 自检", hasOutput: true, isInteractive: false },
  "08_confirm": { name: "确认图片配置", description: "确认图片数量和风格", hasOutput: false, isInteractive: true },
  "09_humanize": { name: "人化", description: "去除 AI 味，增加活人感", hasOutput: true, isInteractive: false },
  "10_prompts": { name: "生成图片提示词", description: "为每张图生成详细提示词", hasOutput: true, isInteractive: false },
  "11_images": { name: "生成图片", description: "调用 Ark API 生成图片", hasOutput: true, isInteractive: false },
  "12_upload": { name: "上传图片", description: "上传到微信 CDN", hasOutput: true, isInteractive: false },
  "13_wait_for_upload": { name: "等待上传完成", description: "并行同步点，等待图片上传完成", hasOutput: false, isInteractive: false },
  "14_html": { name: "转换 HTML", description: "Markdown 转微信编辑器格式", hasOutput: true, isInteractive: false },
  "15_draftbox": { name: "发布到草稿箱", description: "发布到微信公众号草稿箱", hasOutput: true, isInteractive: false },
  "end": { name: "完成", description: "清理和确认", hasOutput: false, isInteractive: false },
};

/**
 * 动态获取流式输出聚焦节点
 * 支持两个并行场景：
 * 1. Research 后：04_titles 是聚焦节点（缓冲 02_rag）
 * 2. Confirm 后：09_humanize 是聚焦节点（缓冲 10_prompts/11_images/12_upload）
 */
const getStreamFocusNode = (currentNode: string): string | null => {
  // Research 后并行：Titles 是聚焦节点，缓冲 RAG
  if (currentNode === "04_titles" || currentNode === "03_rag") {
    return "04_titles";
  }

  // Confirm 后并行：Humanize 是聚焦节点，缓冲 Prompts/Images
  if (currentNode === "09_humanize" ||
      currentNode === "10_prompts" ||
      currentNode === "11_images" ||
      currentNode === "12_upload" ||
      currentNode === "13_wait_for_upload") {
    return "09_humanize";
  }

  return null;
};

const DEFERRED_NODES_DURING_STREAM = new Set([
  "10_prompts", "11_images", "12_upload", "13_wait_for_upload"
]);
const DEFERRED_LOG_PREFIXES = [
  "[02_rag]",       // RAG 节点日志（Titles 聚焦时缓冲）
  "[10_prompts]",
  "[10_images]",
  "[11.5_upload]"
];

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
    "02_research": state.researchResult,
    "03_rag": state.ragContent,
    "06_draft": state.draft,
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
 * 从文件读取内容
 */
async function readFromFile(filePath: string): Promise<string | null> {
  try {
    const fs = await import("fs");
    const content = fs.readFileSync(filePath, "utf-8");
    return content;
  } catch (error) {
    console.error(chalk.red(`无法读取文件: ${filePath}`));
    return null;
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
    rl.question(chalk.cyan("请输入文章主题 (或使用 --file <路径> 从文件读取): "), (answer) => {
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

/**
 * 格式化持续时间 - 自动选择合适的单位
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds > 0
    ? `${minutes}m ${remainingSeconds}s`
    : `${minutes}m`;
}

function showTimingDashboard(
  _summaries: TimingSummary[],
  workflowStartTime: number,
  _totalWaitMs: number,  // 参数保留用于兼容，但不再使用
  threadId: string
): void {
  const totalDuration = Date.now() - workflowStartTime;
  const width = 78;

  console.log("");
  console.log(renderSeparator(width, "TASK TIME DASHBOARD"));
  console.log(renderDashboardLine(`Run: ${threadId}  Mode: step`, width));
  console.log(renderDashboardLine(`Total: ${formatDuration(totalDuration)}`, width));
  console.log(renderSeparator(width));
}

/**
 * 统一退出处理 - 确保任何退出都输出统计
 */
async function exitWithSummary(
  threadId: string,
  timingSummaries: TimingSummary[],
  workflowStartTime: number,
  interactiveWaitMs: number,
  isComplete: boolean,
  error?: unknown
): Promise<never> {
  console.log("\n" + "═".repeat(60));
  if (isComplete) {
    console.log(chalk.green.bold("🎉 流程完成！"));
  } else if (error) {
    console.log(chalk.red.bold("❌ 流程异常终止"));
  } else {
    console.log(chalk.yellow.bold("⏸️  流程已暂停"));
  }
  console.log("═".repeat(60) + "\n");

  // 输出耗时统计
  showTimingDashboard(timingSummaries, workflowStartTime, interactiveWaitMs, threadId);

  // 如果有错误，显示错误信息
  if (error) {
    console.error(chalk.red("错误信息:"), error);
    console.log(chalk.gray(`\n使用 --resume 可从当前状态继续\n`));
    console.log(chalk.gray(`Thread ID: ${threadId}\n`));
  } else if (!isComplete) {
    console.log(chalk.gray(`使用 --resume 可从当前状态继续\n`));
    console.log(chalk.gray(`Thread ID: ${threadId}\n`));
  }

  process.exit(isComplete ? 0 : 1);
}

/**
 * 节点错误处理 - 提供重试/跳过/从某节点重新运行选项
 */
async function handleNodeError(
  error: unknown,
  threadId: string,
  timingSummaries: TimingSummary[],
  workflowStartTime: number,
  interactiveWaitMs: number,
  stateValue?: { prompt?: string }
): Promise<void> {
  console.log("\n" + "═".repeat(60));
  console.log(chalk.red.bold("❌ 节点执行失败"));
  console.log("═".repeat(60) + "\n");

  // 显示错误信息
  const errorMsg = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;
  console.error(chalk.red("错误:"), errorMsg);

  if (errorStack && process.env.DEBUG) {
    console.log(chalk.gray("\n堆栈信息:"));
    console.log(chalk.gray(errorStack.split("\n").slice(1, 5).join("\n")));
  }

  // Linus原则："Never break userspace" - 让用户决定是否重试
  // 所有错误都可重试，因为：
  // 1. 用户最清楚是否应该重试
  // 2. 配置缺失可以通过修改 state 后重试
  // 3. 临时错误（网络/API）和逻辑错误都应该给用户选择权
  const isRetryable = true;

  console.log(chalk.gray("\n提示: 所有错误都允许重试\n"));

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const answer = await new Promise<string>((resolve) => {
    const prompt = isRetryable
      ? chalk.yellow("选择操作 [r=重试, s=跳过, n=从某节点重新运行, q=退出]: ")
      : chalk.yellow("选择操作 [n=从某节点重新运行, q=退出]: ");
    rl.question(prompt, (ans) => {
      rl.close();
      resolve(ans.trim().toLowerCase());
    });
  });

  // 重试
  if (answer === "r" && isRetryable) {
    console.log(chalk.cyan("\n🔄 重试中...\n"));
    try {
      const { fullArticleGraph: graph } = await import("../agents/article/graph.js");
      const config = { configurable: { thread_id: threadId } };
      // 重新执行流程（LangGraph 会从当前 checkpoint 继续）
      await graph.invoke(null, config);
      // 成功后正常退出
      await exitWithSummary(threadId, timingSummaries, workflowStartTime, interactiveWaitMs, true);
    } catch (retryError) {
      // 重试失败，递归处理
      await handleNodeError(retryError, threadId, timingSummaries, workflowStartTime, interactiveWaitMs, stateValue);
    }
    return;
  }

  // 跳过
  if (answer === "s" && isRetryable) {
    console.log(chalk.yellow("\n⏭️  跳过当前节点"));
    console.log(chalk.gray("注意：跳过可能导致后续节点失败\n"));
    try {
      const { fullArticleGraph: graph } = await import("../agents/article/graph.js");
      const config = { configurable: { thread_id: threadId } };
      // 继续执行
      await graph.invoke(null, config);
      await exitWithSummary(threadId, timingSummaries, workflowStartTime, interactiveWaitMs, true);
    } catch (continueError) {
      await handleNodeError(continueError, threadId, timingSummaries, workflowStartTime, interactiveWaitMs, stateValue);
    }
    return;
  }

  // 从某节点重新运行
  if (answer === "n") {
    // 构建节点选择选项
    const nodeEntries = Object.entries(NODE_INFO);
    const choices = nodeEntries.map(([key, info]) => {
      const status = timingSummaries.some(s => s.nodeName === key)
        ? chalk.green("✓")
        : chalk.gray("○");
      return {
        name: `${status} ${info.name} - ${info.description}`,
        value: key,
        short: info.name
      };
    });

    const { selectedNode } = await inquirer.prompt([{
      type: 'list',
      name: 'selectedNode',
      message: '选择要重新运行的节点:',
      choices: [
        ...choices,
        new inquirer.Separator("────────────────────────────────────────────────────────"),
        { name: '取消', value: '__CANCEL__', short: '取消' }
      ],
      pageSize: 15,
    }]);

    if (selectedNode && selectedNode !== '__CANCEL__') {
      const selectedNodeKey = selectedNode;
      console.log(chalk.cyan(`\n🔄 从节点 "${NODE_INFO[selectedNodeKey].name}" 重新运行...\n`));

      // 使用 ResumeManager 从指定节点恢复
      try {
        const manager = new ResumeManager(fullArticleGraph);
        const checkpoints = await manager.listCheckpoints(threadId);

        // 查找目标节点之前的 checkpoint
        const targetCheckpoint = checkpoints.find(cp => cp.node === selectedNodeKey);
        if (targetCheckpoint) {
          console.log(chalk.yellow(`找到 checkpoint: ${targetCheckpoint.checkpointId}\n`));
          await manager.resume(threadId, targetCheckpoint.checkpointId);
        } else {
          // 如果找不到 checkpoint，从头开始
          console.log(chalk.yellow(`未找到 "${NODE_INFO[selectedNodeKey].name}" 的 checkpoint，将从头开始\n`));
          const newThreadId = `step-article-${Date.now()}`;
          const { fullArticleGraph: graph } = await import("../agents/article/graph.js");
          const config = { configurable: { thread_id: newThreadId } };

          console.log(chalk.gray(`新 Thread ID: ${newThreadId}\n`));
          await graph.invoke({ prompt: stateValue?.prompt || "" }, config);
        }

        await exitWithSummary(threadId, [], workflowStartTime, interactiveWaitMs, true);
      } catch (rerunError) {
        await handleNodeError(rerunError, threadId, timingSummaries, workflowStartTime, interactiveWaitMs, stateValue);
      }
      return;
    }

    console.log(chalk.gray("取消重新运行\n"));
  }

  // 退出（默认）
  await exitWithSummary(threadId, timingSummaries, workflowStartTime, interactiveWaitMs, false, error);
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
    // 检查 --file 参数
    const fileArgIndex = args.indexOf("--file");
    if (fileArgIndex !== -1 && args[fileArgIndex + 1]) {
      const filePath = args[fileArgIndex + 1];
      console.log(chalk.gray(`从文件读取: ${filePath}`));
      const fileContent = await readFromFile(filePath);
      if (!fileContent) {
        console.log(chalk.red("读取失败，回退到手动输入"));
        prompt = await promptForTopic();
      } else {
        prompt = fileContent.trim();
      }
    } else {
      // 从参数获取主题，如果没有则提示用户输入
      const argPrompt = args.find(a => !a.startsWith("--"));
      prompt = argPrompt || await promptForTopic();
    }
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

  // 在 try 块外定义变量，以便 catch 块可以访问
  // 并行执行追踪器
  interface ParallelTracker {
    activeNodes: Map<string, number>;
    completedNodes: Set<string>;
    lastState: ArticleState | null;
    isWaitingForInteraction: boolean;
    parallelCompletionSummaries: Map<string, { displayName: string; duration: string }>;
    interactiveWaitMs: Map<string, number>;
    postMenuWaitMsTotal: number;
    streamFocusNode: string | null;
    deferredCompletions: Array<{ nodeName: string; displayName: string; duration: string; hasOutput: boolean }>;
  }

  const tracker: ParallelTracker = {
    activeNodes: new Map(),
    completedNodes: new Set(),
    lastState: null,
    isWaitingForInteraction: false,
    parallelCompletionSummaries: new Map(),
    interactiveWaitMs: new Map(),
    postMenuWaitMsTotal: 0,
    streamFocusNode: null,
    deferredCompletions: []
  };

  const originalLog = console.log.bind(console);
  const deferredLogs: Array<any[]> = [];
  const shouldBufferLog = (args: any[]): boolean => {
    if (!tracker.streamFocusNode) return false;
    if (args.length === 0) return false;
    const first = String(args[0]);

    // 根据聚焦节点决定缓冲哪些日志
    if (tracker.streamFocusNode === "04_titles") {
      // Titles 聚焦时，只缓冲 RAG 日志
      return first.startsWith("[02_rag]");
    }

    if (tracker.streamFocusNode === "09_humanize") {
      // Humanize 聚焦时，缓冲 Prompts/Images 日志
      return DEFERRED_LOG_PREFIXES.some(prefix => first.startsWith(prefix));
    }

    return false;
  };
  console.log = (...args: any[]) => {
    if (shouldBufferLog(args)) {
      deferredLogs.push(args);
      return;
    }
    originalLog(...args);
  };

  const timingSummaries: TimingSummary[] = [];
  let workflowStartTime: number = Date.now();

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

    // 用户节点列表（用于过滤内部事件）
    const USER_NODES = new Set([
      "gate_a_select_wechat", "gate_a_select_model", "02_research", "03_rag", "04_titles",
      "gate_c_select_title", "06_draft", "07_rewrite", "08_confirm",
      "09_humanize", "10_prompts", "11_images", "12_upload",
      "13_wait_for_upload", "14_html", "15_draftbox", "end"
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
        // 调试：打印事件详情
        if (process.env.DEBUG_TIME && timingSummaries.length < 30) {
          const dataKeys = ev.data ? Object.keys(ev.data).join(', ') : 'none';
          console.log(`[DEBUG] Event: ${eventType}, Name: ${nodeName}, Data keys: ${dataKeys}`);
          if (ev.data && typeof ev.data === 'object') {
            console.log(`[DEBUG] Event data:`, JSON.stringify(ev.data).substring(0, 200));
          }
        }
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
      // ChannelWrite 是 LangGraph 内部通道写入事件，不是实际的节点执行
      if (!nodeName) continue;
      if (nodeName === "__end__") {
        // 流结束事件，退出循环
        break;
      }
      if (nodeName.startsWith("__")) continue;
      if (nodeName.startsWith("ChannelWrite")) continue;
      if (!USER_NODES.has(nodeName)) continue;

      // 节点启动事件 - 检测并行执行
      if (eventType === "on_chain_start") {
        // 调试：记录所有启动的节点
        if (process.env.DEBUG_TIME) {
          console.log(`[DEBUG] on_chain_start: ${nodeName}`);
        }

        // 如果是交互节点启动，标记正在等待交互
        if (NODE_INFO[nodeName]?.isInteractive) {
          tracker.isWaitingForInteraction = true;
        }

        // 动态设置聚焦节点
        const focusNode = getStreamFocusNode(nodeName);
        if (focusNode) {
          tracker.streamFocusNode = focusNode;
          // 设置输出优先级：聚焦节点的流式输出优先
          outputCoordinator.setPriorityNode(focusNode);
        }

        // 判断是否需要延迟输出（用于 Prompts/Images 并行场景）
        // RAG 不在这里判断，因为它使用 DEFERRED_LOG_PREFIXES 缓冲日志
        const shouldDeferOutput = tracker.streamFocusNode === "09_humanize" &&
          DEFERRED_NODES_DURING_STREAM.has(nodeName);

        // 如果正在等待交互，不显示后台节点的启动信息
        // 或者当前处于流式输出窗口，抑制后台节点的启动提示
        if ((tracker.isWaitingForInteraction && !NODE_INFO[nodeName]?.isInteractive) || shouldDeferOutput) {
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
        const endTime = Date.now();
        const startTime = tracker.activeNodes.get(nodeName);
        tracker.activeNodes.delete(nodeName);

        // 调试：记录未匹配的节点
        if (!startTime && process.env.DEBUG_TIME) {
          console.log(`[DEBUG] No startTime found for node: ${nodeName}, activeNodes were:`, Array.from(tracker.activeNodes.keys()));
        }

        let durationMs: number;
        if (startTime) {
          durationMs = endTime - startTime;
        } else {
          // 恢复执行时 activeNodes 为空，或数据缺失
          // 尝试从事件元数据获取，或使用 0（避免错误的负数）
          durationMs = 0;
        }

        // 优先使用节点自己记录的执行时间（更准确）
        const nodeExecutionTime = stateUpdate?.decisions?.timings?.[nodeName];
        if (nodeExecutionTime && typeof nodeExecutionTime === "number") {
          durationMs = nodeExecutionTime;
        }
        let interactionWaitMs = 0;
        tracker.completedNodes.add(nodeName);

        const nodeInfo = NODE_INFO[nodeName];
        const displayName = nodeInfo?.name || nodeName;
        // 判断是否需要延迟输出（用于 Prompts/Images 并行场景）
        const shouldDeferOutput = tracker.streamFocusNode === "09_humanize" &&
          DEFERRED_NODES_DURING_STREAM.has(nodeName);

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
            startTime: startTime || 0
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
        } else if (!tracker.isWaitingForInteraction && !shouldDeferOutput) {
          // 非交互节点，且不在等待交互中，才显示完成信息
          if (nodeInfo?.hasOutput) {
            console.log(chalk.green(`✅ ${displayName} (${duration}s)`));
          } else {
            console.log(chalk.dim(`✓ ${displayName} (${duration}s)`));
          }
        } else if (shouldDeferOutput) {
          tracker.deferredCompletions.push({
            nodeName,
            displayName,
            duration,
            hasOutput: Boolean(nodeInfo?.hasOutput)
          });
        }

        // 如果还有活跃节点，显示剩余进度（但不在等待交互时）
        if (tracker.activeNodes.size > 0 && !tracker.isWaitingForInteraction && !tracker.streamFocusNode) {
          const remaining = Array.from(tracker.activeNodes.keys())
            .map(n => NODE_INFO[n]?.name || n);
          console.log(chalk.dim(`   ⏳ 进行中: ${remaining.join(", ")}`));
        }

        // 并行节点处理：收集摘要或显示
        // 如果已有摘要收集，或删除前活跃节点>1，则是并行执行
        const wasParallelExecution = tracker.parallelCompletionSummaries.size > 0 ||
          (tracker.activeNodes.size + 1 > 1);

        if (nodeInfo?.hasOutput && tracker.lastState && !tracker.isWaitingForInteraction && !shouldDeferOutput) {
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

        // 当聚焦节点完成时，清除聚焦状态并输出缓冲的日志
        if (tracker.streamFocusNode && nodeName === tracker.streamFocusNode) {
          // 清除优先级节点设置，释放其他节点的输出
          outputCoordinator.clearPriorityNode(tracker.streamFocusNode);
          tracker.streamFocusNode = null;
          if (tracker.deferredCompletions.length > 0) {
            const completions = tracker.deferredCompletions.splice(0);
            for (const item of completions) {
              const line = `${item.displayName} (${item.duration}s)`;
              if (item.hasOutput) {
                console.log(chalk.green(`✅ ${line}`));
              } else {
                console.log(chalk.dim(`✓ ${line}`));
              }
            }
          }
          if (deferredLogs.length > 0) {
            const logs = deferredLogs.splice(0);
            for (const args of logs) {
              originalLog(...args);
            }
          }
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
          await exitWithSummary(threadId, timingSummaries, workflowStartTime, 0, false);
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

    const totalWaitMs = 0; // 不再使用，computeDuration 现在从 summaries 直接计算
    showTimingDashboard(timingSummaries, workflowStartTime, totalWaitMs, threadId);

  } catch (error) {
    spinner.fail("执行失败");

    // 记录失败节点的部分耗时
    // 即使节点失败，也花费了时间（可能在等待 API 响应）
    for (const [nodeName, startTime] of tracker.activeNodes.entries()) {
      const durationMs = Date.now() - startTime;
      const nodeInfo = NODE_INFO[nodeName];
      if (nodeInfo) {
        timingSummaries.push({
          nodeName,
          displayName: nodeInfo.name || nodeName,
          duration: durationMs,
          startTime
        });
      }
    }

    const totalWaitMs = 0;
    await handleNodeError(error, threadId, timingSummaries, workflowStartTime, totalWaitMs, { prompt });
  }
}

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
