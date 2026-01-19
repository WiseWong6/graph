import { load } from "js-yaml";
import { readFileSync } from "fs";
import { join } from "path";

// LLM Provider 类型
export type LLMProvider = "anthropic" | "openai" | "deepseek" | "doubao";

// 单个节点的配置
export interface LLMNodeConfig {
  provider: LLMProvider;
  model: string;
  api_key_env?: string;
  base_url?: string;
  max_tokens?: number;
  temperature?: number;
  timeout?: number;
  stream?: boolean;
  thinking?: Record<string, unknown>;
}

// 全局默认配置
export interface LLMDefaultConfig extends LLMNodeConfig {}

// Prompt 模板
export interface PromptTemplates {
  [nodeId: string]: string;
}

// 可用模型配置（用于 CLI 选择）
export interface AvailableModel {
  id: string;
  name: string;
  provider: LLMProvider;
  model: string;
  base_url?: string;
}

// Provider 配置
export interface ProviderConfig {
  api_key_env: string;
  base_url?: string;
  stream?: boolean;
  thinking?: Record<string, unknown>;
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
  // 新增：可用模型列表
  available_models?: AvailableModel[];
  // 新增：Provider 配置
  providers?: Record<string, ProviderConfig>;
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
      timeout: params.timeout,
      stream: nodeConfig.stream ?? config.models.default.stream,
      thinking: nodeConfig.thinking ?? config.models.default.thinking
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
    timeout: defaultParams.timeout,
    stream: defaultConfig.stream,
    thinking: defaultConfig.thinking
  };
}

// 获取 Prompt 模板
export function getPromptTemplate(nodeId: string): string | undefined {
  const config = loadConfig();
  return config.prompts?.[nodeId];
}

// 获取所有 Prompt 模板
export function getPromptTemplates(): PromptTemplates | undefined {
  const config = loadConfig();
  return config.prompts;
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

// 获取可用模型列表
export function getAvailableModels(): AvailableModel[] {
  const config = loadConfig();
  return config.available_models || [];
}

// 获取 Provider 配置
export function getProviderConfig(provider: string): ProviderConfig | undefined {
  const config = loadConfig();
  return config.providers?.[provider];
}

// 获取模型配置（通过模型 ID）
export function getModelConfig(modelId: string): AvailableModel | undefined {
  const config = loadConfig();
  return config.available_models?.find(m => m.id === modelId);
}

/**
 * 获取动态 LLM 配置
 *
 * 优先使用用户选择的模型，降级到节点默认配置
 *
 * @param selectedModelId - 用户选择的模型 ID（来自 state.decisions.selectedModel）
 * @param nodeId - 节点名称（用于降级）
 * @returns LLMNodeConfig - 完整的 LLM 配置
 */
export function getDynamicLLMConfig(selectedModelId: string | undefined, nodeId: string): LLMNodeConfig {
  const nodeConfig = getNodeLLMConfig(nodeId);

  // 如果用户选择了模型
  if (selectedModelId) {
    const modelConfig = getModelConfig(selectedModelId);
    if (modelConfig) {
      // 获取 provider 配置
      const providerConfig = getProviderConfig(modelConfig.provider);
      return {
        ...nodeConfig,
        provider: modelConfig.provider,
        model: modelConfig.model,
        api_key_env: providerConfig?.api_key_env || nodeConfig.api_key_env,
        base_url: modelConfig.base_url || providerConfig?.base_url || nodeConfig.base_url,
        stream: providerConfig?.stream ?? nodeConfig.stream,
        thinking: providerConfig?.thinking ?? nodeConfig.thinking
      };
    }
    console.warn(`[LLMConfig] Model ${selectedModelId} not found, falling back to node ${nodeId} config`);
  }

  // 降级到节点默认配置
  return nodeConfig;
}
