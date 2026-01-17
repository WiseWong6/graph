/**
 * 交互式图片生成验证
 *
 * 手动输入内容 → DeepSeek 生成提示词 → Ark API 生图
 *
 * 使用流程:
 * 1. 输入或粘贴文章内容
 * 2. 选择图片风格（5种）
 * 3. 输入图片数量
 * 4. 查看 DeepSeek 生成的提示词
 * 5. 确认后生成图片
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import OpenAI from "openai";
import { config } from "dotenv";
import { resolve } from "path";
import { createInterface } from "readline";

config({ path: resolve(process.cwd(), ".env") });

// ANSI 颜色
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
 * 五种风格定义
 */
const STYLES: Array<{ id: string; name: string; prefix: string }> = [
  {
    id: "infographic",
    name: "扁平化科普图",
    prefix: `Flat vector style, white background, simple thin-outline icons, single bright accent color. Minimal text: a large Chinese title + 3-4 ultra-short labels max. No gradients, no heavy shadows. Clean 16:9 horizontal layout.`
  },
  {
    id: "healing",
    name: "治愈系插画",
    prefix: `Warm pastel color, soft light, cozy healing illustration, clean lineart, gentle shading. Clean 16:9 horizontal layout.`
  },
  {
    id: "pixar",
    name: "粗线条插画",
    prefix: `Pixar style, sharpie illustration, bold lines and solid colors, simple details, minimalist, 3D cartoon style, vibrant colors. Cartoon, energetic, concise, childlike wonder. Clean 16:9 horizontal layout.`
  },
  {
    id: "sokamono",
    name: "描边插画",
    prefix: `Cartoon illustration, minimalist, simple and vivid lines, calm healing atmosphere, clean and fresh color, light blue background, style by sokamono. Clean 16:9 horizontal layout.`
  },
  {
    id: "handdrawn",
    name: "方格纸手绘",
    prefix: `Hand-drawn notebook style on grid paper, marker pen and ballpoint pen, light gray background with paper texture and grid lines, rough ink lines, uneven width 2px-4px, high saturation colors at 90% transparency for highlights and decorative elements only. Use bright green for positive accents, alert red for attention markers, calm blue for structural elements, warm yellow for emphasis. Clean 16:9 horizontal layout.`
  }
];

/**
 * 预设文章示例
 */
const SAMPLE_ARTICLES = {
  "1": "# AI Agent 入门\n\nAI Agent 是什么？\n\n人工智能代理（AI Agent）是一种能够自主感知环境、做出决策并执行动作的智能系统。",
  "2": "# 习惯养成技巧\n\n养成好习惯需要方法。\n\n## 习惯循环\n\n1. **提示** - 触发行为的信号\n2. **惯例** - 实际执行的动作\n3. **奖励** - 获得的反馈",
  "3": "# 学习笔记\n\n## 什么是深度学习？\n\n深度学习是机器学习的一个子领域，使用多层神经网络学习数据的表示。"
};

/**
 * 获取 Ark 配置
 */
