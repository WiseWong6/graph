// LLM client utility
// Provides a unified interface for interacting with different LLM providers
//
// "Bad programmers worry about the code. Good programmers worry about data structures."
// This module abstracts provider differences behind a clean data structure.

import OpenAI from "openai";
import type { LLMNodeConfig } from "../config/llm.js";

/**
 * Simple async mutex to prevent concurrent stdout writes
 * Ensures streaming output from parallel nodes doesn't interleave
 */
class AsyncMutex {
  private locked = false;
  private queue: Array<(value: void) => void> = [];

  async acquire(): Promise<() => void> {
    while (this.locked) {
      await new Promise<void>(resolve => this.queue.push(resolve));
    }
    this.locked = true;
    return () => this.release();
  }

  private release(): void {
    this.locked = false;
    const resolve = this.queue.shift();
    if (resolve) resolve();
  }
}

// Module-level mutex for all stdout operations
const stdoutMutex = new AsyncMutex();

// DeepSeek-specific response extensions
// The DeepSeek Reasoner model returns reasoning_content and reasoning_tokens
interface DeepSeekCompletionMessage extends OpenAI.ChatCompletionMessage {
  reasoning_content?: string;
}

interface DeepSeekCompletionUsage extends OpenAI.CompletionUsage {
  reasoning_tokens?: number;
}

// Unified LLM call options - request parameters
export interface LLMCallOptions {
  prompt: string;
  systemMessage?: string;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
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

// Stream chunk - partial text from streaming
export interface StreamChunk {
  text: string;
  done: boolean;
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
      case "doubao":
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
   * Streaming version - yields text chunks as they arrive
   * Returns AsyncGenerator for use with for-await loops
   */
  async *stream(options: LLMCallOptions): AsyncGenerator<StreamChunk> {
    const provider = this.config.provider;

    switch (provider) {
      case "doubao":
      case "openai":
      case "deepseek":
        yield* this.streamOpenAICompatible(options);
        break;
      case "anthropic":
        throw new Error("Anthropic streaming not yet implemented");
      default:
        const _exhaustive: never = provider;
        throw new Error(`Unsupported provider: ${_exhaustive}`);
    }
  }

  /**
   * OpenAI-compatible streaming implementation
   */
  private async *streamOpenAICompatible(options: LLMCallOptions): AsyncGenerator<StreamChunk> {
    const apiKey = this.getApiKey(
      this.config.api_key_env ||
      (this.config.provider === "deepseek" ? "DEEPSEEK_API_KEY" :
       this.config.provider === "doubao" ? "DOUBAO_API_KEY" :
       "OPENAI_API_KEY")
    );
    const baseURL = this.config.base_url ||
      (this.config.provider === "deepseek" ? "https://api.deepseek.com" :
       this.config.provider === "doubao" ? "https://ark.cn-beijing.volces.com/api/v3" :
       "https://api.openai.com/v1");

    const client = new OpenAI({ apiKey, baseURL });

    const messages: OpenAI.ChatCompletionMessageParam[] = [];
    if (options.systemMessage) {
      messages.push({ role: "system", content: options.systemMessage });
    }
    messages.push({ role: "user", content: options.prompt });

    const stream = await client.chat.completions.create({
      model: this.config.model,
      messages,
      max_tokens: options.maxTokens || this.config.max_tokens || 1024,
      temperature: options.temperature || this.config.temperature || 0.7,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield { text: content, done: false };
      }
      if (chunk.choices[0]?.finish_reason) {
        yield { text: "", done: true };
        break;
      }
    }
  }

