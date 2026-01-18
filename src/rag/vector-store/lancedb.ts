import {
  BaseVectorStore,
  VectorStoreQuery,
  VectorStoreQueryResult,
  BaseNode,
  MetadataMode
} from "llamaindex";
import * as lancedb from "@lancedb/lancedb";
import { existsSync, mkdirSync } from "fs";

// 定义 LanceDB 表结构
interface LanceDBRecord {
  id: string;
  vector: number[];
  text: string;
  metadata: string; // JSON stringified metadata
  node_id: string;
  ref_doc_id: string;
}

/**
 * LanceDB 向量存储适配器
 *
 * 实现了 LlamaIndex 的 BaseVectorStore 接口，使用 LanceDB 作为底层存储。
 * 解决了 SimpleVectorStore 在大数据量下的内存限制问题。
 */
export class LanceDBVectorStore extends BaseVectorStore {
  storesText: boolean = true;
  private db: lancedb.Connection | null = null;
  private table: lancedb.Table | null = null;
  private uri: string;
  private tableName: string;

  constructor(init: { uri: string; tableName?: string }) {
    // @ts-ignore - LanceDB 使用不同的参数结构
    super(init);
    this.uri = init.uri;
    this.tableName = init.tableName || "vectors";
  }

  /**
   * 初始化数据库连接和表
   */
  async init() {
    if (this.db) return;

    // 确保目录存在
    if (!existsSync(this.uri)) {
      mkdirSync(this.uri, { recursive: true });
    }

    this.db = await lancedb.connect(this.uri);

    // 检查表是否存在，不存在则创建
    const tableNames = await this.db.tableNames();
    if (!tableNames.includes(this.tableName)) {
      // 创建空表结构
      // 注意：LanceDB 需要至少一条数据来推断 schema，或者显式定义 schema
      // 这里我们推迟到第一次 add 时创建，或者先创建一个空表如果支持
      // 实际上 LanceDB Node.js API 允许 createTable 传入空数据 + schema，但比较麻烦
      // 我们可以先不创建，在 add 时检查
    } else {
      this.table = await this.db.openTable(this.tableName);
    }
  }

  client() {
    return this.db;
  }

  /**
   * 添加节点到向量存储
   */
  async add(nodes: BaseNode[]): Promise<string[]> {
    await this.init();

    if (!nodes || nodes.length === 0) {
      return [];
    }

    const records: LanceDBRecord[] = nodes.map((node) => {
      // 优先获取原始文本内容
      // 策略：metadata.content > (node as any).text > node.getContent(MetadataMode.NONE)
      let textContent = "";

      // 1. 优先从 metadata 中获取原始 content（如果 build-indices.ts 保留了）
      if (node.metadata?.content && typeof node.metadata.content === "string") {
        textContent = node.metadata.content;
      }
      // 2. 否则尝试 node.text
      else if ((node as any).text) {
        textContent = (node as any).text;
      }
      // 3. 最后使用 NONE 模式获取纯文本（不含 metadata）
      else {
        const content = node.getContent(MetadataMode.NONE);
        textContent = typeof content === "string" ? content : String(content);
      }

      return {
        id: node.id_,
        vector: node.getEmbedding(),
        text: textContent,
        metadata: JSON.stringify(node.metadata),
        node_id: node.id_,
        ref_doc_id: node.sourceNode?.nodeId || node.id_
      };
    });

    if (!this.table) {
      const tableNames = await this.db!.tableNames();
      if (tableNames.includes(this.tableName)) {
        this.table = await this.db!.openTable(this.tableName);
        // @ts-ignore - LanceDB 类型定义不匹配
        await this.table.add(records as any);
      } else {
        // @ts-ignore - LanceDB 类型定义不匹配
        this.table = await this.db!.createTable(this.tableName, records as any);
      }
    } else {
      // @ts-ignore - LanceDB 类型定义不匹配
      await this.table.add(records as any);
    }

    return nodes.map((node) => node.id_);
  }

