/**
 * ResumeManager - 基于 LangGraph checkpoint 的恢复管理器
 *
 * 核心功能:
 * 1. 列出所有历史 thread
 * 2. 列出某个 thread 的所有 checkpoint
 * 3. 从 checkpoint 恢复执行
 *
 * 设计原则:
 * - 零破坏性（不修改图结构）
 * - 简洁（复用现有 checkpoint 机制）
 * - 覆盖所有场景（失败重试、回退实验、继续执行）
 */

import type { CompiledStateGraph } from "@langchain/langgraph";
import { join } from "path";
import inquirer from "inquirer";
import chalk from "chalk";

// 使用简化的类型定义，避免复杂类型参数
type GraphType = CompiledStateGraph<any, any, any, any, any, any, any, any, any>;

// 节点名称映射（中文友好）
const NODE_NAMES: Record<string, string> = {
  "gate_a_select_wechat": "选择公众号",
  "01_research": "调研",
  "02_rag": "RAG 检索",
  "03_titles": "生成标题",
  "gate_c_select_title": "选择标题",
  "05_draft": "撰写初稿",
  "06_rewrite": "智性叙事重写",
  "07_confirm": "确认图片配置",
  "08_humanize": "人化处理",
  "09_prompts": "生成图片提示词",
  "10_images": "生成图片",
  "11_upload": "上传图片",
  "12_html": "转换 HTML",
  "13_draftbox": "发布到草稿箱",
  "end": "完成",
};

/**
 * Thread 摘要
 */
export interface ThreadSummary {
  threadId: string;
  createdAt: Date;
  updatedAt: Date;
  lastNode: string;
  status: "completed" | "interrupted" | "failed";
  topic?: string;
}

/**
 * Checkpoint 摘要
 */
export interface CheckpointSummary {
  checkpointId: string;
  timestamp: Date;
  node: string;
  step: number;
}

/**
 * 恢复管理器
 */
export class ResumeManager {
  constructor(private graph: GraphType) {
    // checkpointer is managed by the graph, no need to store
  }

  /**
   * 列出所有 thread
   *
   * 直接查询 SQLite 数据库获取所有唯一的 thread_id
   */
  async listThreads(): Promise<ThreadSummary[]> {
    // 动态导入 better-sqlite3（由 checkpoint-sqlite 依赖）
    const Database = await import("better-sqlite3").then(m => m.default);
    const dbPath = join(process.cwd(), "src", "checkpoints", "article", "checkpoints.db");
    const db = new Database(dbPath);

    try {
      const rows = db
        .prepare(`
          SELECT
            thread_id,
            checkpoint_id,
            checkpoint_ns
          FROM checkpoints
          ORDER BY thread_id DESC
        `)
        .all() as Array<{ thread_id: string; checkpoint_id: string; checkpoint_ns: string }>;

      // 获取唯一 thread_id（保留最新的 checkpoint_id）
      const uniqueThreads = new Map<string, { checkpointId: string; checkpointNs: string }>();
      for (const row of rows) {
        if (!uniqueThreads.has(row.thread_id)) {
          uniqueThreads.set(row.thread_id, {
            checkpointId: row.checkpoint_id,
            checkpointNs: row.checkpoint_ns
          });
        }
      }

      const threads: ThreadSummary[] = [];

      for (const [threadId, checkpointInfo] of uniqueThreads) {
        // 获取该 thread 的最新状态
        const config = {
          configurable: {
            thread_id: threadId,
            checkpoint_ns: checkpointInfo.checkpointNs,
            checkpoint_id: checkpointInfo.checkpointId
          }
        };
        let lastNode = "";
        let status: "completed" | "interrupted" | "failed" = "completed";
        let topic: string | undefined;

        try {
          const state = await this.graph.getState(config);
          lastNode = state.next?.[0] || "end";
          status = state.next?.length === 0 ? "completed" : "interrupted";
          topic = state.values?.prompt;
        } catch {
          // 无法获取状态，使用默认值
          lastNode = "unknown";
          status = "failed";
        }

        // 从 checkpoint_id 提取时间戳（通常是 base64 编码的）
        let createdAt = new Date();
        let updatedAt = new Date();
        try {
          // checkpoint_id 格式通常是: <base64_encoded_timestamp>
          // 尝试解码获取时间戳，如果失败则使用当前时间
          const decoded = Buffer.from(checkpointInfo.checkpointId, "base64").toString();
          const match = decoded.match(/(\d+)/);
          if (match) {
            const timestamp = parseInt(match[1], 10);
            if (timestamp > 1000000000000) { // 毫秒时间戳
              createdAt = new Date(timestamp);
              updatedAt = new Date(timestamp);
            }
          }
        } catch {
          // 解码失败，使用当前时间
        }

        threads.push({
          threadId,
          createdAt,
          updatedAt,
          lastNode,
          status,
          topic,
        });
      }

      // 按更新时间排序
      threads.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

      return threads;
    } finally {
      db.close();
    }
  }

