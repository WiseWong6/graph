#!/usr/bin/env tsx
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { load, dump } from "js-yaml";

type AnyRecord = Record<string, any>;

interface OldModelConfig {
  provider?: string;
  model?: string;
  api_key_env?: string;
  base_url?: string;
  params?: Record<string, any>;
  stream?: boolean;
  suppress_streaming?: boolean;
  thinking?: Record<string, unknown>;
  timeout?: number;
}

interface OldConfig {
  credentials?: AnyRecord;
  available_models?: Array<{
    id: string;
    name?: string;
    provider: string;
    model: string;
    base_url?: string;
  }>;
  providers?: Record<string, AnyRecord>;
  models?: {
    default?: OldModelConfig;
    nodes?: Record<string, OldModelConfig>;
  };
  prompts?: Record<string, string>;
}

interface NewConfig {
  defaults?: { model?: string };
  providers: Record<string, AnyRecord>;
  models: Record<string, AnyRecord>;
  nodes?: Record<string, AnyRecord>;
  prompts?: Record<string, string>;
}

function parseArgs(argv: string[]) {
  const args = [...argv];
  const result: { input?: string; output?: string } = {};

  while (args.length > 0) {
    const token = args.shift();
    if (!token) break;
    if (token === "--input" && args[0]) {
      result.input = args.shift();
      continue;
    }
    if (token === "--output" && args[0]) {
      result.output = args.shift();
      continue;
    }
  }

  return result;
}

function isOldSchema(config: AnyRecord): boolean {
  return !!config?.models?.default || !!config?.available_models;
}

function normalizeId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function ensureIdUnique(baseId: string, used: Set<string>): string {
  let id = baseId;
  let counter = 2;
  while (used.has(id)) {
    id = `${baseId}-${counter}`;
    counter += 1;
  }
  used.add(id);
  return id;
}

function mergeOverride(target: AnyRecord, source?: AnyRecord) {
  if (!source) return;
  if (source.params) {
    target.params = { ...(target.params || {}), ...source.params };
  }
  if (source.stream !== undefined) {
    target.stream = source.stream;
  }
  if (source.suppress_streaming !== undefined) {
    target.suppress_streaming = source.suppress_streaming;
  }
  if (source.thinking !== undefined) {
    target.thinking = source.thinking;
  }
  if (source.timeout !== undefined) {
    target.timeout = source.timeout;
  }
}

function compactOverrides(override?: AnyRecord) {
  if (!override) return undefined;
  if (override.params && Object.keys(override.params).length === 0) {
    delete override.params;
  }
  return Object.keys(override).length === 0 ? undefined : override;
}