  /**
   * 删除节点
   */
  async delete(refDocId: string): Promise<void> {
    await this.init();
    if (!this.table) return;

    await this.table.delete(`ref_doc_id = '${refDocId}'`);
  }

  /**
   * 查询
   */
  async query(query: VectorStoreQuery): Promise<VectorStoreQueryResult> {
    await this.init();
    if (!this.table) {
      return { nodes: [], similarities: [], ids: [] };
    }

    // 构建查询
    const builder = this.table.search(query.queryEmbedding!);

    // 过滤条件 (简单的 metadata 过滤)
    let queryBuilder = builder;
    if (query.docIds && query.docIds.length > 0) {
      const idList = query.docIds.map(id => `'${id}'`).join(",");
      queryBuilder = (queryBuilder as any).where(`node_id IN (${idList})`);
    }

    // 使用 toArray() 获取结果（比 execute() 更稳定）
    // 显式选择需要的字段
    const results = await (queryBuilder as any)
      .select(["id", "vector", "text", "metadata", "node_id", "ref_doc_id", "_distance"])
      .limit(query.similarityTopK)
      .toArray();

    const nodes: BaseNode[] = [];
    const similarities: number[] = [];
    const ids: string[] = [];

    for (const row of results) {
      // 还原 Node - 安全解析 metadata
      let metadata: any = {};
      const metadataStr = (row as any).metadata as string;

      if (metadataStr && metadataStr !== "undefined" && metadataStr !== "null") {
        try {
          metadata = JSON.parse(metadataStr);
        } catch (e) {
          console.warn(`[LanceDB] 解析 metadata 失败: ${e}, 使用空对象`);
          metadata = {};
        }
      }

      // 这里的 row 包含 _distance (L2 distance)
      // 转换为 similarity: 1 / (1 + distance)
      const distance = (row as any)._distance;
      const similarity = 1 / (1 + distance);

      ids.push((row as any).node_id as string);
      similarities.push(similarity);

      // 获取文本内容
      const textContent = (row as any).text || "";

      // 构造 Node 对象
      const node = {
        id_: (row as any).node_id as string,
        text: textContent,
        metadata: metadata,
        getContent: () => textContent,
        getEmbedding: () => (row as any).vector as number[],
      } as any;

      nodes.push(node);
    }

    return {
      nodes,
      similarities,
      ids
    };
  }

  /**
   * 获取所有已存储的文档 ID
   * 用于去重
   */
  async getAllIds(): Promise<string[]> {
    await this.init();
    if (!this.table) return [];

    try {
      // LanceDB Node.js API query().execute() 返回的是一个数组 (Array<Record<string, any>>) 
      // 或者在某些版本是迭代器。根据 @lancedb/lancedb 的类型定义调整。
      // 这里的 .limit() 是必需的吗？如果太大可能会爆内存。
      // 但对于 10万级数据，只取 ID 字段应该没问题。
      
      const results = await this.table.query().select(["node_id"]).limit(1000000).toArray();
      
      return results.map((r: any) => r.node_id as string);
    } catch (e) {
      console.warn("无法从 LanceDB 获取 ID列表:", e);
      return [];
    }
  }

  async getAllRefDocIds(): Promise<string[]> {
    await this.init();
    if (!this.table) return [];

    try {
      const results = await this.table.query().select(["ref_doc_id"]).limit(1000000).toArray();
      const ids = new Set<string>();
      for (const r of results as any[]) {
        const id = r?.ref_doc_id;
        if (typeof id === "string" && id.length > 0) ids.add(id);
      }
      return Array.from(ids);
    } catch (e) {
      console.warn("无法从 LanceDB 获取 ref_doc_id 列表:", e);
      return [];
    }
  }

  /**
   * 持久化 (空操作，因为 LanceDB 是即时写入)
   */
  async persist(): Promise<void> {
    // no-op - LanceDB automatically persists
  }
}
