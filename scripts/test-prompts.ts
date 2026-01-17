#!/usr/bin/env tsx
/**
 * Prompts 节点测试
 *
 * 测试五风格图片提示词生成
 */

import { promptsNode } from "../src/agents/article/nodes/10_prompts.node.js";
import { ArticleState, ImageStyle } from "../src/agents/article/state.js";
import { config } from "dotenv";
import { resolve } from "path";

// 加载环境变量
config({ path: resolve(process.cwd(), ".env") });

// ANSI 颜色
const colors = {
  reset: "\x1b[0m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  gray: "\x1b[90m",
  magenta: "\x1b[35m",
};

function print(color: keyof typeof colors, text: string) {
  process.stdout.write(`${colors[color]}${text}${colors.reset}`);
}

function printHeader(title: string) {
  console.clear();
  print("cyan", "\n╔═══════════════════════════════════════════════════════════════╗\n");
  print("cyan", `║${title.padEnd(63)}║\n`);
  print("cyan", "╚═══════════════════════════════════════════════════════════════╝\n\n");
}

/**
 * 模拟文章内容（不同风格）
 */
const MOCK_ARTICLES: Record<string, string> = {
  infographic: `
# 什么是 AI Agent？

AI Agent 是人工智能代理，它能够自主感知环境、做出决策并执行动作。

## 工作原理

1. **感知**: Agent 通过传感器获取环境信息
2. **决策**: 基于目标和规则选择最优行动
3. **执行**: 通过执行器改变环境状态

这个过程不断循环，使 Agent 能够持续学习和适应。

## 核心特征

- **自主性**: 无需人工干预即可运行
- **反应性**: 能及时响应环境变化
- **主动性**: 能主动采取行动实现目标
  `.trim(),

  healing: `
# 那些治愈我的瞬间

生活总是充满了意想不到的温暖。

## 雨天的咖啡店

窗外下着小雨，我坐在咖啡店的角落里。咖啡的热气袅袅上升，窗玻璃上凝结着细小的水珠。

突然，服务员端来了一块小蛋糕，说是店长送的。"看你坐了很久了，"她笑着说。

那一刻，心里某个柔软的地方被触动了。

## 晚归时的那盏灯

加班到深夜，拖着疲惫的身体回家。远远地，看到家里那盏灯还亮着。

推开门，桌上放着一杯温热的牛奶，还有一张便签："早点休息。"

简单的问候，却胜过千言万语。
  `.trim(),

  pixar: `
# 我的机器人朋友

我叫豆豆，是一个小小的机器人。

## 初次相遇

那天，我在公园里迷路了。正当我不知所措时，一个圆头圆脑的小机器人滑了过来。

"需要帮忙吗？"它的眼睛闪烁着蓝光，声音活泼又可爱。

就这样，我认识了机器人小绿。

## 一起冒险

小绿可以变形成各种形状：
- 变成滑板，带我飞驰
- 变成伞盖，为我遮雨
- 变成小船，与我在湖上泛舟

它总是充满活力，像个永远不会累的好朋友！
  `.trim(),

  sokamono: `
# 清晨的宁静

清晨五点，城市还在沉睡。

## 窗边的光

拉开窗帘，淡蓝色的天空泛着微微的晨光。我坐在窗边，手捧一杯温水，什么都不想，只是静静地看着。

楼下偶尔有早起的人走过，脚步轻盈，不忍打破这份宁静。

## 内心的平静

这样的时刻，不需要言语，不需要解释，只需要感受。

感受阳光慢慢爬上桌面，感受微风轻拂窗帘，感受内心的澄澈与平静。

这就是生活本来的样子。
  `.trim(),

  handdrawn: `
# 学习笔记：如何养成好习惯

养成一个好习惯，其实有方法可循。

## 习惯回路

习惯由三部分组成：

1. **暗示** - 触发行为的信号
2. **行为** - 实际做的动作
3. **奖励** - 得到的反馈

理解了这个回路，就能更好地设计自己的习惯。

## 实用技巧

- **从小处开始**: 每天只做一个俯卧撑
- **固定时间**: 同一时间做同样的事
- **记录追踪**: 打勾表很有用
- **原谅自己**: 断了一天没关系，继续就好

记住：重要的不是完美，而是持续。
  `.trim()
};

/**
 * 风格选项
 */
const STYLE_OPTIONS: Array<{ key: string; name: string; style: ImageStyle }> = [
  { key: "1", name: "扁平化科普图 (infographic)", style: "infographic" },
  { key: "2", name: "治愈系插画 (healing)", style: "healing" },
  { key: "3", name: "粗线条插画 (pixar)", style: "pixar" },
  { key: "4", name: "描边插画 (sokamono)", style: "sokamono" },
  { key: "5", name: "方格纸手绘 (handdrawn)", style: "handdrawn" },
  { key: "6", name: "测试所有风格", style: "all" as ImageStyle },
  { key: "0", name: "退出", style: "exit" as ImageStyle },
];

/**
 * 主菜单
 */
function printMenu() {
  print("cyan", "请选择要测试的风格:\n\n");
  for (const opt of STYLE_OPTIONS) {
    print("gray", `  ${opt.key}. `);
    print("green", `${opt.name}\n`);
  }
  print("gray", "\n> ");
}

/**
 * 运行单个风格测试
 */
async function testStyle(style: ImageStyle): Promise<boolean> {
  printHeader(`🎨 Prompts 节点测试 - ${style.toUpperCase()}`);

  const article = MOCK_ARTICLES[style] || MOCK_ARTICLES.infographic;
  const count = 3;

  print("yellow", "📄 文章内容:\n");
  print("gray", "─".repeat(60) + "\n");
  print("gray", article.substring(0, 200) + "...\n");
  print("gray", "─".repeat(60) + "\n\n");

  print("yellow", "⚙️ 测试配置:\n");
  print("gray", `  风格: ${style}\n`);
  print("gray", `  数量: ${count} 张\n`);
  print("gray", `  比例: 16:9 (公众号)\n\n`);

  print("magenta", "🔄 调用 promptsNode...\n\n");

  const startTime = Date.now();

  try {
    // 构建模拟状态
    const state: ArticleState = {
      prompt: "测试主题",
      topic: "测试",
      humanized: article,
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
          count,
          style,
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

    // 调用节点
    const result = await promptsNode(state);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    print("gray", "─".repeat(60) + "\n");
    print("green", `✅ 完成 (${duration}s)\n`);
    print("gray", "─".repeat(60) + "\n\n");

    // 显示生成的提示词
    if (result.imagePrompts && result.imagePrompts.length > 0) {
      print("cyan", "📝 生成的提示词:\n\n");

      result.imagePrompts.forEach((prompt, i) => {
        print("yellow", `[${i + 1}/${result.imagePrompts?.length}]\n`);
        print("gray", prompt + "\n\n");
      });

      // 检查颜色描述问题
      print("magenta", "🔍 颜色描述检查:\n");

      const hasIssue = result.imagePrompts.some(p => {
        const lower = p.toLowerCase();
        return (
          lower.includes("for correct") ||
          lower.includes("for success") ||
          lower.includes("for warning") ||
          lower.includes("for error") ||
          lower.includes("checkmark") ||
          lower.includes("warning label")
        );
      });

      if (hasIssue) {
        print("yellow", "  ⚠️ 发现潜在的颜色-文字关联问题\n");
      } else {
        print("green", "  ✅ 未发现功能性标签描述\n");
      }

      // 风格规范检查
      print("magenta", "\n🎭 风格规范检查:\n");

      const styleKeywords: Record<ImageStyle, string[]> = {
        infographic: ["flat vector", "white background", "thin-outline"],
        healing: ["warm pastel", "soft light", "healing"],
        pixar: ["pixar style", "sharpie", "bold lines"],
        sokamono: ["minimalist", "simple lines", "sokamono"],
        handdrawn: ["hand-drawn", "grid paper", "marker pen"]
      };

      const keywords = styleKeywords[style] || [];
      const foundKeywords = new Set<string>();

      result.imagePrompts.forEach(p => {
        const lower = p.toLowerCase();
        keywords.forEach(kw => {
          if (lower.includes(kw.toLowerCase())) {
            foundKeywords.add(kw);
          }
        });
      });

      if (foundKeywords.size > 0) {
        print("green", `  ✅ 包含风格关键词: ${Array.from(foundKeywords).join(", ")}\n`);
      } else {
        print("yellow", `  ⚠️ 未检测到风格关键词: ${keywords.join(", ")}\n`);
      }

    } else {
      print("yellow", "⚠️ 未生成提示词\n");
    }

    print("\n");
    print("gray", "按 Enter 继续...\n");

    await readLine();

    return true;

  } catch (error) {
    print("gray", "─".repeat(60) + "\n");
    print("yellow", `❌ 错误: ${error}\n`);
    print("gray", "─".repeat(60) + "\n\n");

    print("gray", "按 Enter 继续...\n");
    await readLine();

    return false;
  }
}

/**
 * 测试所有风格
 */
async function testAllStyles(): Promise<void> {
  printHeader("🎨 测试所有风格");

  const results: Record<string, boolean> = {};

  for (const opt of STYLE_OPTIONS) {
    if (opt.style === "all" || opt.style === "exit") continue;

    print("yellow", `\n正在测试: ${opt.name}...\n`);
    results[opt.style] = await testStyle(opt.style);
  }

  // 汇总结果
  printHeader("📊 测试结果汇总");

  for (const [style, success] of Object.entries(results)) {
    const icon = success ? "✅" : "❌";
    const name = STYLE_OPTIONS.find(o => o.style === style)?.name || style;
    print("gray", `  ${icon} ${name}\n`);
  }

  print("\n");
  print("gray", "按 Enter 返回主菜单...\n");
  await readLine();
}

/**
 * 读取一行输入
 */
async function readLine(): Promise<void> {
  const { createInterface } = await import("readline");
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  await new Promise<void>((resolve) => {
    rl.question("", () => {
      rl.close();
      resolve();
    });
  });
}

/**
 * 主循环
 */
async function main() {
  while (true) {
    printHeader("🎨 Prompts 节点测试");

    printMenu();

    const choice = await readLineSimple();

    if (!choice) continue;

    const selected = STYLE_OPTIONS.find(opt => opt.key === choice);

    if (!selected) {
      print("yellow", "\n❌ 无效选择，请重试\n");
      await new Promise(r => setTimeout(r, 1000));
      continue;
    }

    if (selected.style === "exit") {
      print("yellow", "\n👋 再见!\n");
      process.exit(0);
    }

    if (selected.style === "all") {
      await testAllStyles();
    } else {
      await testStyle(selected.style);
    }
  }
}

/**
 * 简单的行读取（不回显）
 */
async function readLineSimple(): Promise<string> {
  const { createInterface } = await import("readline");
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question("", (answer: string) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

main().catch(console.error);