function migrate(oldConfig: OldConfig): { config: NewConfig; warnings: string[] } {
  const warnings: string[] = [];
  const providers: Record<string, AnyRecord> = {};
  const models: Record<string, AnyRecord> = {};
  const nodes: Record<string, AnyRecord> = {};
  const usedModelIds = new Set<string>();
  const modelIdByKey = new Map<string, string>();

  const availableModels = oldConfig.available_models || [];
  const defaultModel = oldConfig.models?.default || {};
  const defaultProviderName = defaultModel.provider;

  const registerProvider = (providerName: string, source?: AnyRecord) => {
    if (!providerName) return;
    const existing = providers[providerName];
    const providerType = providerName === "anthropic" ? "anthropic" : "openai_compat";
    const next = existing || { type: providerType };

    if (!next.api_key_env && source?.api_key_env) {
      next.api_key_env = source.api_key_env;
    } else if (source?.api_key_env && next.api_key_env && next.api_key_env !== source.api_key_env) {
      warnings.push(
        `Provider ${providerName} has multiple api_key_env values; keeping ${next.api_key_env}.`
      );
    }

    if (!next.base_url && source?.base_url) {
      next.base_url = source.base_url;
    } else if (source?.base_url && next.base_url && next.base_url !== source.base_url) {
      warnings.push(
        `Provider ${providerName} has multiple base_url values; keeping ${next.base_url}.`
      );
    }

    if (source?.stream !== undefined || source?.thinking !== undefined || source?.timeout !== undefined) {
      next.defaults = next.defaults || {};
      if (next.defaults.stream === undefined && source.stream !== undefined) {
        next.defaults.stream = source.stream;
      }
      if (next.defaults.thinking === undefined && source.thinking !== undefined) {
        next.defaults.thinking = source.thinking;
      }
      if (next.defaults.timeout === undefined && source.timeout !== undefined) {
        next.defaults.timeout = source.timeout;
      }
    }

    providers[providerName] = next;
  };

  const registerModel = (input: {
    provider: string;
    model: string;
    base_url?: string;
    name?: string;
    defaults?: AnyRecord;
  }): string => {
    const key = `${input.provider}::${input.model}::${input.base_url || ""}`;
    const existingId = modelIdByKey.get(key);
    if (existingId) {
      const existing = models[existingId];
      if (input.name && !existing.name) {
        existing.name = input.name;
      }
      if (input.base_url && !existing.base_url) {
        existing.base_url = input.base_url;
      }
      if (input.defaults) {
        existing.defaults = existing.defaults || {};
        mergeOverride(existing.defaults, input.defaults);
        existing.defaults = compactOverrides(existing.defaults);
      }
      return existingId;
    }

    const baseId = normalizeId(input.provider + "-" + input.model);
    const id = ensureIdUnique(baseId, usedModelIds);
    modelIdByKey.set(key, id);
    models[id] = {
      provider: input.provider,
      model: input.model,
      name: input.name,
      base_url: input.base_url,
      defaults: compactOverrides(input.defaults)
    };
    return id;
  };

  if (oldConfig.providers) {
    for (const [providerName, providerConfig] of Object.entries(oldConfig.providers)) {
      registerProvider(providerName, providerConfig as AnyRecord);
    }
  }

  for (const model of availableModels) {
    registerProvider(model.provider, oldConfig.providers?.[model.provider]);
    const modelId = model.id || normalizeId(model.provider + "-" + model.model);
    const id = ensureIdUnique(modelId, usedModelIds);
    modelIdByKey.set(`${model.provider}::${model.model}::${model.base_url || ""}`, id);
    models[id] = {
      provider: model.provider,
      model: model.model,
      name: model.name,
      base_url: model.base_url
    };
  }

  let defaultModelId: string | undefined;
  if (defaultModel.provider && defaultModel.model) {
    registerProvider(defaultModel.provider, {
      api_key_env: defaultModel.api_key_env,
      base_url: defaultModel.base_url
    });

    defaultModelId = registerModel({
      provider: defaultModel.provider,
      model: defaultModel.model,
      base_url: defaultModel.base_url,
      defaults: {
        params: defaultModel.params,
        stream: defaultModel.stream,
        thinking: defaultModel.thinking,
        timeout: defaultModel.timeout
      }
    });
  }

  const oldNodes = oldConfig.models?.nodes || {};
  for (const [nodeId, nodeConfig] of Object.entries(oldNodes)) {
    const provider = nodeConfig.provider || defaultModel.provider;
    const model = nodeConfig.model || defaultModel.model;
    if (!provider || !model) {
      warnings.push(`Node ${nodeId} is missing provider/model; skipping.`);
      continue;
    }

    registerProvider(provider, {
      api_key_env: nodeConfig.api_key_env || defaultModel.api_key_env,
      base_url: nodeConfig.base_url || defaultModel.base_url
    });

    const modelId = registerModel({
      provider,
      model,
      base_url: nodeConfig.base_url
    });

    const overrides: AnyRecord = {};
    mergeOverride(overrides, {
      params: nodeConfig.params,
      stream: nodeConfig.stream,
      suppress_streaming: nodeConfig.suppress_streaming,
      thinking: nodeConfig.thinking,
      timeout: nodeConfig.timeout,
      base_url: nodeConfig.base_url
    });

    nodes[nodeId] = {
      model: modelId,
      overrides: compactOverrides(overrides)
    };
  }

  if (defaultProviderName && !providers[defaultProviderName]) {
    registerProvider(defaultProviderName, defaultModel);
  }

  if (oldConfig.credentials) {
    warnings.push("credentials config is not migrated (no equivalent in new schema).");
  }

  for (const [providerName, providerConfig] of Object.entries(providers)) {
    if (!providerConfig.api_key_env) {
      warnings.push(`Provider ${providerName} is missing api_key_env.`);
    }
  }

  const newConfig: NewConfig = {
    defaults: defaultModelId ? { model: defaultModelId } : undefined,
    providers,
    models,
    nodes: Object.keys(nodes).length > 0 ? nodes : undefined,
    prompts: oldConfig.prompts
  };

  return { config: newConfig, warnings };
}

function main() {
  const { input, output } = parseArgs(process.argv.slice(2));
  const inputPath = resolve(process.cwd(), input || "config/llm.yaml");
  const outputPath = resolve(process.cwd(), output || "config/llm.migrated.yaml");

  const raw = readFileSync(inputPath, "utf-8");
  const config = load(raw) as AnyRecord;

  if (!isOldSchema(config)) {
    console.log("Input config does not match the old schema. No migration needed.");
    return;
  }

  const { config: migrated, warnings } = migrate(config as OldConfig);
  const yaml = dump(migrated, { lineWidth: 120, noRefs: true });
  writeFileSync(outputPath, yaml, "utf-8");

  console.log(`Migrated config written to ${outputPath}`);
  if (warnings.length > 0) {
    console.warn("Warnings:");
    warnings.forEach((warning) => console.warn(`- ${warning}`));
  }
}

main();
