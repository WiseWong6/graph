/**
 * 性能指标追踪
 *
 * 职责: 追踪和报告系统性能指标
 *
 * 指标类型:
 * - 执行时间
 * - LLM Token 使用量
 * - 缓存命中率
 * - 错误统计
 * - 内存使用
 */

import { createLogger } from "./logger.js";

const log = createLogger("metrics");

/**
 * 指标类型
 */
export enum MetricType {
  COUNTER = "counter",
  GAUGE = "gauge",
  HISTOGRAM = "histogram"
}

/**
 * 指标数据点
 */
interface MetricDataPoint {
  value: number;
  timestamp: number;
  labels?: Record<string, string>;
}

/**
 * 指标定义
 */
interface Metric {
  name: string;
  type: MetricType;
  description: string;
  data: MetricDataPoint[];
}

/**
 * LLM 使用统计
 */
export interface LLMUsageStats {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost?: number;
}

/**
 * 节点执行统计
 */
export interface NodeExecutionStats {
  nodeName: string;
  startTime: number;
  endTime: number;
  duration: number;
  success: boolean;
  error?: string;
  llmUsage?: LLMUsageStats;
}

/**
 * 性能指标管理器
 */
export class MetricsTracker {
  private metrics: Map<string, Metric> = new Map();
  private nodeExecutions: NodeExecutionStats[] = [];
  private readonly startTime: number = Date.now();

  /**
   * 记录计数器指标（递增）
   */
  increment(name: string, value: number = 1, labels?: Record<string, string>): void {
    this.getOrCreateMetric(name, MetricType.COUNTER, `${name} counter`);
    this.addMetricDataPoint(name, value, labels);
  }

  /**
   * 记录仪表指标（当前值）
   */
  gauge(name: string, value: number, labels?: Record<string, string>): void {
    this.getOrCreateMetric(name, MetricType.GAUGE, `${name} gauge`);
    this.addMetricDataPoint(name, value, labels);
  }

  /**
   * 记录直方图指标（分布）
   */
  histogram(name: string, value: number, labels?: Record<string, string>): void {
    this.getOrCreateMetric(name, MetricType.HISTOGRAM, `${name} histogram`);
    this.addMetricDataPoint(name, value, labels);
  }

  /**
   * 记录节点执行开始
   */
  startNodeExecution(nodeName: string): number {
    const startTime = Date.now();
    this.increment("node_executions_started", 1, { node: nodeName });
    return startTime;
  }

  /**
   * 记录节点执行完成
   */
  endNodeExecution(
    nodeName: string,
    startTime: number,
    success: boolean,
    error?: string,
    llmUsage?: LLMUsageStats
  ): void {
    const endTime = Date.now();
    const duration = endTime - startTime;

    const stats: NodeExecutionStats = {
      nodeName,
      startTime,
      endTime,
      duration,
      success,
      error,
      llmUsage
    };

    this.nodeExecutions.push(stats);

    // 记录指标
    this.histogram("node_execution_duration_ms", duration, { node: nodeName, status: success ? "success" : "error" });
    this.increment("node_executions_completed", 1, { node: nodeName, status: success ? "success" : "error" });

    // 记录 LLM 使用量
    if (llmUsage) {
      this.increment("llm_prompt_tokens", llmUsage.promptTokens, { node: nodeName });
      this.increment("llm_completion_tokens", llmUsage.completionTokens, { node: nodeName });
      this.increment("llm_total_tokens", llmUsage.totalTokens, { node: nodeName });
    }

    if (error) {
      this.increment("node_errors", 1, { node: nodeName, error_type: error });
    }
  }

  /**
   * 记录内存使用
   */
  recordMemoryUsage(labels?: Record<string, string>): void {
    const usage = process.memoryUsage();
    this.gauge("memory_heap_used_mb", usage.heapUsed / 1024 / 1024, labels);
    this.gauge("memory_heap_total_mb", usage.heapTotal / 1024 / 1024, labels);
    this.gauge("memory_rss_mb", usage.rss / 1024 / 1024, labels);
  }

