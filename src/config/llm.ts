import { load } from "js-yaml";
import { readFileSync } from "fs";
import { join } from "path";

// LLM Provider 类型
export type LLMProvider = "anthropic" | "openai" | "deepseek";

// 单个节点的配置
export interface LLMNodeConfig {
  provider: LLMProvider;
  model: string;
  api_key_env?: string;
  base_url?: string;
  max_tokens?: number;
  temperature?: number;
  timeout?: number;
}

// 全局默认配置
export interface LLMDefaultConfig extends LLMNodeConfig {}

// Prompt 模板
export interface PromptTemplates {
  [nodeId: string]: string;
}

// 完整的 LLM 配置
export interface LLMConfig {
  credentials?: {
    prefix?: string;
  };
  models: {
    default: LLMDefaultConfig;
    nodes?: {
      [nodeId: string]: LLMNodeConfig;
    };
  };
  prompts?: PromptTemplates;
}

// 全局配置缓存
let configCache: LLMConfig | null = null;

// 加载配置文件
function loadConfig(): LLMConfig {
  if (configCache) {
    return configCache;
  }

  const configPath = join(process.cwd(), "config", "llm.yaml");
  const yamlContent = readFileSync(configPath, "utf-8");
  configCache = load(yamlContent) as LLMConfig;

  return configCache;
}

// 获取节点的 LLM 配置
export function getNodeLLMConfig(nodeId: string): LLMNodeConfig {
  const config = loadConfig();

  // 优先使用节点特定配置
  if (config.models.nodes && config.models.nodes[nodeId]) {
    const nodeConfig = config.models.nodes[nodeId] as any;

    // 提取 params 中的参数并合并到顶层
    const params = nodeConfig.params || {};
    const result: LLMNodeConfig = {
      provider: nodeConfig.provider,
      model: nodeConfig.model,
      api_key_env: nodeConfig.api_key_env,
      base_url: nodeConfig.base_url || config.models.default.base_url,
      max_tokens: params.max_tokens,
      temperature: params.temperature,
      timeout: params.timeout
    };

    return result;
  }

  // 降级到默认配置（也需要提取 params）
  const defaultConfig = config.models.default as any;
  const defaultParams = defaultConfig.params || {};
  return {
    provider: defaultConfig.provider,
    model: defaultConfig.model,
    api_key_env: defaultConfig.api_key_env,
    base_url: defaultConfig.base_url,
    max_tokens: defaultParams.max_tokens,
    temperature: defaultParams.temperature,
    timeout: defaultParams.timeout
  };
}

// 获取 Prompt 模板
export function getPromptTemplate(nodeId: string): string | undefined {
  const config = loadConfig();
  return config.prompts?.[nodeId];
}

// 获取所有可用的节点
export function getAvailableNodes(): string[] {
  const config = loadConfig();
  return Object.keys(config.models.nodes || {});
}

// 清除配置缓存（主要用于测试）
export function clearConfigCache(): void {
  configCache = null;
}
