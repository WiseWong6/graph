/**
 * LLM 响应缓存层
 *
 * 职责: 缓存 LLM 响应，减少重复调用
 *
 * 设计原则:
 * - 基于 prompt hash 的键值缓存
 * - 支持 TTL (time to live)
 * - 可选持久化存储
 * - 缓存命中率追踪
 */

import { createHash } from "crypto";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { createLogger } from "./logger.js";

const log = createLogger("cache");

/**
 * 缓存条目
 */
interface CacheEntry<T> {
  key: string;
  value: T;
  timestamp: number;
  hits: number;
}

/**
 * 缓存配置
 */
export interface CacheConfig {
  /** 最大缓存条目数 */
  maxSize?: number;
  /** TTL (毫秒)，默认 1 小时 */
  ttl?: number;
  /** 是否持久化到磁盘 */
  persist?: boolean;
  /** 持久化路径 */
  persistPath?: string;
}

/**
 * 缓存统计
 */
export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  hitRate: number;
}

/**
 * LLM 响应缓存类
 */
export class LLMCache<T = any> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private stats = { hits: 0, misses: 0 };
  private readonly config: Required<CacheConfig>;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(config: CacheConfig = {}) {
    this.config = {
      maxSize: config.maxSize ?? 1000,
      ttl: config.ttl ?? 60 * 60 * 1000, // 1 hour
      persist: config.persist ?? false,
      persistPath: config.persistPath ?? join(process.cwd(), ".cache", "llm-cache.json")
    };

    // 从磁盘加载缓存
    if (this.config.persist) {
      this.loadFromDisk();
    }

    // 定期清理过期缓存
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000); // 每 5 分钟清理一次
  }

  /**
   * 生成缓存键
   */
  private generateKey(prompt: string, systemMessage?: string): string {
    const content = systemMessage ? `${prompt}|${systemMessage}` : prompt;
    return createHash("sha256").update(content).digest("hex").slice(0, 16);
  }

  /**
   * 检查条目是否过期
   */
  private isExpired(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.timestamp > this.config.ttl;
  }

  /**
   * 清理过期缓存
   */
  private cleanup(): void {
    const beforeSize = this.cache.size;
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      log.debug(`Cleaned ${cleaned} expired entries (size: ${beforeSize} → ${this.cache.size})`);
    }

    // 持久化到磁盘
    if (this.config.persist && cleaned > 0) {
      this.saveToDisk();
    }
  }

  /**
   * 获取缓存
   */
  get(prompt: string, systemMessage?: string): T | null {
    const key = this.generateKey(prompt, systemMessage);
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // 检查是否过期
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    entry.hits++;
    this.stats.hits++;
    return entry.value;
  }

  /**
   * 设置缓存
   */
  set(prompt: string, value: T, systemMessage?: string): void {
    const key = this.generateKey(prompt, systemMessage);

    // 检查是否超过最大缓存大小
    if (this.cache.size >= this.config.maxSize && !this.cache.has(key)) {
      // LRU: 删除最早的条目
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      key,
      value,
      timestamp: Date.now(),
      hits: 0
    });

    // 持久化到磁盘
    if (this.config.persist) {
      this.saveToDisk();
    }
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0 };

    if (this.config.persist) {
      this.saveToDisk();
    }
  }

  /**
   * 获取缓存统计
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      size: this.cache.size,
      hitRate: total > 0 ? this.stats.hits / total : 0
    };
  }

  /**
   * 保存到磁盘
   */
  private saveToDisk(): void {
    try {
      const dir = join(this.config.persistPath, "..");
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      const data = {
        cache: Array.from(this.cache.entries()),
        stats: this.stats
      };

      writeFileSync(this.config.persistPath, JSON.stringify(data, null, 2), "utf-8");
    } catch (error) {
      log.warn("Failed to save cache to disk:", error);
    }
  }

  /**
   * 从磁盘加载
   */
  private loadFromDisk(): void {
    try {
      if (!existsSync(this.config.persistPath)) {
        return;
      }

      const data = JSON.parse(readFileSync(this.config.persistPath, "utf-8"));
      this.cache = new Map(data.cache || []);
      this.stats = data.stats || { hits: 0, misses: 0 };

      // 清理过期条目
      this.cleanup();

      log.info(`Loaded cache from disk: ${this.cache.size} entries`);
    } catch (error) {
      log.warn("Failed to load cache from disk:", error);
    }
  }

  /**
   * 销毁缓存
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.clear();
  }
}

/**
 * 全局 LLM 缓存实例
 */
export const llmCache = new LLMCache<any>({
  maxSize: 500,
  ttl: 60 * 60 * 1000, // 1 hour
  persist: true
});

/**
 * 带缓存的 LLM 调用装饰器
 */
export function withCache<T extends (...args: any[]) => any>(
  fn: T,
  options?: { enabled?: boolean; keyPrefix?: string }
): T {
  const enabled = options?.enabled ?? true;

  return (async (...args: any[]) => {
    // 提取 prompt 和 systemMessage
    const prompt = args[0]?.prompt || JSON.stringify(args[0]);
    const systemMessage = args[0]?.systemMessage;

    if (!enabled) {
      return await fn(...args);
    }

    // 尝试从缓存获取
    const cached = llmCache.get(prompt, systemMessage);
    if (cached !== null) {
      log.debug("Cache hit:", { keyPrefix: options?.keyPrefix });
      return cached;
    }

    // 调用原函数
    const result = await fn(...args);

    // 存入缓存
    llmCache.set(prompt, result, systemMessage);

    return result;
  }) as T;
}
