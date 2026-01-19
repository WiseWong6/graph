import { getDynamicLLMConfig, getNodeLLMConfig, type LLMNodeConfig } from "../config/llm.js";
import { LLMClient, type LLMCallOptions, type LLMResponse } from "./llm-client.js";

export interface LLMCallResult {
  response: LLMResponse;
  config: LLMNodeConfig;
  usedFallback: boolean;
}

export async function callLLMWithFallback(
  selectedModelId: string | undefined,
  nodeId: string,
  options: LLMCallOptions
): Promise<LLMCallResult> {
  const primaryConfig = getDynamicLLMConfig(selectedModelId, nodeId);
  const primaryClient = new LLMClient(primaryConfig);

  try {
    const response = await primaryClient.call(options);
    return { response, config: primaryConfig, usedFallback: false };
  } catch (error) {
    if (!selectedModelId) {
      throw error;
    }

    const fallbackConfig = getNodeLLMConfig(nodeId);
    const sameConfig =
      fallbackConfig.provider === primaryConfig.provider &&
      fallbackConfig.model === primaryConfig.model;
    if (sameConfig) {
      throw error;
    }

    console.warn(
      `[${nodeId}] Selected model failed (${primaryConfig.provider}/${primaryConfig.model}), ` +
      `falling back to node default (${fallbackConfig.provider}/${fallbackConfig.model}).`
    );

    const fallbackClient = new LLMClient(fallbackConfig);
    const response = await fallbackClient.call(options);
    return { response, config: fallbackConfig, usedFallback: true };
  }
}
