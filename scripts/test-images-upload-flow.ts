/**
 * 测试 10_images → 11_upload 流程
 */

import { fullArticleGraph } from "../src/agents/article/graph.js";

async function testFlow() {
  console.log("=== Testing 10_images → 11_upload flow ===\n");

  const threadId = `test-images-${Date.now()}`;

  const result = await fullArticleGraph.invoke(
    {
      prompt: "测试图片生成和上传"
    },
    {
      configurable: { thread_id: threadId }
    }
  );

  console.log("\n=== Final State Keys ===");
  console.log(Object.keys(result));

  console.log("\n=== imagePaths ===");
  console.log(result.imagePaths);

  console.log("\n=== uploadedImageUrls ===");
  console.log(result.uploadedImageUrls);
}

testFlow().catch(console.error);
