import { Mistral } from '@mistralai/mistralai'
import type { ContentChunk, TextChunk } from '@mistralai/mistralai/models/components'
import { MistralError } from '@mistralai/mistralai/models/errors'
import type { ILlmAdapter, LlmRequest, LlmResponse } from '../../application/ports/ILlmAdapter.js'
import { LlmError } from './llm.error.js'

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
        { model, messages: buildMessages(request) },
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

function wrapMistralError(err: unknown): LlmError {
  if (err instanceof MistralError) {
    return new LlmError('mistral', err.message, err.statusCode)
  }
  const message = err instanceof Error ? err.message : String(err)
  return new LlmError('mistral', message)
}
