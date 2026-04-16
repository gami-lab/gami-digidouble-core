import OpenAI from 'openai'
import type { ILlmAdapter, LlmRequest, LlmResponse } from '../../application/ports/ILlmAdapter.js'
import { LlmError } from './llm.error.js'

const DEFAULT_MODEL = 'gpt-4o-mini'
const REQUEST_TIMEOUT_MS = 30_000

export class OpenAiAdapter implements ILlmAdapter {
  private readonly client: OpenAI

  constructor(
    apiKey: string,
    private readonly defaultModel = DEFAULT_MODEL,
  ) {
    this.client = new OpenAI({ apiKey, timeout: REQUEST_TIMEOUT_MS })
  }

  async complete(request: LlmRequest): Promise<LlmResponse> {
    const model = request.model ?? this.defaultModel
    const start = Date.now()

    let completion: OpenAI.ChatCompletion

    try {
      completion = await this.client.chat.completions.create({
        model,
        messages: buildMessages(request),
      })
    } catch (err) {
      throw wrapOpenAiError(err)
    }

    const latencyMs = Date.now() - start
    return extractResponse(completion, latencyMs)
  }
}

function buildMessages(request: LlmRequest): OpenAI.ChatCompletionMessageParam[] {
  const system: OpenAI.ChatCompletionMessageParam = {
    role: 'system',
    content: request.systemPrompt,
  }
  const turns: OpenAI.ChatCompletionMessageParam[] = request.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }))
  return [system, ...turns]
}

function extractResponse(completion: OpenAI.ChatCompletion, latencyMs: number): LlmResponse {
  const choice = completion.choices[0]
  if (choice === undefined) {
    throw new LlmError('openai', 'No choices returned by the API')
  }
  const content = choice.message.content ?? ''
  const usage = completion.usage
  return {
    content,
    model: completion.model,
    inputTokens: usage?.prompt_tokens ?? 0,
    outputTokens: usage?.completion_tokens ?? 0,
    latencyMs,
  }
}

function wrapOpenAiError(err: unknown): LlmError {
  if (err instanceof OpenAI.APIError) {
    return new LlmError('openai', err.message, err.status as number | undefined)
  }
  const message = err instanceof Error ? err.message : String(err)
  return new LlmError('openai', message)
}