function getArkConfig() {
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

/**
 * 使用 DeepSeek 生成图片提示词
 */
async function generatePromptsWithDeepSeek(
  content: string,
  style: typeof STYLES[0]["id"],
  count: number
): Promise<string[]> {
  print("cyan", "\n" + "=".repeat(60) + "\n");
  print("cyan", "  DeepSeek 生成图片提示词\n");
  print("cyan", "=".repeat(60) + "\n\n");

  // 使用 DeepSeek 生成提示词
  const styleObj = STYLES.find(s => s.id === style);
  const styleName = styleObj?.name || style;

  print("gray", "文章内容:\n");
  print("gray", content.substring(0, 300) + "...\n\n");

  print("gray", "图片风格: " + styleName + "\n");
  print("gray", "图片数量: " + count + "\n");
  print("gray", "正在调用 DeepSeek...\n\n");

  const startTime = Date.now();

  try {
    const client = new OpenAI({
      baseURL: "https://api.deepseek.com/v1",
      apiKey: process.env.DEEPSEEK_API_KEY
    });

    const response = await client.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content: `你是一个专业的配图设计师，擅长为文章创作配图提示词。

**当前风格**: ${styleName}
**风格规范**: ${styleObj?.prefix}

**提示词创作原则**:
1. 主体明确: 画面要表达什么?
2. 环境清晰: 背景和场景
3. 风格统一: 与其他配图协调
4. 色彩和谐: 符合情感基调

**颜色使用规范（重要）**:
- 颜色描述仅用于视觉装饰和高亮
- 禁止在提示词中描述带颜色的功能性标签文字
- 例如：不要写 "green checkmark" 或 "red warning label"
- 应该写： "green decorative arrow", "red accent line"

**负面约束**:
- no watermark, no logo, no random letters, no gibberish text
- avoid overcrowded layout, avoid messy typography

请直接输出 JSON 数组，每个元素包含:
- prompt: 英文图片提示词（包含完整的风格规范）
- style: 风格描述
- mood: 情感基调`
        },
        {
          role: "user",
          content: `请为以下文章生成 ${count} 个配图提示词。

文章内容:
${content}

要求:
- 每个提示词要包含完整的风格规范
- 提示词必须是英文
- 针对文章不同段落/主题生成不同的配图
- 输出 JSON 数组格式`
        }
      ],
      stream: false,
      temperature: 0.7
    });

    const text = response.choices[0].message?.content || "";
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    print("green", "✅ 提示词生成成功 (" + duration + "s)\n");

    // 解析 JSON
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    let prompts: string[] = [];

    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        prompts = parsed.map((p: any) => p.prompt).filter((p: string) => p.trim().length > 0);
      } catch {
        print("yellow", "  ⚠️ JSON 解析失败，尝试按行提取...\n");
        prompts = text.split("\n")
          .filter(line => line.trim().length > 10 && !line.startsWith("#"))
          .slice(0, count);
      }
    } else {
      prompts = text.split("\n")
        .filter(line => line.trim().length > 10 && !line.startsWith("#"))
        .slice(0, count);
    }

    print("gray", "生成 " + prompts.length + " 个提示词:\n");
    prompts.forEach((p, i) => {
      print("yellow", "\n[" + (i + 1) + "/" + prompts.length + "]\n");
      print("gray", p.substring(0, 150) + "...\n");
    });

    return prompts;

  } catch (error) {
    print("red", "❌ 提示词生成失败: " + String(error) + "\n");
    throw error;
  }
}

/**
 * 使用 Ark API 生成图片
 */
