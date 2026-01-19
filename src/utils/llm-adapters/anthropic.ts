import type { LLMNodeConfig } from "../../config/llm.js";
import type { LLMAdapter, LLMCallOptions, LLMResponse, StreamChunk } from "../llm-types.js";

export class AnthropicAdapter implements LLMAdapter {
  async call(_config: LLMNodeConfig, _options: LLMCallOptions): Promise<LLMResponse> {
    throw new Error(
      "Anthropic provider not yet implemented. " +
      "Install @anthropic-ai/sdk and add the adapter implementation."
    );
  }

  async *stream(_config: LLMNodeConfig, _options: LLMCallOptions): AsyncGenerator<StreamChunk> {
    throw new Error(
      "Anthropic streaming not yet implemented. " +
      "Install @anthropic-ai/sdk and add the adapter implementation."
    );
  }
}
