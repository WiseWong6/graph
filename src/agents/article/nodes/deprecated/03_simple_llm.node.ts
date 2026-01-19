import { config } from "dotenv";
import { resolve } from "path";
import { ArticleState } from "../state";
import { getNodeLLMConfig } from "../../../config/llm.js";
import { LLMClient } from "../../../utils/llm-client.js";

// 加载 .env 文件
config({ path: resolve(process.cwd(), ".env") });

// 测试节点 3：使用创意输出配置
export async function simpleLlmNode3(state: ArticleState): Promise<Partial<ArticleState>> {
  console.log("[simple_llm_3] Generating with creative config...");
  
  const config = getNodeLLMConfig("simple_llm_3");
  console.log("[simple_llm_3] Model:", config.model, "temperature:", config.temperature);
  
  const client = new LLMClient(config);
  
  const response = await client.call({
    prompt: state.prompt + "\n\n（请用创意的方式，举一个生动的例子）",
    systemMessage: "你是一个创意写作专家，擅长用生动的比喻和例子解释概念。",
  });
  
  console.log("[simple_llm_3] Generated:", response.text.substring(0, 30) + "...");

  return {
    generatedText3: response.text  // 只写入自己的字段
  };
}
