import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import type { Env, Provider } from './env.js';

export interface LlmCallOptions {
  readonly systemPrompt: string;
  readonly userPrompt: string;
  readonly temperature?: number;
  readonly maxOutputTokens?: number;
  readonly responseFormat?: 'text' | 'json';
}

export interface LlmCallResult {
  readonly content: string;
  readonly usage: {
    readonly inputTokens: number;
    readonly outputTokens: number;
  };
  readonly model: string;
}

export interface LlmClient {
  call(options: LlmCallOptions): Promise<LlmCallResult>;
  readonly provider: Provider;
  readonly model: string;
}

/**
 * Detect models that require the new chat completions parameter set
 * (max_completion_tokens, no temperature for reasoning models). May 2026:
 * gpt-5.x and o-series chat-compatible models (o3, o4-mini) follow this
 * convention; gpt-4o-* still use the legacy max_tokens + temperature.
 */
function isNewParameterModel(model: string): boolean {
  return /^(gpt-5|o3$|o3-(?!pro)|o4-mini)/.test(model);
}

function isReasoningModel(model: string): boolean {
  return /^(o3$|o3-(?!pro)|o4-mini)/.test(model);
}

class OpenAiClient implements LlmClient {
  public readonly provider: Provider = 'openai';
  public readonly model: string;
  private readonly client: OpenAI;

  constructor(apiKey: string, model: string, timeoutMs = 120_000) {
    // SDK defaults silently hang for ~30 min on broken sockets (10-min request
    // timeout × 3 attempts). Light editorial passes finish in 30s so the 120s
    // default surfaces stuck requests fast. Heavy generations (16k output
    // tokens on a reasoning model) override via EDITORIAL_PILOT_OPENAI_TIMEOUT_MS.
    this.client = new OpenAI({
      apiKey,
      timeout: timeoutMs,
      maxRetries: 2,
    });
    this.model = model;
  }

  async call(opts: LlmCallOptions): Promise<LlmCallResult> {
    const useNewParams = isNewParameterModel(this.model);
    const reasoning = isReasoningModel(this.model);
    // Reasoning models need a generous budget to leave room for visible
    // tokens after the internal reasoning chain (probed empirically May 2026).
    const baseTokens = opts.maxOutputTokens ?? 4000;
    const tokens = reasoning ? Math.max(baseTokens, 6000) : baseTokens;

    const params: Record<string, unknown> = {
      model: this.model,
      messages: [
        { role: 'system', content: opts.systemPrompt },
        { role: 'user', content: opts.userPrompt },
      ],
    };

    if (useNewParams) {
      params['max_completion_tokens'] = tokens;
      // Reasoning models reject custom temperature; non-reasoning gpt-5.x
      // accept the default but otherwise behave the same with or without.
      if (!reasoning) {
        params['temperature'] = opts.temperature ?? 0.7;
      }
    } else {
      params['max_tokens'] = tokens;
      params['temperature'] = opts.temperature ?? 0.7;
    }

    if (opts.responseFormat === 'json') {
      params['response_format'] = { type: 'json_object' as const };
    }

    const response = await this.client.chat.completions.create(params as never);
    const choice = response.choices[0];
    if (!choice || !choice.message.content) {
      throw new Error(
        `[openai:${this.model}] Empty response. usage=${JSON.stringify(response.usage ?? {})}. Reasoning models likely consumed all tokens in internal reasoning — increase maxOutputTokens.`,
      );
    }
    return {
      content: choice.message.content,
      usage: {
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
      },
      model: this.model,
    };
  }
}

class AnthropicClient implements LlmClient {
  public readonly provider: Provider = 'anthropic';
  public readonly model: string;
  private readonly client: Anthropic;

  constructor(apiKey: string, model: string) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async call(opts: LlmCallOptions): Promise<LlmCallResult> {
    const message = await this.client.messages.create({
      model: this.model,
      max_tokens: opts.maxOutputTokens ?? 4000,
      temperature: opts.temperature ?? 0.7,
      system: opts.systemPrompt,
      messages: [{ role: 'user', content: opts.userPrompt }],
    });
    const block = message.content[0];
    if (!block || block.type !== 'text') {
      throw new Error('[anthropic] Unexpected response shape.');
    }
    return {
      content: block.text,
      usage: {
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
      },
      model: this.model,
    };
  }
}

export function buildLlmClient(env: Env, provider: Provider): LlmClient {
  if (provider === 'openai') {
    if (!env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY missing.');
    return new OpenAiClient(
      env.OPENAI_API_KEY,
      env.EDITORIAL_PILOT_OPENAI_MODEL,
      env.EDITORIAL_PILOT_OPENAI_TIMEOUT_MS,
    );
  }
  if (!env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY missing.');
  return new AnthropicClient(env.ANTHROPIC_API_KEY, env.EDITORIAL_PILOT_ANTHROPIC_MODEL);
}
