/**
 * 测试嵌入模型是否可用
 */

import { HuggingFaceEmbedding } from "@llamaindex/huggingface";
import { env } from "@xenova/transformers";

// 配置本地模式
env.allowRemoteModels = false;
env.localModelPath = "/Users/wisewong/Library/Caches/@xenova/transformers/models";

async function test() {
  console.log("Testing HuggingFaceEmbedding with local mode...");
  console.log("Local model path:", env.localModelPath);
  console.log("Allow remote:", env.allowRemoteModels);

  try {
    const embedModel = new HuggingFaceEmbedding({
      modelType: "BAAI/bge-small-zh-v1.5"
    });

    console.log("Embedding model created");
    console.log("Testing embedding...");

    const result = await embedModel.getTextEmbeddings(["测试文本"]);
    console.log("✅ Embedding success!", result[0].length);

  } catch (error) {
    console.error("❌ Error:", error);
    console.error("Stack:", (error as any).stack);
  }
}

test();
