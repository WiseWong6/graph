import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite";
import { join } from "path";

// 1. 定义状态类型（使用 v1.0 新 API: Annotation.Root）
const HelloAnnotation = Annotation.Root({
  message: Annotation<string>(),
  step: Annotation<string>()
});

// 2. 定义节点函数
function greetNode(state: typeof HelloAnnotation.State) {
  console.log(`[greet] Processing: ${state.message}`);
  return {
    message: `Hello, ${state.message}!`,
    step: "greeted"
  };
}

function uppercaseNode(state: typeof HelloAnnotation.State) {
  console.log(`[uppercase] Converting to uppercase: ${state.message}`);
  return {
    message: state.message.toUpperCase(),
    step: "uppercased"
  };
}

// 3. 创建 CheckpointSaver
const checkpointDir = join(process.cwd(), "src", "checkpoints", "hello-world");
const checkpointer = SqliteSaver.fromConnString(join(checkpointDir, "checkpoints.db"));

// 4. 构建图
const workflow = new StateGraph(HelloAnnotation)
  .addNode("greet", greetNode)
  .addNode("uppercase", uppercaseNode)
  .addEdge(START, "greet")
  .addEdge("greet", "uppercase")
  .addEdge("uppercase", END);

// 5. 编译图（带 checkpointer）
export const graph = workflow.compile({ checkpointer });

// 6. 运行函数
export async function runHelloWorld(inputMessage: string) {
  console.log("=== Hello World Example ===");
  console.log(`Input: ${inputMessage}\n`);

  const config = { configurable: { thread_id: "hello-demo" } };

  const result = await graph.invoke(
    { message: inputMessage, step: "start" },
    config
  );

  console.log("\n=== Result ===");
  console.log(`Message: ${result.message}`);
  console.log(`Step: ${result.step}`);

  return result;
}

// 7. 直接运行（如果此文件被直接执行）
const isMain = import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`;

if (isMain) {
  const input = process.argv[2] || "World";
  runHelloWorld(input).catch(console.error);
}
