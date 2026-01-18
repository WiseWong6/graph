/**
 * 并发控制工具
 * 用于限制并行执行的任务数量
 */

/**
 * 并行映射 - 带并发控制的 Promise.map
 *
 * @param items - 要处理的数组
 * @param fn - 异步处理函数
 * @param concurrency - 并发数
 * @returns 处理结果数组
 *
 * @example
 * ```ts
 * const results = await parallelMap([1, 2, 3], async (n) => {
 *   return await fetchItem(n);
 * }, 2); // 最多同时执行 2 个
 * ```
 */
export async function parallelMap<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: (R | undefined)[] = new Array(items.length);
  const executing: Array<Promise<R>> = [];

  for (let i = 0; i < items.length; i++) {
    const promise = fn(items[i], i).then((result) => {
      results[i] = result;
      return result;
    });

    executing.push(promise);

    if (executing.length >= concurrency) {
      // 等待最快完成的任务
      await Promise.race(executing);
      // 移除已完成的任务
      const completed = executing.findIndex(
        (p) => p === promise || (results as any)[executing.indexOf(p)] !== undefined
      );
      if (completed !== -1) {
        executing.splice(completed, 1);
      }
    }
  }

  await Promise.all(executing);
  return results as R[];
}

/**
 * 创建一个并发限制器
 *
 * @example
 * ```ts
 * const limit = createConcurrencyLimit(3);
 *
 * await Promise.all([
 *   limit(() => task1()),
 *   limit(() => task2()),
 *   limit(() => task3()),
 *   limit(() => task4()), // 会等待前面的完成
 * ]);
 * ```
 */
export function createConcurrencyLimit(concurrency: number) {
  let running = 0;
  const queue: Array<() => void> = [];

  const execute = async <T>(fn: () => Promise<T>): Promise<T> => {
    while (running >= concurrency) {
      await new Promise<void>((resolve) => queue.push(resolve));
    }

    running++;
    try {
      return await fn();
    } finally {
      running--;
      const next = queue.shift();
      if (next) next();
    }
  };

  return execute;
}
