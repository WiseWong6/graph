/**
 * test-parallel-timing.ts
 *
 * 时间线分析脚本：验证 Article Graph 中的并行执行
 *
 * 功能：
 * 1. 运行完整流程
 * 2. 捕获每个节点的开始/结束时间
 * 3. 生成可视化时间线
 * 4. 验证并行加速效果
 */

import { fullArticleGraph } from "../src/agents/article/graph.js";
import { config } from "dotenv";
import { resolve } from "path";
import { existsSync, readFileSync } from "fs";

// 加载环境变量
config({ path: resolve(process.cwd(), ".env") });

// 节点信息
const NODE_INFO: Record<string, { name: string }> = {
  "gate_a_select_wechat": { name: "选择公众号" },
  "01_research": { name: "调研" },
  "02_rag": { name: "RAG检索" },
  "03_titles": { name: "生成标题" },
  "gate_c_select_title": { name: "选择标题" },
  "05_draft": { name: "起草" },
  "06_rewrite": { name: "智性重写" },
  "07_confirm": { name: "确认图片" },
  "08_humanize": { name: "去机械化" },
  "09_prompts": { name: "生图提示" },
  "10_images": { name: "生成图片" },
  "11_upload": { name: "上传图片" },
  "12_html": { name: "HTML转换" },
  "13_draftbox": { name: "发布草稿" },
  "end": { name: "结束" }
};

// 时间记录
interface TimingRecord {
  node: string;
  start: number;
  end: number;
  duration: number;
}

const timeline: Record<string, TimingRecord> = {};
const nodeStartTimes: Map<string, number> = new Map();

// 使用 streamEvents 捕获详细事件
async function runTimingAnalysis() {
  console.log("=".repeat(60));
  console.log("并行执行时间线分析");
  console.log("=".repeat(60));
  console.log("");

  // 检查是否有最近的主题
  const topic = "AI Agent 编程实战";  // 示例主题

  console.log(`主题: ${topic}`);
  console.log("");
  console.log("开始流程...");
  console.log("");

  const startTime = Date.now();

  try {
    // 使用 streamEvents 捕获所有事件
    const eventStream = await fullArticleGraph.streamEvents(
      { prompt: topic },
      {
        configurable: { thread_id: `timing-test-${Date.now()}` },
        version: "v2"
      }
    );

    for await (const event of eventStream) {
      const { event: eventType, name } = event;

      // 跳过非节点事件
      if (!name || name.startsWith("__")) continue;

      if (eventType === "on_chain_start") {
        nodeStartTimes.set(name, Date.now());
        const displayName = NODE_INFO[name]?.name || name;
        console.log(`▶️ ${displayName} - ${Date.now() - startTime}ms`);
      }

      if (eventType === "on_chain_end") {
        const start = nodeStartTimes.get(name) || Date.now();
        const end = Date.now();
        const duration = end - start;

        timeline[name] = {
          node: name,
          start,
          end,
          duration
        };

        const displayName = NODE_INFO[name]?.name || name;
        console.log(`✅ ${displayName} - 耗时 ${duration}ms`);
      }
    }

  } catch (error) {
    console.error("执行出错:", error);
  }

  const endTime = Date.now();
  const totalDuration = endTime - startTime;

  console.log("");
  console.log("=".repeat(60));
  console.log("时间线分析报告");
  console.log("=".repeat(60));
  console.log("");

  // 1. 总耗时
  console.log(`总耗时: ${totalDuration}ms (${(totalDuration / 1000).toFixed(1)}s)`);
  console.log("");

  // 2. 各节点耗时
  console.log("各节点耗时:");
  console.log("-".repeat(60));
  const sortedNodes = Object.values(timeline).sort((a, b) => a.start - b.start);

  for (const record of sortedNodes) {
    const displayName = NODE_INFO[record.node]?.name || record.node;
    const relativeStart = record.start - startTime;
    console.log(`${displayName.padEnd(15)} ${relativeStart.toString().padStart(5)}ms ──> ${record.duration}ms`);
  }
  console.log("");

  // 3. 并行检测
  console.log("并行执行检测:");
  console.log("-".repeat(60));

  const parallelPairs = [
    ["02_rag", "03_titles"],     // 第一层并行
    ["08_humanize", "09_prompts"] // 第二层并行
  ];

  for (const [node1, node2] of parallelPairs) {
    const record1 = timeline[node1];
    const record2 = timeline[node2];

    if (record1 && record2) {
      const name1 = NODE_INFO[node1]?.name || node1;
      const name2 = NODE_INFO[node2]?.name || node2;

      // 检查时间重叠
      const overlap = Math.max(
        0,
        Math.min(record1.end, record2.end) - Math.max(record1.start, record2.start)
      );

      const timeDiff = Math.abs(record1.start - record2.start);

      console.log(`${name1} + ${name2}:`);
      console.log(`  开始时间差: ${timeDiff}ms`);
      console.log(`  重叠时间: ${overlap}ms`);

      if (timeDiff < 100) {
        console.log(`  ✅ 并行确认 (几乎同时开始)`);
      } else {
        console.log(`  ❌ 未并行 (串行执行)`);
      }
      console.log("");
    }
  }

  // 4. 可视化时间线
  console.log("可视化时间线:");
  console.log("-".repeat(60));

  // 计算缩放比例
  const maxDuration = totalDuration;
  const scale = 50 / maxDuration;  // 50 字符宽度

  for (const record of sortedNodes) {
    const displayName = NODE_INFO[record.node]?.name || record.node;
    const relativeStart = record.start - startTime;
    const barLength = Math.max(1, Math.round(record.duration * scale));
    const offset = Math.round(relativeStart * scale);

    const bar = " ".repeat(offset) + "█".repeat(barLength);
    console.log(`${displayName.padEnd(15)} ${bar}`);
  }

  console.log("");
  console.log("图例:");
  console.log("  █ = 执行中");
  console.log("  (水平轴表示时间，垂直方向为并行节点)");
  console.log("");

  // 5. 性能评估
  console.log("性能评估:");
  console.log("-".repeat(60));

  // 计算串行执行时间（所有节点耗时之和）
  const serialTime = Object.values(timeline).reduce((sum, r) => sum + r.duration, 0);
  const parallelTime = totalDuration;

  console.log(`串行理论耗时: ${serialTime}ms (${(serialTime / 1000).toFixed(1)}s)`);
  console.log(`实际并行耗时: ${parallelTime}ms (${(parallelTime / 1000).toFixed(1)}s)`);

  const speedup = serialTime / parallelTime;
  console.log(`加速比: ${speedup.toFixed(2)}x`);

  const efficiency = (speedup / 2) * 100;  // 最大2倍并行（两个并行点）
  console.log(`并行效率: ${efficiency.toFixed(1)}%`);

  if (speedup > 1.3) {
    console.log("  ✅ 并行效果显著");
  } else if (speedup > 1.1) {
    console.log("  ⚠️  并行效果一般");
  } else {
    console.log("  ❌ 未检测到明显并行加速");
  }

  console.log("");
  console.log("=".repeat(60));
  console.log("分析完成");
  console.log("=".repeat(60));
}

// 运行分析
runTimingAnalysis().catch(console.error);
