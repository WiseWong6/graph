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
  "gate_a_select_model": "选择模型",
  "02_research": "调研",
  "03_rag": "RAG 检索",
  "04_titles": "生成标题",
  "gate_c_select_title": "选择标题",
  "06_draft": "撰写初稿",
  "07_rewrite": "智性叙事重写",
  "08_confirm": "确认图片配置",
  "09_humanize": "人化处理",
  "10_prompts": "生成图片提示词",
  "11_images": "生成图片",
  "12_upload": "上传图片",
  "13_wait_for_upload": "等待上传完成",
  "14_html": "转换 HTML",
  "15_draftbox": "发布到草稿箱",
  "loop": "流程推进",
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
  totalDuration?: number; // 累计耗时（毫秒）
}

/**
 * Checkpoint 摘要
 */
export interface CheckpointSummary {
  checkpointId: string;
  timestamp: Date;
  node: string;
  step: number;
  summary?: string; // 节点摘要
  nextNode?: string; // 下一步节点
}

/**
 * 恢复管理器
 */
export class ResumeManager {
  constructor(private graph: GraphType) {
    // checkpointer is managed by the graph, no need to store
  }

  /**
   * 判断是否为用户会话（过滤测试数据）
   */
  private isUserThread(threadId: string): boolean {
    // 只显示 step-article-* 前缀的会话
    return threadId.startsWith("step-article-");
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
            checkpoint_ns,
            checkpoint
          FROM checkpoints
          WHERE thread_id LIKE 'step-article-%'
        `)
        .all() as Array<{ thread_id: string; checkpoint_id: string; checkpoint_ns: string; checkpoint: Buffer }>;

      // 获取唯一 thread_id（保留最新的 checkpoint_id）
      const uniqueThreads = new Map<string, {
        checkpointId: string;
        checkpointNs: string;
        createdAt: Date;
        updatedAt: Date;
      }>();
      for (const row of rows) {
        const timestamp = this.extractCheckpointTimestamp(row.checkpoint)
          || this.extractThreadTimestamp(row.thread_id)
          || new Date();
        const existing = uniqueThreads.get(row.thread_id);
        if (!existing) {
          uniqueThreads.set(row.thread_id, {
            checkpointId: row.checkpoint_id,
            checkpointNs: row.checkpoint_ns,
            createdAt: timestamp,
            updatedAt: timestamp,
          });
          continue;
        }
        if (timestamp.getTime() > existing.updatedAt.getTime()) {
          existing.updatedAt = timestamp;
          existing.checkpointId = row.checkpoint_id;
          existing.checkpointNs = row.checkpoint_ns;
        }
        if (timestamp.getTime() < existing.createdAt.getTime()) {
          existing.createdAt = timestamp;
        }
      }

      const threads: ThreadSummary[] = [];

      for (const [threadId, checkpointInfo] of uniqueThreads) {
        // 过滤掉测试数据
        if (!this.isUserThread(threadId)) {
          continue;
        }

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
        let totalDuration = 0;

        try {
          const state = await this.graph.getState(config);
          lastNode = state.next?.[0] || "end";
          status = state.next?.length === 0 ? "completed" : "interrupted";
          topic = state.values?.prompt;
          // 从 state 获取耗时数据
          const metrics = state.values?.__timing__ as { totalDuration?: number } | undefined;
          totalDuration = metrics?.totalDuration || 0;
        } catch {
          // 无法获取状态，使用默认值
          lastNode = "unknown";
          status = "failed";
        }

        threads.push({
          threadId,
          createdAt: checkpointInfo.createdAt,
          updatedAt: checkpointInfo.updatedAt,
          lastNode,
          status,
          topic,
          totalDuration,
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
    // 动态导入 better-sqlite3（由 checkpoint-sqlite 依赖）
    const Database = await import("better-sqlite3").then(m => m.default);
    const dbPath = join(process.cwd(), "src", "checkpoints", "article", "checkpoints.db");
    const db = new Database(dbPath);

    try {
      const rows = db
        .prepare(`
          SELECT
            checkpoint_id,
            checkpoint_ns,
            checkpoint
          FROM checkpoints
          WHERE thread_id = ?
        `)
        .all(threadId) as Array<{ checkpoint_id: string; checkpoint_ns: string; checkpoint: Buffer }>;

      const ordered = rows
        .map((row) => ({
          checkpointId: row.checkpoint_id,
          checkpointNs: row.checkpoint_ns,
          timestamp: this.extractCheckpointTimestamp(row.checkpoint)
            || this.extractThreadTimestamp(threadId)
            || new Date(),
        }))
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      const checkpoints: CheckpointSummary[] = [];
      let step = 0;

      for (const item of ordered) {
        let node = "unknown";
        let summary: string | undefined;
        let nextNode: string | undefined;

        try {
          const state = await this.graph.getState({
            configurable: {
              thread_id: threadId,
              checkpoint_id: item.checkpointId,
              checkpoint_ns: item.checkpointNs
            }
          });
          nextNode = state.next?.[0];
          node = nextNode || node;
          summary = this.extractNodeSummary(node, state.values);
        } catch {
          // 无法获取状态，忽略
        }

        checkpoints.push({
          checkpointId: item.checkpointId,
          timestamp: item.timestamp,
          node,
          step: step++,
          summary,
          nextNode,
        });
      }

      return checkpoints;
    } catch (error) {
      console.error(chalk.yellow(`获取 checkpoint 历史失败: ${error}`));
      return [];
    } finally {
      db.close();
    }
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
   * 格式化 Thread 时间（相对 + 绝对）
   */
  private formatThreadTime(date: Date): string {
    return this.formatFriendlyTime(date);
  }

  /**
   * 格式化 Checkpoint 时间（精确时间）
   */
  private formatCheckpointTime(date: Date): string {
    return this.formatFriendlyTime(date);
  }

  /**
   * 友好时间显示：今晚/昨天/前天/日期
   */
  private formatFriendlyTime(date: Date): string {
    const now = new Date();
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const nowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffDays = Math.floor((nowStart.getTime() - dayStart.getTime()) / 86400000);

    const hour = date.getHours();
    const minute = date.getMinutes();
    const timeStr = `${hour}点${minute.toString().padStart(2, "0")}分`;

    if (diffDays === 0) {
      const prefix = hour >= 18 ? "今晚" : "今天";
      return `${prefix} ${timeStr}`;
    }
    if (diffDays === 1) {
      return `昨天 ${timeStr}`;
    }
    if (diffDays === 2) {
      return `前天 ${timeStr}`;
    }
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}月${day}日 ${timeStr}`;
  }

