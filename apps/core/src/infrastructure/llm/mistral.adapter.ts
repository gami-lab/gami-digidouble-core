import { Mistral } from '@mistralai/mistralai'
import type {
  CompletionChunk,
  ContentChunk,
  TextChunk,
} from '@mistralai/mistralai/models/components'
import { MistralError } from '@mistralai/mistralai/models/errors'
import type {
  ILlmAdapter,
  LlmRequest,
  LlmResponse,
  LlmStreamEvent,
  LlmStreamOptions,
} from '../../application/ports/ILlmAdapter.js'
import { LlmError } from './llm.error.js'
import { completedEvent, deltaEvent, isAborted, throwIfAborted } from './streaming.js'

const DEFAULT_MODEL = 'mistral-small-latest'
const REQUEST_TIMEOUT_MS = 30_000

export class MistralAdapter implements ILlmAdapter {
  private readonly client: Mistral

  constructor(
    apiKey: string,
    private readonly defaultModel = DEFAULT_MODEL,
  ) {
    this.client = new Mistral({ apiKey })
  }

  async complete(request: LlmRequest): Promise<LlmResponse> {
    const model = request.model ?? this.defaultModel
    const start = Date.now()

    try {
      const result = await this.client.chat.complete(
        { model, messages: buildMessages(request), maxTokens: request.maxTokens },
        { timeoutMs: REQUEST_TIMEOUT_MS },
      )

      const choice = result.choices[0]
      if (choice === undefined) {
        throw new LlmError('mistral', 'No choices returned by the API')
      }

      return {
        content: extractContent(choice.message?.content),
        model: result.model,
        inputTokens: result.usage.promptTokens ?? 0,
        outputTokens: result.usage.completionTokens ?? 0,
        latencyMs: Date.now() - start,
      }
    } catch (err) {
      if (err instanceof LlmError) throw err
      throw wrapMistralError(err)
    }
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
      const stream = await this.client.chat.stream(
        { model, messages: buildMessages(request), maxTokens: request.maxTokens, stream: true },
        {
          timeoutMs: REQUEST_TIMEOUT_MS,
          ...(signal === undefined ? {} : { signal }),
        },
      )

      for await (const event of stream) {
        const chunk = event.data
        responseModel = chunk.model
        const chunkData = readMistralChunk(chunk, { inputTokens, outputTokens })
        const text = chunkData.text
        if (text.length > 0) {
          content += text
          yield deltaEvent(text)
        }

        inputTokens = chunkData.inputTokens
        outputTokens = chunkData.outputTokens
      }

      throwIfAborted(signal)
    } catch (err) {
      if (isAborted(signal)) throw err
      throw wrapMistralError(err)
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

type MistralMessages = Parameters<Mistral['chat']['complete']>[0]['messages']

function buildMessages(request: LlmRequest): MistralMessages {
  return [
    { role: 'system', content: request.systemPrompt },
    ...request.messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  ]
}

function isTextChunk(chunk: ContentChunk): chunk is TextChunk & { type: 'text' } {
  return typeof chunk === 'object' && 'type' in chunk && chunk.type === 'text'
}

function extractContent(content: string | Array<ContentChunk> | null | undefined): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .filter(isTextChunk)
    .map((c) => c.text)
    .join('')
}

function readMistralChunk(
  chunk: CompletionChunk,
  currentUsage: { inputTokens: number; outputTokens: number },
): { text: string; inputTokens: number; outputTokens: number } {
  return {
    text: extractContent(chunk.choices[0]?.delta.content),
    inputTokens: chunk.usage?.promptTokens ?? currentUsage.inputTokens,
    outputTokens: chunk.usage?.completionTokens ?? currentUsage.outputTokens,
  }
}

function wrapMistralError(err: unknown): LlmError {
  if (err instanceof MistralError) {
    return new LlmError('mistral', err.message, err.statusCode)
  }
  const message = err instanceof Error ? err.message : String(err)
  return new LlmError('mistral', message)
}
