/**
 * 输出协调器 - 管理并行节点的输出顺序
 * 确保被抑制输出的节点等待主动输出节点完成后再输出
 *
 * 核心机制：
 * 1. beginStream/endStream: 旧的兼容方法，用于全局流状态
 * 2. beginNodeStream/endNodeStream: 新增节点级流状态追踪
 * 3. shouldSuppressOutput: 检查是否应该抑制当前节点的输出
 * 4. defer: 延迟输出函数，支持节点级过滤
 */
class OutputCoordinator {
  private activeStreamCount = 0;
  private deferredOutputs: Array<() => void> = [];

  nodeStreams: Map<string, number> = new Map();
  private priorityNodes = new Set<string>();

  setPriorityNode(nodeId: string): void {
    this.priorityNodes.add(nodeId);
  }

  clearPriorityNode(nodeId: string): void {
    this.priorityNodes.delete(nodeId);
  }

  hasActiveStream(): boolean {
    return this.activeStreamCount > 0;
  }

  beginStream(): void {
    this.activeStreamCount++;
  }

  endStream(): void {
    this.activeStreamCount--;
    if (this.activeStreamCount <= 0) {
      this.activeStreamCount = 0;
      const deferred = this.deferredOutputs.splice(0);
      deferred.forEach((fn: () => void) => fn());
    }
  }

  beginNodeStream(nodeId: string): void {
    const count = this.nodeStreams.get(nodeId) || 0;
    this.nodeStreams.set(nodeId, count + 1);
  }

  endNodeStream(nodeId: string): void {
    const count = this.nodeStreams.get(nodeId) || 0;
    if (count > 0) {
      this.nodeStreams.set(nodeId, count - 1);
      if (count - 1 === 0) {
        this.nodeStreams.delete(nodeId);
      }
    }
  }

  shouldSuppressOutput(nodeId: string): boolean {
    if (this.priorityNodes.size === 0) {
      return false;
    }

    const nodes = Array.from(this.priorityNodes);
    for (let i = 0; i < nodes.length; i++) {
      const priorityNode = nodes[i];
      if (priorityNode === nodeId) {
        return false;
      }
      if (this.nodeStreams.has(priorityNode)) {
        return true;
      }
    }
    return false;
  }

  defer(outputFn: () => void, nodeId?: string): boolean {
    if (nodeId && this.shouldSuppressOutput(nodeId)) {
      this.deferredOutputs.push(outputFn);
      return true;
    }
    if (this.hasActiveStream()) {
      this.deferredOutputs.push(outputFn);
      return true;
    }
    return false;
  }

  executeNow(outputFn: () => void): void {
    outputFn();
  }
}

class AsyncMutex {
  private locked = false;
  private queue: Array<(value: void) => void> = [];

  async acquire(): Promise<() => void> {
    while (this.locked) {
      await new Promise<void>(resolve => this.queue.push(resolve));
    }
    this.locked = true;
    return () => this.release();
  }

  private release(): void {
    this.locked = false;
    const resolve = this.queue.shift();
    if (resolve) {
      resolve();
    }
  }
}

export const outputCoordinator = new OutputCoordinator();
export const stdoutMutex = new AsyncMutex();
