// LLM client utility
// Provides a unified interface for interacting with different LLM providers
//
// "Bad programmers worry about the code. Good programmers worry about data structures."
// This module abstracts provider differences behind a clean data structure.

import type { LLMNodeConfig, ProviderType } from "../config/llm.js";
import type { LLMAdapter, LLMCallOptions, LLMResponse, StreamChunk } from "./llm-types.js";
import { OpenAICompatAdapter } from "./llm-adapters/openai-compat.js";
import { AnthropicAdapter } from "./llm-adapters/anthropic.js";
import { outputCoordinator } from "./llm-output.js";

const adapters: Record<ProviderType, LLMAdapter> = {
  openai_compat: new OpenAICompatAdapter(),
  anthropic: new AnthropicAdapter()
};

export { outputCoordinator };
export type { LLMCallOptions, LLMResponse, StreamChunk } from "./llm-types.js";

export class LLMClient {
  constructor(private config: LLMNodeConfig) {}

  async call(options: LLMCallOptions): Promise<LLMResponse> {
    const adapter = adapters[this.config.providerType];
    if (!adapter) {
      throw new Error(`Unsupported provider type: ${this.config.providerType}`);
    }
    return adapter.call(this.config, options);
  }

  async *stream(options: LLMCallOptions): AsyncGenerator<StreamChunk> {
    const adapter = adapters[this.config.providerType];
    if (!adapter?.stream) {
      throw new Error(`Streaming not supported for provider type: ${this.config.providerType}`);
    }
    yield* adapter.stream(this.config, options);
  }
}
