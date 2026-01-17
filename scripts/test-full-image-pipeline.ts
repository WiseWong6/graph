/**
 * Complete image generation pipeline test (with OpenAI SDK)
 *
 * Flow: DeepSeek LLM generates prompts -> Ark API generates images
 */

import { promptsNode } from "../src/agents/article/nodes/10_prompts.node.js";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import OpenAI from "openai";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env") });

// ANSI colors
const colors = {
  reset: "\x1b[0m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  gray: "\x1b[90m",
  magenta: "\x1b[35m",
  red: "\x1b[31m",
};

function print(color: keyof typeof colors, text: string) {
  process.stdout.write(colors[color] + text + colors.reset);
}

/**
 * Ark API config
 */
interface ArkConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

function getArkConfig(): ArkConfig {
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

async function generateImage(
  prompt: string,
  config: ArkConfig,
  size: string = "2k"
): Promise<{ url: string } | { error: string }> {
  try {
    const client = new OpenAI({
      baseURL: config.baseUrl + "/api/v3",
      apiKey: config.apiKey
    });

    const response = await client.images.generate({
      model: config.model,
      prompt,
      size: size as any,  // Ark supports "2k"
      response_format: "url"
    });

    if (!response.data || response.data.length === 0 || !response.data[0].url) {
      return {
        error: "No image URL in response"
      };
    }

    return {
      url: response.data[0].url
    };
  } catch (error) {
    return {
      error: String(error)
    };
  }
}

interface TestStyle {
  name: string;
  style: string;
  article: string;
}

const TEST_STYLES: TestStyle[] = [
  {
    name: "Flat Infographic",
    style: "infographic",
    article: `
# What is AI Agent?

AI Agent is an artificial intelligence agent that can perceive environment, make decisions, and execute actions autonomously.

## How it works

1. **Perception**: Agent gets environment info through sensors
2. **Decision**: Choose optimal action based on goals and rules
3. **Execution**: Change environment state through actuators

This process loops continuously, enabling agents to learn and adapt.
    `.trim()
  },
  {
    name: "Hand-drawn Notebook",
    style: "handdrawn",
    article: `
# Learning Notes: How to Build Good Habits

Building good habits has a method.

## Habit Loop

Habits consist of three parts:

1. **Cue** - Signal that triggers behavior
2. **Routine** - The actual action
3. **Reward** - The feedback received

## Practical Tips

- **Start small**: Do just one push-up per day
- **Fixed time**: Do the same thing at the same time
- **Track progress**: Checkmarks work well
    `.trim()
  }
];

async function main() {
  print("cyan", "\n" + "=".repeat(60) + "\n");
  print("cyan", "  Full Image Pipeline Test - DeepSeek + Ark (OpenAI SDK)\n");
  print("cyan", "=".repeat(60) + "\n\n");

  // Check env vars
  print("yellow", "Checking environment variables...\n");
  const hasDeepSeekKey = !!process.env.DEEPSEEK_API_KEY;
  const hasArkKey = !!(process.env.ARK_API_KEY || process.env.VOLCENGINE_API_KEY);

  print("gray", "  DEEPSEEK_API_KEY: " + (hasDeepSeekKey ? "OK" : "MISSING") + "\n");
  print("gray", "  ARK_API_KEY: " + (hasArkKey ? "OK" : "MISSING") + "\n\n");

  if (!hasDeepSeekKey) {
    print("red", "ERROR: DEEPSEEK_API_KEY not set\n");
    print("gray", "Please set in .env file: DEEPSEEK_API_KEY=sk-...\n\n");
    return;
  }

  if (!hasArkKey) {
    print("red", "ERROR: ARK_API_KEY not set\n");
    print("gray", "Please set in .env file: ARK_API_KEY=your_key\n\n");
    return;
  }

  // Get Ark config
  const arkConfig = getArkConfig();
  print("gray", "Ark Model: " + arkConfig.model + "\n");
  print("gray", "Ark Base URL: " + arkConfig.baseUrl + "\n\n");

  // Create output dir
  const outputDir = join(process.cwd(), "output", "test-full-pipeline");
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  print("yellow", "Output directory: " + outputDir + "\n\n");

  // Test each style
  for (let i = 0; i < TEST_STYLES.length; i++) {
    const testStyle = TEST_STYLES[i];
    print("magenta", "=".repeat(60) + "\n");
    print("yellow", "Test " + (i + 1) + "/" + TEST_STYLES.length + ": " + testStyle.name + "\n");
    print("magenta", "=".repeat(60) + "\n\n");

    // Step 1: LLM generates prompts
    print("cyan", "Step 1/2: DeepSeek generates image prompts\n");
    print("gray", "-".repeat(60) + "\n");

    const { ArticleState } = await import("../src/agents/article/state.js");

    const state: any = {
      prompt: "test topic",
      topic: "test",
      humanized: testStyle.article,
      researchResult: "",
      ragContent: "",
      titles: [],
      draft: "",
      polished: "",
      rewritten: "",
      imagePrompts: [],
      imagePaths: [],
      uploadedImageUrls: [],
      htmlPath: "",
      decisions: {
        images: {
          confirmed: true,
          count: 2,
          style: testStyle.style,
          model: "doubao-seedream-4-5-251128",
          resolution: "2k"
        }
      },
      outputPath: "",
      status: "",
      runId: "",
      generatedText: "",
      generatedText2: "",
      generatedText3: "",
    };

    const promptStartTime = Date.now();

    try {
      const result = await promptsNode(state);
      const promptDuration = ((Date.now() - promptStartTime) / 1000).toFixed(2);

      if (!result.imagePrompts || result.imagePrompts.length === 0) {
        print("red", "FAILED - No prompts generated\n\n");
        continue;
      }

      print("green", "OK (" + promptDuration + "s)\n");
      print("gray", "Generated " + result.imagePrompts.length + " prompts\n\n");

      // Show generated prompts
      print("magenta", "Generated prompts:\n");
      for (let j = 0; j < result.imagePrompts.length; j++) {
        const prompt = result.imagePrompts[j];
        print("yellow", "\n[" + (j + 1) + "/" + result.imagePrompts.length + "] ");
        print("gray", prompt.substring(0, 100) + "...\n");
      }

      // Check color descriptions
      print("\n");
      print("magenta", "Color description check:\n");
      const colorIssues = result.imagePrompts.some(p => {
        const lower = p.toLowerCase();
        return (
          lower.includes("for correct") ||
          lower.includes("for success") ||
          lower.includes("for warning") ||
          lower.includes("for error")
        );
      });

      if (colorIssues) {
        print("yellow", "  WARNING: Found functional color descriptions\n");
      } else {
        print("green", "  OK: Color descriptions are decorative only\n");
      }

      // Step 2: Generate images
      print("\n");
      print("cyan", "Step 2/2: Ark generates images\n");
      print("gray", "-".repeat(60) + "\n");

      const imageStartTime = Date.now();
      const generatedImages: string[] = [];

      for (let j = 0; j < result.imagePrompts.length; j++) {
        const prompt = result.imagePrompts[j];
        print("yellow", "Generating image " + (j + 1) + "/" + result.imagePrompts.length + "...\n");

        const imgResult = await generateImage(prompt, arkConfig, "2k");

        if ("error" in imgResult) {
          print("red", "  FAILED: " + imgResult.error + "\n");
          continue;
        }

        if ("url" in imgResult) {
          // Download from URL
          const filename = join(outputDir, testStyle.style + "_" + (j + 1) + ".png");
          const imgResponse = await fetch(imgResult.url);
          const arrayBuffer = await imgResponse.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          writeFileSync(filename, buffer);
          generatedImages.push(filename);
          print("green", "  Saved: " + filename + "\n");
          print("gray", "  URL: " + imgResult.url.substring(0, 60) + "...\n");
        } else {
          print("red", "  FAILED: No URL in result\n");
        }

        if (j < result.imagePrompts.length - 1) {
          await new Promise(r => setTimeout(r, 500));
        }
      }

      const imageDuration = ((Date.now() - imageStartTime) / 1000).toFixed(2);

      print("\n");
      print("green", "Image generation complete (" + imageDuration + "s)\n");
      print("gray", "Success: " + generatedImages.length + "/" + result.imagePrompts.length + " images\n\n");

      // Save prompts to file
      const promptFile = join(outputDir, testStyle.style + "_prompts.txt");
      const promptContent = result.imagePrompts.map((p, idx) =>
        "=== Prompt " + (idx + 1) + " ===\n" + p + "\n"
      ).join("\n");
      writeFileSync(promptFile, promptContent);
      print("gray", "Prompts saved: " + promptFile + "\n\n");

    } catch (error) {
      print("red", "ERROR: " + String(error) + "\n\n");
    }
  }

  print("magenta", "=".repeat(60) + "\n");
  print("green", "All tests complete!\n");
  print("gray", "Check output: " + outputDir + "\n\n");
}

main().catch(console.error);