  /**
   * 列出某个 thread 的所有 checkpoint
   *
   * 使用 LangGraph 的 getStateHistory 获取完整历史
   */
  async listCheckpoints(threadId: string): Promise<CheckpointSummary[]> {
    const config = { configurable: { thread_id: threadId } };
    const checkpoints: CheckpointSummary[] = [];
    let step = 0;

    try {
      // 使用 getStateHistory 获取历史
      for await (const stateEvent of await this.graph.getStateHistory(config)) {
        // 从 metadata 提取节点名
        let node = "unknown";
        if (stateEvent.metadata?.source) {
          node = stateEvent.metadata.source as string;
        }

        // 从 config 获取 checkpoint_id
        const checkpointId = stateEvent.config?.configurable?.checkpoint_id || "";
        // 使用当前时间作为时间戳（StateSnapshot 不包含时间戳）
        const timestamp = new Date();

        checkpoints.push({
          checkpointId,
          timestamp,
          node,
          step: step++,
        });
      }
    } catch (error) {
      console.error(chalk.yellow(`获取 checkpoint 历史失败: ${error}`));
    }

    return checkpoints;
  }

  /**
   * 从 checkpoint 恢复执行
   *
   * @param threadId - thread ID
   * @param checkpointId - checkpoint ID（可选，默认使用最新）
   */
  async resume(threadId: string, checkpointId?: string): Promise<void> {
    const config = {
      configurable: {
        thread_id: threadId,
        ...(checkpointId && { checkpoint_ns: "", checkpoint_id: checkpointId }),
      },
      streamMode: "values" as const,
    };

    // 获取当前状态
    const state = await this.graph.getState(config);
    const nextNodes = state.next?.join(", ") || "无";

    console.log(chalk.cyan.bold("\n═══════════════════════════════════════════════════════════"));
    console.log(chalk.cyan.bold("📍 恢复执行"));
    console.log(chalk.cyan.bold("═══════════════════════════════════════════════════════════\n"));
    console.log(chalk.gray("Thread ID: ") + chalk.white(threadId));
    if (checkpointId) {
      console.log(chalk.gray("Checkpoint ID: ") + chalk.white(checkpointId));
    }
    console.log(chalk.gray("当前节点: ") + chalk.yellow(nextNodes));
    console.log(chalk.gray("主题: ") + chalk.white(state.values?.prompt || "无"));
    console.log("");

    // 恢复执行（使用 null 作为输入，表示继续执行）
    for await (const event of await this.graph.stream(null, config)) {
      // 事件处理在 step-cli 中完成
      console.log(event);
    }
  }

  /**
   * 格式化时间戳为相对时间
   */
  private formatRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "刚刚";
    if (diffMins < 60) return `${diffMins} 分钟前`;
    if (diffHours < 24) return `${diffHours} 小时前`;
    return `${diffDays} 天前`;
  }

  /**
   * 获取状态图标
   */
  private getStatusIcon(status: string): string {
    switch (status) {
      case "completed":
        return "✅";
      case "failed":
        return "❌";
      case "interrupted":
        return "⏸️";
      default:
        return "⏳";
    }
  }

  /**
   * 获取节点显示名称（中文友好）
   */
  private getNodeDisplayName(nodeId: string): string {
    if (nodeId === "end") return "完成";
    return NODE_NAMES[nodeId] || nodeId;
  }

  /**
   * 交互式选择 thread
   */
  async selectThread(): Promise<string | null> {
    const threads = await this.listThreads();

    if (threads.length === 0) {
      console.log(chalk.yellow("没有可恢复的会话"));
      return null;
    }

    const { threadId } = await inquirer.prompt([
      {
        type: "list",
        name: "threadId",
        message: "选择要恢复的会话:",
        choices: [
          ...threads.map((t) => ({
            name: `${this.getStatusIcon(t.status)} [${this.getNodeDisplayName(t.lastNode)}] ${this.formatRelativeTime(t.updatedAt)} - ${t.topic || t.threadId}`,
            value: t.threadId,
          })),
          new inquirer.Separator(),
          { name: "🆕 新建会话", value: "__NEW__" },
        ],
      },
    ]);

    return threadId === "__NEW__" ? null : threadId;
  }

  /**
   * 交互式选择 checkpoint
   */
  async selectCheckpoint(threadId: string): Promise<string | null> {
    const checkpoints = await this.listCheckpoints(threadId);

    if (checkpoints.length === 0) {
      console.log(chalk.yellow("该会话没有可恢复的检查点"));
      return null;
    }

    const { checkpointId } = await inquirer.prompt([
      {
        type: "list",
        name: "checkpointId",
        message: "选择恢复点:",
        choices: [
          ...checkpoints.map((cp) => {
            const nodeName = NODE_NAMES[cp.node] || cp.node;
            return {
              name: `${cp.timestamp.toLocaleTimeString()} - ${nodeName}`,
              value: cp.checkpointId,
            };
          }),
          new inquirer.Separator(),
          { name: "🔙 返回", value: "__BACK__" },
        ],
      },
    ]);

    return checkpointId === "__BACK__" ? null : checkpointId;
  }
}
