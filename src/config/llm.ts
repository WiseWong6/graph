import { load, dump } from "js-yaml";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

export type ProviderType = "openai_compat" | "anthropic";

export interface LLMParams {
  [key: string]: unknown;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  top_k?: number;
}

export interface LLMOverrideConfig {
  params?: LLMParams;
  stream?: boolean;
  suppress_streaming?: boolean;
  thinking?: Record<string, unknown>;
  timeout?: number;
  base_url?: string;
}

export interface LLMProviderConfig {
  type: ProviderType;
  api_key_env: string;
  base_url?: string;
  defaults?: LLMOverrideConfig;
}

export interface LLMModelConfig {
  provider: string;
  model: string;
  name?: string;
  base_url?: string;
  defaults?: LLMOverrideConfig;
  capabilities?: {
    stream?: boolean;
    thinking?: boolean;
  };
}

export interface LLMNodeDefinition {
  model: string;
  overrides?: LLMOverrideConfig;
}

export interface PromptTemplates {
  [nodeId: string]: string;
}

export interface LLMConfig {
  defaults?: {
    model?: string;
  };
  providers: Record<string, LLMProviderConfig>;
  models: Record<string, LLMModelConfig>;
  nodes?: Record<string, LLMNodeDefinition>;
  prompts?: PromptTemplates;
}

export interface LLMSelection {
  selectedModel?: string;
  selectedModels?: Record<string, string>;
}

export interface LLMNodeConfig {
  provider: string;
  providerType: ProviderType;
  model: string;
  api_key_env: string;
  base_url?: string;
  params: LLMParams;
  max_tokens?: number;
  temperature?: number;
  timeout?: number;
  stream?: boolean;
  suppress_streaming?: boolean;
  thinking?: Record<string, unknown>;
}

export interface AvailableModel {
  id: string;
  name: string;
  provider: string;
  model: string;
  base_url?: string;
}

let configCache: LLMConfig | null = null;
const configPath = join(process.cwd(), "config", "llm.yaml");

function loadConfig(): LLMConfig {
  if (configCache) {
    return configCache;
  }

  const yamlContent = readFileSync(configPath, "utf-8");
  configCache = load(yamlContent) as LLMConfig;

  return configCache;
}

function mergeOverrides(...overrides: Array<LLMOverrideConfig | undefined>): LLMOverrideConfig {
  const merged: LLMOverrideConfig = {};

  for (const override of overrides) {
    if (!override) {
      continue;
    }

    if (override.params) {
      merged.params = {
        ...(merged.params || {}),
        ...override.params
      };
    }

    if (override.stream !== undefined) {
      merged.stream = override.stream;
    }

    if (override.suppress_streaming !== undefined) {
      merged.suppress_streaming = override.suppress_streaming;
    }

    if (override.thinking !== undefined) {
      merged.thinking = override.thinking;
    }

    if (override.timeout !== undefined) {
      merged.timeout = override.timeout;
    }

    if (override.base_url !== undefined) {
      merged.base_url = override.base_url;
    }
  }

  return merged;
}

function resolveSelectedModelId(nodeId: string, selection?: LLMSelection): string | undefined {
  if (!selection) {
    return undefined;
  }

  return selection.selectedModels?.[nodeId] || selection.selectedModel;
}

function resolveNodeModelId(nodeId: string, config: LLMConfig): string | undefined {
  return config.nodes?.[nodeId]?.model || config.defaults?.model;
}

export function resolveNodeLLMConfig(
  nodeId: string,
  selection?: LLMSelection
): { config: LLMNodeConfig; usedOverride: boolean } {
  const config = loadConfig();
  const nodeDefinition = config.nodes?.[nodeId];
  const defaultModelId = resolveNodeModelId(nodeId, config);
  const selectedModelId = resolveSelectedModelId(nodeId, selection);

  let modelId = selectedModelId || defaultModelId;
  if (!modelId) {
    throw new Error(`[LLMConfig] No model configured for node ${nodeId}`);
  }

  let modelConfig = config.models[modelId];
  if (!modelConfig) {
    if (selectedModelId && defaultModelId && config.models[defaultModelId]) {
      console.warn(
        `[LLMConfig] Model ${selectedModelId} not found for node ${nodeId}, ` +
        `falling back to ${defaultModelId}.`
      );
      modelId = defaultModelId;
      modelConfig = config.models[modelId];
    } else {
      throw new Error(`[LLMConfig] Model ${modelId} not found for node ${nodeId}`);
    }
  }

  if (!modelConfig) {
    throw new Error(`[LLMConfig] Model ${modelId} not found for node ${nodeId}`);
  }

  const providerConfig = config.providers[modelConfig.provider];
  if (!providerConfig) {
    throw new Error(
      `[LLMConfig] Provider ${modelConfig.provider} not found for model ${modelId}`
    );
  }

  const mergedOverrides = mergeOverrides(
    providerConfig.defaults,
    modelConfig.defaults,
    nodeDefinition?.overrides
  );

  const params = { ...(mergedOverrides.params || {}) };
  const resolvedConfig: LLMNodeConfig = {
    provider: modelConfig.provider,
    providerType: providerConfig.type,
    model: modelConfig.model,
    api_key_env: providerConfig.api_key_env,
    base_url: mergedOverrides.base_url || modelConfig.base_url || providerConfig.base_url,
    params,
    max_tokens: params.max_tokens,
    temperature: params.temperature,
    timeout: mergedOverrides.timeout,
    stream: mergedOverrides.stream,
    suppress_streaming: mergedOverrides.suppress_streaming,
    thinking: mergedOverrides.thinking
  };

  const usedOverride = !!selectedModelId && modelId !== defaultModelId;

  return { config: resolvedConfig, usedOverride };
}

export function getNodeLLMConfig(nodeId: string): LLMNodeConfig {
  return resolveNodeLLMConfig(nodeId).config;
}

export function getPromptTemplate(nodeId: string): string | undefined {
  const config = loadConfig();
  return config.prompts?.[nodeId];
}

export function getPromptTemplates(): PromptTemplates | undefined {
  const config = loadConfig();
  return config.prompts;
}

export function getAvailableNodes(): string[] {
  const config = loadConfig();
  return Object.keys(config.nodes || {});
}

export function getAvailableModels(): AvailableModel[] {
  const config = loadConfig();
  return Object.entries(config.models || {}).map(([id, model]) => ({
    id,
    name: model.name || model.model,
    provider: model.provider,
    model: model.model,
    base_url: model.base_url
  }));
}

export function getProviderConfig(providerId: string): LLMProviderConfig | undefined {
  const config = loadConfig();
  return config.providers?.[providerId];
}

export function getModelConfig(modelId: string): LLMModelConfig | undefined {
  const config = loadConfig();
  return config.models?.[modelId];
}

export function getNodeModelId(nodeId: string): string | undefined {
  const config = loadConfig();
  return resolveNodeModelId(nodeId, config);
}

export function clearConfigCache(): void {
  configCache = null;
}

export function updateConfig(mutator: (config: LLMConfig) => void): void {
  const config = loadConfig();
  mutator(config);
  const yaml = dump(config, { lineWidth: 120, noRefs: true });
  writeFileSync(configPath, yaml, "utf-8");
  configCache = config;
}