  /**
   * 从 threadId 提取创建时间
   */
  private extractThreadTimestamp(threadId: string): Date | null {
    const match = threadId.match(/step-article-(\d+)/);
    if (!match) return null;
    const timestamp = Number.parseInt(match[1], 10);
    if (!Number.isFinite(timestamp)) return null;
    return new Date(timestamp);
  }

  /**
   * 从 checkpoint blob 提取时间戳
   */
  private extractCheckpointTimestamp(checkpoint: Buffer): Date | null {
    try {
      const text = checkpoint.toString("utf-8");
      const parsed = JSON.parse(text) as { ts?: string };
      if (!parsed?.ts) return null;
      const date = new Date(parsed.ts);
      return Number.isNaN(date.getTime()) ? null : date;
    } catch {
      return null;
    }
  }

  /**
   * 格式化持续时间
   */
  private formatDuration(ms: number): string {
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
   * 提取节点摘要
   */
  private extractNodeSummary(node: string, values: any): string | undefined {
    switch (node) {
      case "gate_c_select_title":
        const selectedTitle = values?.selected_title;
        return selectedTitle ? `标题: "${selectedTitle}"` : undefined;
      case "04_titles":
        const titlesCount = values?.titles?.length || 0;
        return titlesCount > 0 ? `候选数: ${titlesCount} 个` : undefined;
      case "06_draft":
        const draftPreview = values?.draft?.slice(0, 30);
        return draftPreview ? `预览: "${draftPreview}..."` : undefined;
      case "07_rewrite":
        const rewritePreview = values?.rewrite_content?.slice(0, 30);
        return rewritePreview ? `预览: "${rewritePreview}..."` : undefined;
      case "09_humanize":
        const humanizedPreview = values?.humanized?.slice(0, 30);
        return humanizedPreview ? `预览: "${humanizedPreview}..."` : undefined;
      default:
        return undefined;
    }
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

    // 找到最新中断的会话作为推荐
    const recommendedThread = threads.find(t => t.status === "interrupted");

    const choices = threads.map((t) => {
      const isRecommended = recommendedThread && t.threadId === recommendedThread.threadId;
      const statusIcon = this.getStatusIcon(t.status);
      const timeStr = this.formatThreadTime(t.updatedAt);
      const nodeName = this.getNodeDisplayName(t.lastNode);
      const duration = t.totalDuration
        ? this.formatDuration(t.totalDuration)
        : "未知";

      // 构建显示名称（两行格式）
      const displayName = isRecommended
        ? `⭐ [推荐] ${statusIcon} ${timeStr} - ${t.topic || t.threadId}\n` +
          `   节点: ${nodeName} | 已耗时: ${duration}`
        : `  ${statusIcon} ${timeStr} - ${t.topic || t.threadId}\n` +
          `   节点: ${nodeName} | 已耗时: ${duration}`;

      return {
        name: displayName,
        value: t.threadId,
        short: t.topic || t.threadId,
      };
    });

    // 如果有推荐会话，将其放到第一位
    if (recommendedThread) {
      const recommendedIndex = choices.findIndex(c => c.value === recommendedThread.threadId);
      if (recommendedIndex > 0) {
        const [recommended] = choices.splice(recommendedIndex, 1);
        choices.unshift(recommended);
      }
    }

    // 添加分隔线和新建选项
    const finalChoices: any[] = [
      ...choices,
      new inquirer.Separator("────────────────────────────────────────────────────────"),
      { name: "🆕 新建会话", value: "__NEW__", short: "新建会话" }
    ];

    const { threadId } = await inquirer.prompt([
      {
        type: "list",
        name: "threadId",
        message: "选择要恢复的会话:",
        choices: finalChoices,
        pageSize: 15,
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

    // 最新的 checkpoint 作为推荐（第一个）
    const choices = checkpoints.map((cp, index) => {
      const nodeName = NODE_NAMES[cp.node] || cp.node;
      const timeStr = this.formatCheckpointTime(cp.timestamp);
      const isRecommended = index === 0;

      let displayName = isRecommended
        ? `⭐ [推荐] ${timeStr} - ${nodeName}`
        : `  ${timeStr} - ${nodeName}`;

      // 添加摘要信息（如果有）
      if (cp.summary) {
        displayName += `\n   ${cp.summary}`;
      }

      // 添加下一步提示（如果有）
      if (cp.nextNode && cp.nextNode !== cp.node) {
        const nextNodeName = this.getNodeDisplayName(cp.nextNode);
        displayName += `\n   ↓ 下一步: ${nextNodeName}`;
      }

      return {
        name: displayName,
        value: cp.checkpointId,
        short: nodeName,
      };
    });

    // 添加分隔线和返回选项
    const finalChoices: any[] = [
      ...choices,
      new inquirer.Separator("────────────────────────────────────────────────────────"),
      { name: "🔙 返回", value: "__BACK__", short: "返回" }
    ];

    const { checkpointId } = await inquirer.prompt([
      {
        type: "list",
        name: "checkpointId",
        message: "选择恢复点:",
        choices: finalChoices,
        pageSize: 15,
      },
    ]);

    return checkpointId === "__BACK__" ? null : checkpointId;
  }
}
