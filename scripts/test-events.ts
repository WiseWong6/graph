import { fullArticleGraph } from "../src/agents/article/graph.js";

async function test() {
  console.log("Testing streamEvents format...\n");

  const eventStream = await fullArticleGraph.streamEvents(
    { prompt: "test" },
    {
      configurable: { thread_id: `test-events-${Date.now()}` },
      version: "v2"
    }
  );

  let count = 0;
  for await (const event of eventStream) {
    if (count++ < 15) {
      console.log(`Event ${count}:`);
      console.log(`  event: ${(event as any).event}`);
      console.log(`  name: ${(event as any).name}`);
      console.log(`  data keys: ${(event as any).data ? Object.keys((event as any).data).join(', ') : 'none'}`);
      console.log();
    } else {
      break;
    }
  }

  console.log("Total events seen:", count);
}

test().catch(console.error);
