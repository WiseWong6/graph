import type { LLMNodeConfig } from "../config/llm.js";

export interface LLMCallOptions {
  prompt: string;
  systemMessage?: string;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
  suppressStreaming?: boolean;
  params?: Record<string, unknown>;
}

export interface LLMResponse {
  text: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface StreamChunk {
  text: string;
  done: boolean;
}

export interface LLMAdapter {
  call: (config: LLMNodeConfig, options: LLMCallOptions) => Promise<LLMResponse>;
  stream?: (config: LLMNodeConfig, options: LLMCallOptions) => AsyncGenerator<StreamChunk>;
}
