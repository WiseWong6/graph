"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNodeLLMConfig = getNodeLLMConfig;
exports.resolveNodeLLMConfig = resolveNodeLLMConfig;
exports.getPromptTemplate = getPromptTemplate;
exports.getPromptTemplates = getPromptTemplates;
exports.getAvailableNodes = getAvailableNodes;
exports.getAvailableModels = getAvailableModels;
exports.getProviderConfig = getProviderConfig;
exports.getModelConfig = getModelConfig;
exports.getNodeModelId = getNodeModelId;
exports.clearConfigCache = clearConfigCache;
exports.updateConfig = updateConfig;
var js_yaml_1 = require("js-yaml");
var fs_1 = require("fs");
var path_1 = require("path");
var configCache = null;
var configPath = (0, path_1.join)(process.cwd(), "config", "llm.yaml");
function loadConfig() {
    if (configCache) {
        return configCache;
    }
    var yamlContent = (0, fs_1.readFileSync)(configPath, "utf-8");
    configCache = (0, js_yaml_1.load)(yamlContent);
    return configCache;
}
function mergeOverrides() {
    var overrides = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        overrides[_i] = arguments[_i];
    }
    var merged = {};
    for (var _a = 0, overrides_1 = overrides; _a < overrides_1.length; _a++) {
        var override = overrides_1[_a];
        if (!override) {
            continue;
        }
        if (override.params) {
            merged.params = Object.assign(Object.assign({}, (merged.params || {})), override.params);
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
function resolveSelectedModelId(nodeId, selection) {
    if (!selection) {
        return undefined;
    }
    return (selection.selectedModels && selection.selectedModels[nodeId]) || selection.selectedModel;
}
function resolveNodeModelId(nodeId, config) {
    var _a, _b;
    return ((_b = (_a = config.nodes) === null || _a === void 0 ? void 0 : _a[nodeId]) === null || _b === void 0 ? void 0 : _b.model) || (config.defaults && config.defaults.model);
}
function resolveNodeLLMConfig(nodeId, selection) {
    var _a, _b;
    var config = loadConfig();
    var nodeDefinition = (_a = config.nodes) === null || _a === void 0 ? void 0 : _a[nodeId];
    var defaultModelId = resolveNodeModelId(nodeId, config);
    var selectedModelId = resolveSelectedModelId(nodeId, selection);
    var modelId = selectedModelId || defaultModelId;
    if (!modelId) {
        throw new Error("[LLMConfig] No model configured for node ".concat(nodeId));
    }
    var modelConfig = config.models[modelId];
    if (!modelConfig) {
        if (selectedModelId && defaultModelId && config.models[defaultModelId]) {
            console.warn("[LLMConfig] Model ".concat(selectedModelId, " not found for node ").concat(nodeId, ", falling back to ").concat(defaultModelId, "."));
            modelId = defaultModelId;
            modelConfig = config.models[modelId];
        }
        else {
            throw new Error("[LLMConfig] Model ".concat(modelId, " not found for node ").concat(nodeId));
        }
    }
    if (!modelConfig) {
        throw new Error("[LLMConfig] Model ".concat(modelId, " not found for node ").concat(nodeId));
    }
    var providerConfig = config.providers[modelConfig.provider];
    if (!providerConfig) {
        throw new Error("[LLMConfig] Provider ".concat(modelConfig.provider, " not found for model ").concat(modelId));
    }
    var mergedOverrides = mergeOverrides(providerConfig.defaults, modelConfig.defaults, (_b = nodeDefinition) === null || _b === void 0 ? void 0 : _b.overrides);
    var params = Object.assign({}, (mergedOverrides.params || {}));
    var resolvedConfig = {
        provider: modelConfig.provider,
        providerType: providerConfig.type,
        model: modelConfig.model,
        api_key_env: providerConfig.api_key_env,
        base_url: mergedOverrides.base_url || modelConfig.base_url || providerConfig.base_url,
        params: params,
        max_tokens: params.max_tokens,
        temperature: params.temperature,
        timeout: mergedOverrides.timeout,
        stream: mergedOverrides.stream,
        suppress_streaming: mergedOverrides.suppress_streaming,
        thinking: mergedOverrides.thinking
    };
    var usedOverride = !!selectedModelId && modelId !== defaultModelId;
    return { config: resolvedConfig, usedOverride: usedOverride };
}
function getNodeLLMConfig(nodeId) {
    return resolveNodeLLMConfig(nodeId).config;
}
function getPromptTemplate(nodeId) {
    var _a;
    var config = loadConfig();
    return (_a = config.prompts) === null || _a === void 0 ? void 0 : _a[nodeId];
}
function getPromptTemplates() {
    return loadConfig().prompts;
}
function getAvailableNodes() {
    var config = loadConfig();
    return Object.keys(config.nodes || {});
}
function getAvailableModels() {
    var config = loadConfig();
    return Object.entries(config.models || {}).map(function (_a) {
        var id = _a[0], model = _a[1];
        return ({
            id: id,
            name: model.name || model.model,
            provider: model.provider,
            model: model.model,
            base_url: model.base_url
        });
    });
}
function getProviderConfig(providerId) {
    var config = loadConfig();
    return config.providers && config.providers[providerId];
}
function getModelConfig(modelId) {
    var config = loadConfig();
    return config.models && config.models[modelId];
}
function getNodeModelId(nodeId) {
    var config = loadConfig();
    return resolveNodeModelId(nodeId, config);
}
function clearConfigCache() {
    configCache = null;
}
function updateConfig(mutator) {
    var config = loadConfig();
    mutator(config);
    var yaml = (0, js_yaml_1.dump)(config, { lineWidth: 120, noRefs: true });
    (0, fs_1.writeFileSync)(configPath, yaml, "utf-8");
    configCache = config;
}
