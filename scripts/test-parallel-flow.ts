/**
 * 并行汇聚测试
 *
 * 验证 LangGraph 的并行汇聚是否正确处理状态合并
 */

import { Annotation, StateGraph } from "@langchain/langgraph";
import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite";
import { join } from "path";
import { mkdirSync, existsSync } from "fs";

// 定义 State
const TestAnnotation = Annotation.Root({
  value1: Annotation<string>(),
  value2: Annotation<string>(),
  value3: Annotation<string>(),  // 这个值由并行节点设置
});

type TestState = typeof TestAnnotation.State;

// 节点 A
async function nodeA(state: TestState): Promise<Partial<TestState>> {
  console.log("[nodeA] START");
  await sleep(1000);  // 模拟耗时操作
  console.log("[nodeA] END, returning { value1: 'A' }");
  return { value1: "A" };
}

// 节点 B（并行）
async function nodeB(state: TestState): Promise<Partial<TestState>> {
  console.log("[nodeB] START");
  await sleep(500);  // 比节点 A 快
  console.log("[nodeB] END, returning { value2: 'B' }");
  return { value2: "B" };
}

// 节点 C（并行，设置 value3）
async function nodeC(state: TestState): Promise<Partial<TestState>> {
  console.log("[nodeC] START");
  await sleep(800);  // 中等速度
  console.log("[nodeC] END, returning { value3: 'C' }");
  return { value3: "C" };
}

// 汇聚节点
async function mergeNode(state: TestState): Promise<Partial<TestState>> {
  console.log("[mergeNode] START");
  console.log("[mergeNode] value1:", state.value1);
  console.log("[mergeNode] value2:", state.value2);
  console.log("[mergeNode] value3:", state.value3);

  if (state.value3 === undefined) {
    console.error("[mergeNode] ERROR: value3 is UNDEFINED!");
    console.error("[mergeNode] This means nodeC's state was not merged!");
  } else {
    console.log("[mergeNode] SUCCESS: All values present");
  }

  console.log("[mergeNode] END");
  return {};
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 构建图
const checkpointDir = join(process.cwd(), "src", "checkpoints", "test");
if (!existsSync(checkpointDir)) {
  mkdirSync(checkpointDir, { recursive: true });
}

const checkpointer = SqliteSaver.fromConnString(
  join(checkpointDir, "test.db")
);

const testGraph = new StateGraph(TestAnnotation)
  .addNode("nodeA", nodeA)
  .addNode("nodeB", nodeB)
  .addNode("nodeC", nodeC)
  .addNode("merge", mergeNode)
  // START → nodeA
  .addEdge("__start__", "nodeA")
  // nodeA → nodeB 和 nodeC（并行）
  .addEdge("nodeA", "nodeB")
  .addEdge("nodeA", "nodeC")
  // nodeB 和 nodeC → merge（汇聚）
  .addEdge("nodeB", "merge")
  .addEdge("nodeC", "merge")
  .compile({ checkpointer });

async function main() {
  console.log("=== 并行汇聚测试 ===\n");

  const result = await testGraph.invoke(
    {},
    { configurable: { thread_id: "test-parallel-" + Date.now() } }
  );

  console.log("\n=== 最终结果 ===");
  console.log("value1:", result.value1);
  console.log("value2:", result.value2);
  console.log("value3:", result.value3);

  if (result.value3 === undefined) {
    console.error("\n❌ 测试失败：value3 未被设置");
    process.exit(1);
  } else {
    console.log("\n✅ 测试成功：所有值都正确设置");
  }
}

main().catch(console.error);
