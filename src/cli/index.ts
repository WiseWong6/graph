import { Command } from "commander";

const program = new Command();

program
  .name("write-agent")
  .description("Article creation agent powered by LangGraph")
  .version("0.2.0");

// Hello World 命令
program
  .command("hello-world")
  .description("Run Hello World example")
  .option("-m, --message <string>", "Input message", "World")
  .action(async (options) => {
    const { runHelloWorld } = await import("../hello-world/graph.js");
    await runHelloWorld(options.message);
  });

// Agent 命令（MVP）
program
  .command("agent")
  .description("Run article creation agent (MVP)")
  .option("--prompt <string>", "Prompt for text generation")
  .option("--resume", "Resume from checkpoint")
  .option("--output <path>", "Output directory")
  .action(async (options) => {
    const { graph } = await import("../agents/article/graph.js");

    const config = {
      configurable: { thread_id: `agent-${Date.now()}` }
    };

    const result = await graph.invoke(
      { prompt: options.prompt || "写一段关于 AI 的介绍" },
      config
    );

    console.log("\n=== Final Result ===");
    console.log("Status:", result.status);
    console.log("Output:", result.outputPath);
  });

// 交互测试命令 (v2 新增)
program
  .command("test-interactive")
  .description("Test interactive gates (Gate A, B, C)")
  .option("--titles <string...>", "Title options for Gate C (comma-separated)")
  .action(async (options) => {
    const { interactiveGraph } = await import("../agents/article/graph.js");

    // 解析标题选项
    const titles = options.titles || [
      "Kubernetes 是什么？一文读懂容器编排",
      "从乐高乐园理解 Kubernetes：容器编排的魔法",
      "Kubernetes 入门指南：为什么你需要它"
    ];

    const config = {
      configurable: { thread_id: `test-interactive-${Date.now()}` }
    };

    console.log("=== 交互节点测试 ===");
    console.log(`Gate C 标题选项: ${titles.join(", ")}\n`);

    const result = await interactiveGraph.invoke(
      {
        prompt: "测试交互流程",
        titles,
        status: "starting"
      },
      config
    );

    console.log("\n=== 测试完成 ===");
    console.log("状态:", result.status);
    console.log("公众号:", result.decisions?.wechat?.account);
    console.log("图片配置:", result.decisions?.images);
    console.log("选中标题:", result.decisions?.selectedTitle);
  });

// 完整流程命令 (v2 新增)
program
  .command("full")
  .description("Run full article workflow (15 nodes)")
  .option("--prompt <string>", "Article topic/prompt (required)")
  .option("--resume", "Resume from checkpoint")
  .option("--output <path>", "Output directory")
  .action(async (options) => {
    if (!options.prompt) {
      console.error("错误: 必须提供 --prompt 参数");
      console.error("示例: npm run full -- --prompt '写一篇关于 AI Agent 的文章'");
      process.exit(1);
    }

    const { fullArticleGraph } = await import("../agents/article/graph.js");

    const config = {
      configurable: { thread_id: `full-article-${Date.now()}` }
    };

    console.log("=== 完整 Article Agent Workflow ===");
    console.log(`提示: ${options.prompt}\n`);

    const result = await fullArticleGraph.invoke(
      { prompt: options.prompt },
      config
    );

    console.log("\n=== 最终结果 ===");
    console.log("状态:", result.status);
    console.log("主题:", result.topic);
    console.log("选中标题:", result.decisions?.selectedTitle);
    console.log("输出目录:", result.outputPath);
  });

// 步进模式命令 (新增)
program
  .command("step")
  .description("Run step-by-step interactive workflow")
  .option("--prompt <string>", "Article topic/prompt")
  .option("--resume", "Resume from checkpoint")
  .action(async (_options) => {
    const { main } = await import("./step-cli.js");
    await main();
  });

program.parse();