  /**
   * 获取指标摘要
   */
  getSummary(): MetricsSummary {
    // 计算 LLM Token 统计
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let totalCost = 0;

    for (const exec of this.nodeExecutions) {
      if (exec.llmUsage) {
        totalPromptTokens += exec.llmUsage.promptTokens;
        totalCompletionTokens += exec.llmUsage.completionTokens;
        totalCost += exec.llmUsage.cost || 0;
      }
    }

    // 计算节点执行统计
    const nodeStats = new Map<string, { count: number; totalDuration: number; errors: number }>();
    for (const exec of this.nodeExecutions) {
      const stats = nodeStats.get(exec.nodeName) || { count: 0, totalDuration: 0, errors: 0 };
      stats.count++;
      stats.totalDuration += exec.duration;
      if (!exec.success) stats.errors++;
      nodeStats.set(exec.nodeName, stats);
    }

    const nodeSummaries: Record<string, NodeSummary> = {};
    for (const [node, stats] of nodeStats.entries()) {
      nodeSummaries[node] = {
        executions: stats.count,
        totalDuration: stats.totalDuration,
        avgDuration: stats.totalDuration / stats.count,
        errors: stats.errors
      };
    }

    return {
      uptime: Date.now() - this.startTime,
      llm: {
        totalPromptTokens,
        totalCompletionTokens,
        totalTokens: totalPromptTokens + totalCompletionTokens,
        totalCost
      },
      nodes: nodeSummaries,
      memory: process.memoryUsage()
    };
  }

  /**
   * 打印摘要
   */
  printSummary(): void {
    const summary = this.getSummary();

    log.separator("=", 60);
    log.info("Performance Metrics Summary");
    log.separator("=", 60);

    // 运行时间
    const uptimeSeconds = (summary.uptime / 1000).toFixed(2);
    log.info(`Uptime: ${uptimeSeconds}s`);

    // LLM 使用
    log.info("");
    log.info("LLM Usage:");
    log.info(`  Prompt Tokens: ${summary.llm.totalPromptTokens.toLocaleString()}`);
    log.info(`  Completion Tokens: ${summary.llm.totalCompletionTokens.toLocaleString()}`);
    log.info(`  Total Tokens: ${summary.llm.totalTokens.toLocaleString()}`);
    if (summary.llm.totalCost > 0) {
      log.info(`  Est. Cost: $${summary.llm.totalCost.toFixed(4)}`);
    }

    // 节点执行
    log.info("");
    log.info("Node Executions:");
    for (const [node, stats] of Object.entries(summary.nodes)) {
      log.info(`  ${node}:`);
      log.info(`    Executions: ${stats.executions}`);
      log.info(`    Avg Duration: ${stats.avgDuration.toFixed(0)}ms`);
      if (stats.errors > 0) {
        log.info(`    Errors: ${stats.errors}`);
      }
    }

    // 内存使用
    log.info("");
    log.info("Memory Usage:");
    log.info(`  Heap Used: ${(summary.memory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
    log.info(`  Heap Total: ${(summary.memory.heapTotal / 1024 / 1024).toFixed(2)} MB`);
    log.info(`  RSS: ${(summary.memory.rss / 1024 / 1024).toFixed(2)} MB`);

    log.separator("=", 60);
  }

  /**
   * 清除所有指标
   */
  clear(): void {
    this.metrics.clear();
    this.nodeExecutions = [];
  }

  /**
   * 导出指标（用于上报）
   */
  export(): Record<string, any> {
    return {
      metrics: Array.from(this.metrics.entries()).map(([name, metric]) => ({
        name,
        type: metric.type,
        description: metric.description,
        data: metric.data
      })),
      nodeExecutions: this.nodeExecutions,
      summary: this.getSummary()
    };
  }

  private getOrCreateMetric(name: string, type: MetricType, description: string): Metric {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, { name, type, description, data: [] });
    }
    return this.metrics.get(name)!;
  }

  private addMetricDataPoint(name: string, value: number, labels?: Record<string, string>): void {
    const metric = this.metrics.get(name);
    if (metric) {
      metric.data.push({
        value,
        timestamp: Date.now(),
        labels
      });
    }
  }
}

/**
 * 指标摘要
 */
export interface MetricsSummary {
  uptime: number;
  llm: {
    totalPromptTokens: number;
    totalCompletionTokens: number;
    totalTokens: number;
    totalCost: number;
  };
  nodes: Record<string, NodeSummary>;
  memory: NodeJS.MemoryUsage;
}

/**
 * 节点摘要
 */
export interface NodeSummary {
  executions: number;
  totalDuration: number;
  avgDuration: number;
  errors: number;
}

/**
 * 全局指标追踪器实例
 */
export const metrics = new MetricsTracker();

/**
 * 定期打印摘要（可选）
 */
export function startPeriodicReporting(intervalMs: number = 60000): NodeJS.Timeout {
  return setInterval(() => {
    metrics.printSummary();
  }, intervalMs);
}