async function generateImagesWithArk(
  prompts: string[],
  styleName: string
): Promise<void> {
  print("\n");
  print("cyan", "=".repeat(60) + "\n");
  print("cyan", "  Ark API 生成图片\n");
  print("cyan", "=".repeat(60) + "\n\n");

  const config = getArkConfig();
  const outputDir = join(process.cwd(), "output", "interactive-test");

  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  print("gray", "图片风格: " + styleName + "\n");
  print("gray", "图片数量: " + prompts.length + "\n");
  print("gray", "Ark Model: " + config.model + "\n");
  print("gray", "输出目录: " + outputDir + "\n\n");

  const startTime = Date.now();

  try {
    const client = new OpenAI({
      baseURL: config.baseUrl + "/api/v3",
      apiKey: config.apiKey
    });

    let success = 0;

    for (let i = 0; i < prompts.length; i++) {
      const prompt = prompts[i];
      print("yellow", "生成图片 " + (i + 1) + "/" + prompts.length + "...\n");

      try {
        const response = await client.images.generate({
          model: config.model,
          prompt,
          size: "2k" as any,
          response_format: "url"
        });

        if (response.data && response.data[0] && response.data[0].url) {
          const filename = join(outputDir, styleName + "_" + (i + 1) + ".png");
          const imgResponse = await fetch(response.data[0].url);
          const arrayBuffer = await imgResponse.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          writeFileSync(filename, buffer);

          success++;
          print("green", "  ✅ 保存: " + filename + "\n");
          print("gray", "  URL: " + response.data[0].url.substring(0, 70) + "...\n");
        } else {
          print("red", "  ❌ 未返回图片 URL\n");
        }

        // 避免频率限制
        if (i < prompts.length - 1) {
          await new Promise(r => setTimeout(r, 500));
        }

      } catch (error) {
        print("red", "  ❌ 失败: " + String(error) + "\n");
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    print("\n");
    print("green", "✅ 图片生成完成 (" + duration + "s)\n");
    print("gray", "成功: " + success + "/" + prompts.length + " 张\n");
    print("gray", "查看输出: " + outputDir + "\n\n");

    // 保存提示词到文件
    const promptFile = join(outputDir, styleName + "_prompts.txt");
  const promptContent = prompts.map((p, idx) =>
    "=== 提示词 " + (idx + 1) + " ===\n" + p + "\n\n"
  ).join("===================================\n\n");
  writeFileSync(promptFile, promptContent);
  print("gray", "提示词已保存: " + promptFile + "\n");

  } catch (error) {
    print("red", "❌ 图片生成失败: " + String(error) + "\n");
  }
}

/**
 * 主函数
 */
async function main() {
  print("cyan", "\n╔═══════════════════════════════════════════════════════════════╗\n");
  print("cyan", "║       交互式图片生成验证 - DeepSeek + Ark                          ║\n");
  print("║       手动输入内容 → 生成提示词 → 生成图片                             ║\n");
  print("cyan", "╚═════════════════════════════════════════════════════════════╝\n\n");

  // 检查环境变量
  const hasDeepSeekKey = !!process.env.DEEPSEEK_API_KEY;
  const hasArkKey = !!(process.env.ARK_API_KEY || process.env.VOLCENGINE_API_KEY);

  print("yellow", "环境检查:\n");
  print("gray", "  DEEPSEEK_API_KEY: " + (hasDeepSeekKey ? "✅" : "❌ 未设置") + "\n");
  print("gray", "  ARK_API_KEY: " + (hasArkKey ? "✅" : "❌ 未设置") + "\n\n");

  if (!hasDeepSeekKey) {
    print("red", "❌ 缺少 DEEPSEEK_API_KEY\n");
    print("gray", "请在 .env 文件中设置: DEEPSEEK_API_KEY=sk-...\n");
    process.exit(1);
  }

  if (!hasArkKey) {
    print("red", "❌ 缺少 ARK_API_KEY\n");
    print("gray", "请在 .env 文件中设置: ARK_API_KEY=your_key\n");
    process.exit(1);
  }

  // ========== 步骤 1: 输入文章内容 ==========
  print("magenta", "═══════════════════════════════════════════════════════════════╗\n");
  print("magenta", "║ 步骤 1: 输入文章内容                                               ║\n");
  print("magenta", "═══════════════════════════════════════════════════════════════╗\n\n");

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const content = await new Promise<string>((resolve) => {
    rl.question(
      "请输入文章内容（输入 'demo' 使用预设内容）:\n\n",
      (answer: string) => resolve(answer.trim())
    );
  });

  let finalContent = content;

  // 如果输入 demo，使用预设内容
  if (content.toLowerCase() === "demo") {
    print("\n");
    print("yellow", "请选择预设内容:\n");
    print("gray", "  1. AI Agent 入门\n");
    print("gray", "  2. 习惯养成技巧\n");
    print("gray", "  3. 学习笔记\n");

    const choice = await new Promise<string>((resolve) => {
      rl.question("\n请选择 (1-3): ", (answer: string) => resolve(answer.trim()));
    });

    if (choice === "1" || choice === "2" || choice === "3") {
      finalContent = SAMPLE_ARTICLES[choice];
      print("\n");
      print("gray", "已选择: " + finalContent.substring(0, 50) + "...\n\n");
    } else {
      print("\n");
      print("red", "无效选择，使用预设内容 1\n");
      finalContent = SAMPLE_ARTICLES["1"];
    }
  } else {
    print("\n");
    print("gray", "文章内容预览:\n");
    print("gray", "─".repeat(60) + "\n");
    print("gray", finalContent.substring(0, 500) + "...\n\n");
  }

  // ========== 步骤 2: 选择图片风格 ==========
  print("magenta", "═══════════════════════════════════════════════════════════════╗\n");
  print("magenta", "║ 步骤 2: 选择图片风格                                               ║\n");
  print("magenta", "═══════════════════════════════════════════════════════════════╗\n\n");

  print("yellow", "请选择图片风格:\n");

  for (let i = 0; i < STYLES.length; i++) {
    print("  " + (i + 1) + ". " + STYLES[i].name + "\n");
  }

  const styleChoice = await new Promise<string>((resolve) => {
    rl.question("\n请选择风格 (1-5): ", (answer: string) => resolve(answer.trim()));
  });

  const selectedStyle = STYLES[parseInt(styleChoice) - 1];

  print("\n");
  print("gray", "已选择: " + selectedStyle.name + "\n");
  print("gray", "风格规范:\n");
  print("gray", "─".repeat(60) + "\n");
  print("gray", selectedStyle.prefix + "\n");
  print("gray", "─".repeat(60) + "\n\n");

  // ========== 步骤 3: 输入图片数量 ==========
  print("magenta", "═══════════════════════════════════════════════════════════════╗\n");
  print("magenta", "║ 步骤 3: 输入图片数量                                               ║\n");
  print("magenta", "═══════════════════════════════════════════════════════════════╗\n\n");

  const countChoice = await new Promise<string>((resolve) => {
    rl.question("请输入图片数量 (1-10): ", (answer: string) => resolve(answer.trim()));
  });

  const count = Math.min(Math.max(parseInt(countChoice, 1), 10));

  print("\n");
  print("gray", "图片数量: " + count + "\n\n");

  // ========== 步骤 4: DeepSeek 生成提示词 ==========
  const prompts = await generatePromptsWithDeepSeek(finalContent, selectedStyle.id, count);

  // ========== 步骤 5: 确认并生成图片 ==========
  print("\n");
  print("magenta", "═══════════════════════════════════════════════════════════════╗\n");
  print("magenta", "║ 步骤 4/5: 确认并生成图片                                       ║\n");
  print("magenta", "═══════════════════════════════════════════════════════════════╗\n\n");

  print("gray", "检查提示词...\n");

  // 检查颜色描述
  const colorIssues = prompts.some(p => {
    const lower = p.toLowerCase();
    return (
      lower.includes("for correct") ||
      lower.includes("for success") ||
      lower.includes("for warning") ||
      lower.includes("for error")
    );
  });

  if (colorIssues) {
    print("yellow", "  ⚠️ 检测到功能性颜色描述（可能导致生成文字标签）\n");
  } else {
    print("green", "  ✅ 颜色描述正确（纯装饰性）\n");
  }

  const confirm = await new Promise<boolean>((resolve) => {
    rl.question("\n确认生成图片? (y/n): ", (answer: string) => {
      resolve(answer.trim().toLowerCase() === "y");
    });
  });

  if (!confirm) {
    print("\n");
    print("yellow", "已取消\n");
    print("gray", "提示词已保存，可手动复制到其他工具使用\n");
    return;
  }

  // 生成图片
  await generateImagesWithArk(prompts, selectedStyle.name);

  print("\n");
  print("magenta", "═══════════════════════════════════════════════════════════════╗\n");
  print("magenta", "║ 完成                                                         ║\n");
  print("magenta", "═══════════════════════════════════════════════════════════════╗\n\n");

  rl.close();
}

main().catch(console.error);
