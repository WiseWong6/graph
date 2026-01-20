/**
 * 个人写作库检索 API
 *
 * 职责：
 * 1. 调用 IndexManager 检索个人写作库
 * 2. 去重和截断处理
 * 3. 降级处理（失败时返回空结果）
 */

import IndexManager from "../index/index-manager.js";
import type { PersonalChunkNode, RetrievePersonalOptions } from "../index/schema.js";
import { createHash } from "crypto";

const HASH_SET_SIZE_LIMIT = 1000;

export interface PersonalRAGResult {
  content: string;
  voice: string;
  stats: {
    contentCount: number;
    voiceCount: number;
    retrievalTime: number;
    fallback: boolean;
  };
}

function deduplicateChunks(chunks: PersonalChunkNode[]): PersonalChunkNode[] {
  const seen = new Set<string>();
  const result: PersonalChunkNode[] = [];

  for (const chunk of chunks) {
    const hash = createHash("md5").update(chunk.text).digest("hex");
    if (!seen.has(hash)) {
      seen.add(hash);
      result.push(chunk);
      if (seen.size > HASH_SET_SIZE_LIMIT) {
        seen.clear();
      }
    }
  }

  return result;
}

function formatChunks(chunks: PersonalChunkNode[]): string {
  if (chunks.length === 0) return "(无)";

  return chunks
    .map(c => {
      const meta = c.metadata;
      const parts = [];

      if (meta.section_path) {
        parts.push(`【${meta.section_path}】`);
      }

      parts.push(c.text);

      if (c.score !== undefined && c.score > 0) {
        parts.push(`(相似度: ${(c.score * 100).toFixed(0)}%)`);
      }

      return parts.join(" ");
    })
    .join("\n\n");
}

export async function retrievePersonalRAG(
  query: string,
  options?: RetrievePersonalOptions
): Promise<PersonalRAGResult> {
  const startTime = Date.now();
  const fallbackResult: PersonalRAGResult = {
    content: "(无)",
    voice: "(无)",
    stats: {
      contentCount: 0,
      voiceCount: 0,
      retrievalTime: Date.now() - startTime,
      fallback: true
    }
  };

  if (!query || query.trim().length < 3) {
    console.warn("[personal-rag] ⚠️ 查询文本太短，返回空结果");
    return fallbackResult;
  }

  try {
    const manager = IndexManager.getInstance();
    const result = await manager.retrievePersonalRAG(query, options);

    const dedupContent = deduplicateChunks(result.content);
    const dedupVoice = deduplicateChunks(result.voice);

    const elapsed = Date.now() - startTime;

    const stats: PersonalRAGResult["stats"] = {
      contentCount: dedupContent.length,
      voiceCount: dedupVoice.length,
      retrievalTime: elapsed,
      fallback: false
    };

    const contentText = formatChunks(dedupContent);
    const voiceText = formatChunks(dedupVoice);

    console.log(`[personal-rag] 检索完成: content=${stats.contentCount}, voice=${stats.voiceCount}, 耗时=${elapsed}ms`);

    return {
      content: contentText,
      voice: voiceText,
      stats
    };
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(`[personal-rag] ❌ 检索失败: ${error}`);
    console.warn(`[personal-rag] 降级返回空结果 (耗时: ${elapsed}ms)`);

    return {
      content: "(无)",
      voice: "(无)",
      stats: {
        contentCount: 0,
        voiceCount: 0,
        retrievalTime: elapsed,
        fallback: true
      }
    };
  }
}
