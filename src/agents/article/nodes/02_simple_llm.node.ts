import { config } from "dotenv";
import { resolve } from "path";
import { ArticleState } from "../state";
import { getNodeLLMConfig } from "../../../config/llm.js";
import { LLMClient } from "../../../utils/llm-client.js";

// 加载 .env 文件
config({ path: resolve(process.cwd(), ".env") });

// 测试节点 2：使用快速响应配置
export async function simpleLlmNode2(state: ArticleState): Promise<Partial<ArticleState>> {
  console.log("[simple_llm_2] Generating with fast config...");
  
  const config = getNodeLLMConfig("simple_llm_2");
  console.log("[simple_llm_2] Model:", config.model, "temperature:", config.temperature);
  
  const client = new LLMClient(config);
  
  const response = await client.call({
    prompt: state.prompt + "\n\n（请用更简洁的方式回答，不超过200字）",
    systemMessage: "你是一个简洁的专家，擅长用简短的语言解释复杂概念。",
  });
  
  console.log("[simple_llm_2] Generated:", response.text.substring(0, 30) + "...");

  return {
    generatedText2: response.text  // 只写入自己的字段
  };
}
