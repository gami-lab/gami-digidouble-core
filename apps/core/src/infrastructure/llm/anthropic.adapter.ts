import Anthropic from '@anthropic-ai/sdk'
import type {
  ILlmAdapter,
  LlmRequest,
  LlmResponse,
  LlmStreamEvent,
  LlmStreamOptions,
} from '../../application/ports/ILlmAdapter.js'
import { LlmError } from './llm.error.js'
import { completedEvent, deltaEvent, isAborted, throwIfAborted } from './streaming.js'

const DEFAULT_MODEL = 'claude-haiku-4-5'
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
        max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
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

  async *stream(request: LlmRequest, options?: LlmStreamOptions): AsyncIterable<LlmStreamEvent> {
    const model = request.model ?? this.defaultModel
    let responseModel = model
    const start = Date.now()
    let content = ''
    let inputTokens = 0
    let outputTokens = 0
    const signal = options?.signal

    try {
      throwIfAborted(signal)
      const stream = this.client.messages.stream(
        {
          model,
          max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
          system: request.systemPrompt,
          messages: request.messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        },
        { signal },
      )

      for await (const event of stream) {
        if (event.type === 'message_start') responseModel = event.message.model
        const eventData = readAnthropicEvent(event, { inputTokens, outputTokens })
        if (eventData.text.length > 0) {
          content += eventData.text
          yield deltaEvent(eventData.text)
        }
        inputTokens = eventData.inputTokens
        outputTokens = eventData.outputTokens
      }

      throwIfAborted(signal)
    } catch (err) {
      if (isAborted(signal)) throw err
      throw wrapAnthropicError(err)
    }

    yield completedEvent({
      content,
      model: responseModel,
      inputTokens,
      outputTokens,
      latencyMs: Date.now() - start,
    })
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

function readAnthropicEvent(
  event: Anthropic.MessageStreamEvent,
  currentUsage: { inputTokens: number; outputTokens: number },
): {
  text: string
  inputTokens: number
  outputTokens: number
} {
  if (event.type === 'message_start') {
    return {
      text: '',
      inputTokens: event.message.usage.input_tokens,
      outputTokens: currentUsage.outputTokens,
    }
  }
  if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
    return { text: event.delta.text, ...currentUsage }
  }
  if (event.type === 'message_delta') {
    return {
      text: '',
      inputTokens: currentUsage.inputTokens,
      outputTokens: event.usage.output_tokens,
    }
  }
  return { text: '', ...currentUsage }
}

function wrapAnthropicError(err: unknown): LlmError {
  if (err instanceof Anthropic.APIError) {
    return new LlmError('anthropic', err.message, err.status as number | undefined)
  }
  const message = err instanceof Error ? err.message : String(err)
  return new LlmError('anthropic', message)
}
