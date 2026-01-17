/**
 * 测试图片生成（使用 OpenAI SDK）
 *
 * 使用火山 Ark API 生成测试图片
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import OpenAI from "openai";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env") });

interface ArkConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

async function getArkConfig(): Promise<ArkConfig> {
  const apiKey = process.env.ARK_API_KEY || process.env.VOLCENGINE_API_KEY;
  if (!apiKey) {
    throw new Error("ARK_API_KEY or VOLCENGINE_API_KEY not set");
  }

  return {
    apiKey,
    baseUrl: process.env.ARK_BASE_URL || "https://ark.cn-beijing.volces.com",
    model: process.env.ARK_MODEL || "doubao-seedream-4-5-251128"
  };
}

async function generateImage(prompt: string, config: ArkConfig, size: string = "1024x768") {
  const client = new OpenAI({
    baseURL: config.baseUrl + "/api/v3",
    apiKey: config.apiKey
  });

  const response = await client.images.generate({
    model: config.model,
    prompt,
    size,
    response_format: "url",
    extra_body: {
      watermark: false,
      stream: false
    }
  });

  return {
    url: response.data[0].url
  };
}

async function test() {
  console.log("🎨 Testing Ark Image Generation (with OpenAI SDK)...\n");

  try {
    const config = await getArkConfig();
    console.log("Config:", { model: config.model, baseUrl: config.baseUrl });

    // 测试提示词
    const prompts = [
      "一只可爱的猫咪在阳光下玩耍，温暖的色调，插画风格",
      "科技感的城市夜景，霓虹灯，赛博朋克风格，16:9"
    ];

    // 创建输出目录
    const outputDir = join(process.cwd(), "output", "test-images");
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    console.log(`\nGenerating ${prompts.length} images...\n`);

    for (let i = 0; i < prompts.length; i++) {
      const prompt = prompts[i];
      console.log(`[${i + 1}/${prompts.length}] Prompt: "${prompt}"`);

      try {
        const size = "2k";  // 使用 "2k" 而不是自定义尺寸
        const result = await generateImage(prompt, config, size);

        // 从 URL 下载图片
        const filename = join(outputDir, `test_${i + 1}.png`);
        const imgResponse = await fetch(result.url);
        const arrayBuffer = await imgResponse.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        writeFileSync(filename, buffer);
        console.log(`   ✅ Saved: ${filename}`);
        console.log(`   URL: ${result.url}`);

        // 避免频率限制
        if (i < prompts.length - 1) {
          await new Promise(r => setTimeout(r, 500));
        }
      } catch (error) {
        console.error(`   ❌ Error: ${error}`);
      }
    }

    console.log("\n✅ Test complete!");
    console.log(`📁 Output: ${outputDir}`);

  } catch (error) {
    console.error("\n❌ Test failed:", error);
    process.exit(1);
  }
}

test();