  /**
   * OpenAI-compatible implementation (non-streaming)
   * Used by both OpenAI and DeepSeek (which is API-compatible)
   *
   * This is the "happy path" - standard REST API, standard response format
   *
   * DeepSeek Reasoner support:
   * - Streams reasoning_content when available (thinking process)
   * - Configurable timeout to prevent "terminated" errors
   */
  private async callOpenAICompatible(options: LLMCallOptions): Promise<LLMResponse> {
    const apiKey = this.getApiKey(
      this.config.api_key_env ||
      (this.config.provider === "deepseek" ? "DEEPSEEK_API_KEY" :
       this.config.provider === "doubao" ? "DOUBAO_API_KEY" :
       "OPENAI_API_KEY")
    );
    const baseURL = this.config.base_url ||
      (this.config.provider === "deepseek" ? "https://api.deepseek.com" :
       this.config.provider === "doubao" ? "https://ark.cn-beijing.volces.com/api/v3" :
       "https://api.openai.com/v1");

    // Calculate timeout: provider-specific multipliers for reasoning models
    // DeepSeek Reasoner and Doubao Thinking may take up to 60s for thinking alone
    const isReasoningProvider = this.config.provider === "deepseek" ||
      (this.config.provider === "doubao" && this.config.thinking?.type !== "disabled");
    const timeoutMs = isReasoningProvider
      ? (this.config.timeout || 120000) * 2
      : (this.config.timeout || 120000);

    const client = new OpenAI({
      apiKey,
      baseURL,
      timeout: timeoutMs,
    });

    // Build messages array - standard format shared by OpenAI-compatible APIs
    const messages: OpenAI.ChatCompletionMessageParam[] = [];
    if (options.systemMessage) {
      messages.push({ role: "system", content: options.systemMessage });
    }
    messages.push({ role: "user", content: options.prompt });

    // DeepSeek Reasoner 使用流式输出（仅 reasoner 模型）
    const isDeepSeekReasoner = this.config.provider === "deepseek" && this.config.model.includes("reasoner");

    // Doubao 深度思考模型也使用流式输出（thinking.type !== "disabled"）
    const isDoubaoThinking = this.config.provider === "doubao" && this.config.thinking?.type !== "disabled";

    if (isDeepSeekReasoner || isDoubaoThinking) {
      return await this.callDeepSeekStreaming(client, messages, options);
    }

    const completion = await client.chat.completions.create({
      model: this.config.model,
      messages,
      max_tokens: options.maxTokens || this.config.max_tokens || 1024,
      temperature: options.temperature || this.config.temperature || 0.7,
    });

    // Handle DeepSeek Reasoner's reasoning_content (thinking process)
    const response = completion.choices[0].message as DeepSeekCompletionMessage;
    if (response.reasoning_content) {
      console.log(`[LLMClient] 💭 DeepSeek Reasoning:\n${response.reasoning_content}`);
    }

    // Normalize response to unified format
    const usage = completion.usage as DeepSeekCompletionUsage | undefined;
    const reasoningTokens = usage?.reasoning_tokens || 0;
    return {
      text: response.content || "",
      usage: {
        prompt_tokens: completion.usage?.prompt_tokens || 0,
        completion_tokens: (completion.usage?.completion_tokens || 0) + reasoningTokens,
        total_tokens: (completion.usage?.total_tokens || 0) + reasoningTokens,
      },
    };
  }

  /**
   * DeepSeek Reasoner / Doubao Thinking 流式输出
   * 支持返回 reasoning_content 字段的模型
   * 逐字显示思考过程和最终内容
   * 使用互斥锁防止并行执行时输出交错
   */
  private async callDeepSeekStreaming(
    client: OpenAI,
    messages: OpenAI.ChatCompletionMessageParam[],
    options: LLMCallOptions
  ): Promise<LLMResponse> {
    // 构建流式请求参数
    const streamParams: any = {
      model: this.config.model,
      messages,
      max_tokens: options.maxTokens || this.config.max_tokens || 4096,
      temperature: options.temperature || this.config.temperature || 0.7,
      stream: true,
    };

    // Doubao 深度思考：通过 extra_body 传递 thinking 参数
    if (this.config.provider === "doubao" && this.config.thinking) {
      streamParams.extra_body = {
        thinking: this.config.thinking
      };
    }

    const stream = await client.chat.completions.create(streamParams) as unknown as AsyncIterable<OpenAI.ChatCompletionChunk>;

    // 判断模型类型（用于日志显示）
    const isDeepSeek = this.config.provider === "deepseek";
    const providerName = isDeepSeek ? "DeepSeek" : "Doubao";

    let reasoningContent = "";
    let responseContent = "";
    let inReasoning = false;

    console.log(`[LLMClient] 💭 ${providerName} Thinking:`);

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta as any; // DeepSeek/Doubao 特有字段

      // 处理推理内容（思考过程）
      if (delta?.reasoning_content) {
        const text = delta.reasoning_content;
        reasoningContent += text;
        // 使用互斥锁保护 stdout，防止并行输出交错
        const release = await stdoutMutex.acquire();
        try {
          process.stdout.write(text);
        } finally {
          release();
        }
        inReasoning = true;
      }

      // 处理响应内容（最终回答）
      if (delta?.content) {
        if (inReasoning) {
          console.log(); // 思考结束，换行
          console.log(`[LLMClient] ✍️  ${providerName} Response:`);
          inReasoning = false;
        }
        const text = delta.content;
        responseContent += text;
        // 使用互斥锁保护 stdout，防止并行输出交错
        const release = await stdoutMutex.acquire();
        try {
          process.stdout.write(text);
        } finally {
          release();
        }
      }
    }

    // 确保换行（如果输出了内容）
    if (inReasoning || responseContent.length > 0) {
      console.log();
    }

    // 确保输出完全刷新
    process.stdout.write("");

    // 计算使用量（估算）
    const reasoningTokens = reasoningContent.length; // 粗略估算
    const responseTokens = responseContent.length;

    return {
      text: responseContent,
      usage: {
        prompt_tokens: 0, // 流式响应不返回 prompt_tokens
        completion_tokens: reasoningTokens + responseTokens,
        total_tokens: reasoningTokens + responseTokens,
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
