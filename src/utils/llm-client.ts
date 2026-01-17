// LLM client utility
// Provides a unified interface for interacting with different LLM providers
//
// "Bad programmers worry about the code. Good programmers worry about data structures."
// This module abstracts provider differences behind a clean data structure.

import OpenAI from "openai";
import type { LLMNodeConfig } from "../config/llm.js";

// Unified LLM call options - request parameters
export interface LLMCallOptions {
  prompt: string;
  systemMessage?: string;
  maxTokens?: number;
  temperature?: number;
}

// Unified LLM response - normalized output
export interface LLMResponse {
  text: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Unified LLM client supporting multiple providers
 *
 * Design principle: Provider differences are implementation details,
 * hidden behind a single clean interface.
 */
export class LLMClient {
  constructor(private config: LLMNodeConfig) {}

  /**
   * Main entry point - routes to appropriate provider implementation
   * No special cases here, just data-driven dispatch
   */
  async call(options: LLMCallOptions): Promise<LLMResponse> {
    const provider = this.config.provider;

    switch (provider) {
      case "openai":
      case "deepseek":
        return await this.callOpenAICompatible(options);
      case "anthropic":
        return await this.callAnthropic(options);
      default:
        // Exhaustiveness check - if this compiles, we handled all providers
        const _exhaustive: never = provider;
        throw new Error(`Unsupported provider: ${_exhaustive}`);
    }
  }

  /**
   * OpenAI-compatible implementation
   * Used by both OpenAI and DeepSeek (which is API-compatible)
   *
   * This is the "happy path" - standard REST API, standard response format
   */
  private async callOpenAICompatible(options: LLMCallOptions): Promise<LLMResponse> {
    const apiKey = this.getApiKey(
      this.config.api_key_env || (this.config.provider === "deepseek" ? "DEEPSEEK_API_KEY" : "OPENAI_API_KEY")
    );
    const baseURL = this.config.base_url || (this.config.provider === "deepseek" ? "https://api.deepseek.com" : "https://api.openai.com/v1");

    const client = new OpenAI({
      apiKey,
      baseURL,
    });

    // Build messages array - standard format shared by OpenAI-compatible APIs
    const messages: OpenAI.ChatCompletionMessageParam[] = [];
    if (options.systemMessage) {
      messages.push({ role: "system", content: options.systemMessage });
    }
    messages.push({ role: "user", content: options.prompt });

    const completion = await client.chat.completions.create({
      model: this.config.model,
      messages,
      max_tokens: options.maxTokens || this.config.max_tokens || 1024,
      temperature: options.temperature || this.config.temperature || 0.7,
    });

    // Normalize response to unified format
    return {
      text: completion.choices[0].message.content || "",
      usage: {
        prompt_tokens: completion.usage?.prompt_tokens || 0,
        completion_tokens: completion.usage?.completion_tokens || 0,
        total_tokens: completion.usage?.total_tokens || 0,
      },
    };
  }

  /**
   * Anthropic implementation
   *
   * TODO: Implement in phase 2.5
   * Requires @anthropic-ai/sdk package which is not yet installed
   */
  private async callAnthropic(_options: LLMCallOptions): Promise<LLMResponse> {
    throw new Error(
      "Anthropic provider not yet implemented. " +
      "Install @anthropic-ai/sdk and uncomment the implementation."
    );

    // Implementation sketch (requires @anthropic-ai/sdk):
    /*
    const Anthropic = require("@anthropic-ai/sdk");
    const client = new Anthropic({
      apiKey: this.getApiKey(this.config.api_key_env || "ANTHROPIC_API_KEY"),
    });

    const message = await client.messages.create({
      model: this.config.model,
      max_tokens: options.maxTokens || this.config.max_tokens || 1024,
      system: options.systemMessage,
      messages: [{ role: "user", content: options.prompt }],
    });

    return {
      text: message.content[0].type === "text" ? message.content[0].text : "",
      usage: {
        prompt_tokens: message.usage.input_tokens,
        completion_tokens: message.usage.output_tokens,
        total_tokens: message.usage.input_tokens + message.usage.output_tokens,
      },
    };
    */
  }

  /**
   * Get API key from environment
   *
   * Fails fast if key is missing - better to error early than to fail
   * midway through a request with a cryptic authentication error.
   */
  private getApiKey(envVar: string): string {
    const apiKey = process.env[envVar];
    if (!apiKey) {
      throw new Error(
        `Environment variable ${envVar} is not set. ` +
        `Please set it in your .env file or environment.`
      );
    }
    return apiKey;
  }
}
