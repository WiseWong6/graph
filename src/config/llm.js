"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNodeLLMConfig = getNodeLLMConfig;
exports.getPromptTemplate = getPromptTemplate;
exports.getAvailableNodes = getAvailableNodes;
exports.clearConfigCache = clearConfigCache;
var js_yaml_1 = require("js-yaml");
var fs_1 = require("fs");
var path_1 = require("path");
// 全局配置缓存
var configCache = null;
// 加载配置文件
function loadConfig() {
    if (configCache) {
        return configCache;
    }
    var configPath = (0, path_1.join)(process.cwd(), "config", "llm.yaml");
    var yamlContent = (0, fs_1.readFileSync)(configPath, "utf-8");
    configCache = (0, js_yaml_1.load)(yamlContent);
    return configCache;
}
// 获取节点的 LLM 配置
function getNodeLLMConfig(nodeId) {
    var config = loadConfig();
    // 优先使用节点特定配置
    if (config.models.nodes && config.models.nodes[nodeId]) {
        var nodeConfig = config.models.nodes[nodeId];
        // 提取 params 中的参数并合并到顶层
        var params = nodeConfig.params || {};
        var result = {
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
    var defaultConfig = config.models.default;
    var defaultParams = defaultConfig.params || {};
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
function getPromptTemplate(nodeId) {
    var _a;
    var config = loadConfig();
    return (_a = config.prompts) === null || _a === void 0 ? void 0 : _a[nodeId];
}
// 获取所有可用的节点
function getAvailableNodes() {
    var config = loadConfig();
    return Object.keys(config.models.nodes || {});
}
// 清除配置缓存（主要用于测试）
function clearConfigCache() {
    configCache = null;
}
