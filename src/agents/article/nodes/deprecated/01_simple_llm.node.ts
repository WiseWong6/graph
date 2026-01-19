import { config } from "dotenv";
import { resolve } from "path";
import { ArticleState } from "../../state";
import { getNodeLLMConfig } from "../../../../config/llm.js";
import { LLMClient } from "../../../../utils/llm-client.js";

// 加载 .env 文件
config({ path: resolve(process.cwd(), ".env") });

// 节点函数：调用 LLM 生成文本
export async function simpleLlmNode(state: ArticleState): Promise<Partial<ArticleState>> {
  console.log("[simple_llm] Generating text for prompt:", state.prompt);
  
  // 获取节点配置
  const config = getNodeLLMConfig("simple_llm");
  console.log("[simple_llm] Using model:", config.model, "provider:", config.provider);
  
  // 创建 LLM 客户端
  const client = new LLMClient(config);
  
  // 调用 LLM
  const response = await client.call({
    prompt: state.prompt,
    systemMessage: "你是一个专业的文章作者，擅长写关于技术和科普的内容。",
  });
  
  console.log("[simple_llm] Generated text:", response.text.substring(0, 50) + "...");
  console.log("[simple_llm] Usage:", response.usage);
  
  return {
    generatedText: response.text
  };
}
