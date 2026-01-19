/**
 * 输出协调器 - 管理并行节点的输出顺序
 * 确保被抑制输出的节点等待主动输出节点完成后再输出
 */
class OutputCoordinator {
  private activeStreamCount = 0;
  private deferredOutputs: Array<() => void> = [];

  beginStream(): void {
    this.activeStreamCount++;
  }

  endStream(): void {
    this.activeStreamCount--;
    if (this.activeStreamCount <= 0) {
      this.activeStreamCount = 0;
      const deferred = this.deferredOutputs.splice(0);
      deferred.forEach(fn => fn());
    }
  }

  hasActiveStream(): boolean {
    return this.activeStreamCount > 0;
  }

  defer(outputFn: () => void): boolean {
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
