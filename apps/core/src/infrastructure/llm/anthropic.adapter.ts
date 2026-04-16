import Anthropic from '@anthropic-ai/sdk'
import type { ILlmAdapter, LlmRequest, LlmResponse } from '../../application/ports/ILlmAdapter.js'
import { LlmError } from './llm.error.js'

const DEFAULT_MODEL = 'claude-3-haiku-20240307'
const DEFAULT_MAX_TOKENS = 1024
const REQUEST_TIMEOUT_MS = 30_000

export class AnthropicAdapter implements ILlmAdapter {
  private readonly client: Anthropic

  constructor(
    apiKey: string,
    private readonly defaultModel = DEFAULT_MODEL,
  ) {
    this.client = new Anthropic({ apiKey, timeout: REQUEST_TIMEOUT_MS })
  }

  async complete(request: LlmRequest): Promise<LlmResponse> {
    const model = request.model ?? this.defaultModel
    const start = Date.now()

    let message: Anthropic.Message

    try {
      message = await this.client.messages.create({
        model,
        max_tokens: DEFAULT_MAX_TOKENS,
        system: request.systemPrompt,
        messages: request.messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      })
    } catch (err) {
      throw wrapAnthropicError(err)
    }

    return extractResponse(message, Date.now() - start)
  }
}

function extractResponse(message: Anthropic.Message, latencyMs: number): LlmResponse {
  const content = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')

  return {
    content,
    model: message.model,
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
    latencyMs,
  }
}

function wrapAnthropicError(err: unknown): LlmError {
  if (err instanceof Anthropic.APIError) {
    return new LlmError('anthropic', err.message, err.status as number | undefined)
  }
  const message = err instanceof Error ? err.message : String(err)
  return new LlmError('anthropic', message)
}
