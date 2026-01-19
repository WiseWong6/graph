import OpenAI from "openai";
import type { LLMNodeConfig } from "../../config/llm.js";
import type { LLMAdapter, LLMCallOptions, LLMResponse, StreamChunk } from "../llm-types.js";
import { outputCoordinator, stdoutMutex } from "../llm-output.js";

interface DeepSeekCompletionMessage extends OpenAI.ChatCompletionMessage {
  reasoning_content?: string;
}

interface DeepSeekCompletionUsage extends OpenAI.CompletionUsage {
  reasoning_tokens?: number;
}

function buildMessages(options: LLMCallOptions): OpenAI.ChatCompletionMessageParam[] {
  const messages: OpenAI.ChatCompletionMessageParam[] = [];
  if (options.systemMessage) {
    messages.push({ role: "system", content: options.systemMessage });
  }
  messages.push({ role: "user", content: options.prompt });
  return messages;
}

function getApiKey(envVar: string): string {
  const apiKey = process.env[envVar];
  if (!apiKey) {
    throw new Error(
      `Environment variable ${envVar} is not set. ` +
      `Please set it in your .env file or environment.`
    );
  }
  return apiKey;
}

function resolveTimeoutMs(timeout: number | undefined, isReasoningProvider: boolean): number {
  const baseSeconds = timeout ? (timeout >= 1000 ? timeout / 1000 : timeout) : 120;
  const baseMs = baseSeconds * 1000;
  return isReasoningProvider ? baseMs * 2 : baseMs;
}

function resolveParams(config: LLMNodeConfig, options: LLMCallOptions): {
  restParams: Record<string, unknown>;
  maxTokens: number;
  temperature: number;
} {
  const mergedParams = {
    ...(config.params || {}),
    ...(options.params || {})
  };

  const maxTokens = options.maxTokens
    ?? (mergedParams.max_tokens as number | undefined)
    ?? config.max_tokens
    ?? 1024;

  const temperature = options.temperature
    ?? (mergedParams.temperature as number | undefined)
    ?? config.temperature
    ?? 0.7;

  const { max_tokens: _ignoredMax, temperature: _ignoredTemp, stream: _ignoredStream, ...restParams } = mergedParams;

  return { restParams, maxTokens, temperature };
}

export class OpenAICompatAdapter implements LLMAdapter {
  async call(config: LLMNodeConfig, options: LLMCallOptions): Promise<LLMResponse> {
    const apiKey = getApiKey(config.api_key_env);

    const isReasoningProvider =
      config.provider === "deepseek" ||
      (config.provider === "volcengine" && !!config.thinking && (config.thinking as any).type !== "disabled");

    const client = new OpenAI({
      apiKey,
      baseURL: config.base_url,
      timeout: resolveTimeoutMs(config.timeout, isReasoningProvider)
    });

    const messages = buildMessages(options);
    const { restParams, maxTokens, temperature } = resolveParams(config, options);

    const effectiveStream = config.stream !== undefined ? config.stream : options.stream;
    const isDeepSeekReasoner = config.provider === "deepseek" && config.model.includes("reasoner");
    const isVolcengineThinking =
      config.provider === "volcengine" &&
      !!config.thinking &&
      (config.thinking as any).type !== "disabled";

    const forceNonStreaming = effectiveStream === false;

    if ((isDeepSeekReasoner || isVolcengineThinking) && !forceNonStreaming) {
      return await this.callThinkingStream(client, config, messages, {
        ...options,
        suppressStreaming: options.suppressStreaming ?? config.suppress_streaming
      });
    }

    const request: any = {
      model: config.model,
      messages,
      ...restParams,
      max_tokens: maxTokens,
      temperature
    };

    if (config.provider === "volcengine" && config.thinking && (config.thinking as any).type !== "disabled") {
      request.extra_body = { thinking: config.thinking };
    }

    const completion = await client.chat.completions.create(request);
    const response = completion.choices[0].message as DeepSeekCompletionMessage;

    if (response.reasoning_content) {
      console.log(`[LLMClient] 💭 DeepSeek Reasoning:\n${response.reasoning_content}`);
    }

    const usage = completion.usage as DeepSeekCompletionUsage | undefined;
    const reasoningTokens = usage?.reasoning_tokens || 0;

    return {
      text: response.content || "",
      usage: {
        prompt_tokens: completion.usage?.prompt_tokens || 0,
        completion_tokens: (completion.usage?.completion_tokens || 0) + reasoningTokens,
        total_tokens: (completion.usage?.total_tokens || 0) + reasoningTokens
      }
    };
  }

  async *stream(config: LLMNodeConfig, options: LLMCallOptions): AsyncGenerator<StreamChunk> {
    const apiKey = getApiKey(config.api_key_env);
    const client = new OpenAI({ apiKey, baseURL: config.base_url });

    const messages = buildMessages(options);
    const { restParams, maxTokens, temperature } = resolveParams(config, options);

    const stream = await client.chat.completions.create({
      model: config.model,
      messages,
      ...restParams,
      max_tokens: maxTokens,
      temperature,
      stream: true
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

  private async callThinkingStream(
    client: OpenAI,
    config: LLMNodeConfig,
    messages: OpenAI.ChatCompletionMessageParam[],
    options: LLMCallOptions
  ): Promise<LLMResponse> {
    const { restParams, maxTokens, temperature } = resolveParams(config, options);

    const streamParams: any = {
      model: config.model,
      messages,
      ...restParams,
      max_tokens: maxTokens,
      temperature,
      stream: true
    };

    if (config.provider === "volcengine" && config.thinking) {
      streamParams.extra_body = { thinking: config.thinking };
    }

    const stream = await client.chat.completions.create(streamParams) as unknown as AsyncIterable<OpenAI.ChatCompletionChunk>;

    const isDeepSeek = config.provider === "deepseek";
    const providerName = isDeepSeek ? "DeepSeek" : "Volcengine";
    const suppressOutput = options.suppressStreaming ?? config.suppress_streaming;

    let reasoningContent = "";
    let responseContent = "";
    let inReasoning = false;

    if (!suppressOutput) {
      outputCoordinator.beginStream();
      console.log(`[LLMClient] 💭 ${providerName} Thinking:`);
    }

    try {
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta as any;

        if (delta?.reasoning_content) {
          const text = delta.reasoning_content;
          reasoningContent += text;
          if (!suppressOutput) {
            const release = await stdoutMutex.acquire();
            try {
              process.stdout.write(text);
            } finally {
              release();
            }
          }
          inReasoning = true;
        }

        if (delta?.content) {
          if (inReasoning && !suppressOutput) {
            console.log();
            console.log(`[LLMClient] ✍️  ${providerName} Response:`);
            inReasoning = false;
          }
          const text = delta.content;
          responseContent += text;
          if (!suppressOutput) {
            const release = await stdoutMutex.acquire();
            try {
              process.stdout.write(text);
            } finally {
              release();
            }
          }
        }
      }

      if (!suppressOutput && (inReasoning || responseContent.length > 0)) {
        console.log();
      }
    } finally {
      if (!suppressOutput) {
        outputCoordinator.endStream();
      }
    }

    process.stdout.write("");

    const reasoningTokens = reasoningContent.length;
    const responseTokens = responseContent.length;

    return {
      text: responseContent,
      usage: {
        prompt_tokens: 0,
        completion_tokens: reasoningTokens + responseTokens,
        total_tokens: reasoningTokens + responseTokens
      }
    };
  }
}
