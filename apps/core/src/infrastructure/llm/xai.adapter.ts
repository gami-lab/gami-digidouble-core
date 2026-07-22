import OpenAI from 'openai'
import type {
  ILlmAdapter,
  LlmRequest,
  LlmResponse,
  LlmStreamEvent,
  LlmStreamOptions,
} from '../../application/ports/ILlmAdapter.js'
import { LlmError } from './llm.error.js'
import { completedEvent, deltaEvent, isAborted, throwIfAborted } from './streaming.js'

const DEFAULT_MODEL = 'grok-3'
const BASE_URL = 'https://api.x.ai/v1'
const REQUEST_TIMEOUT_MS = 30_000

export class XaiAdapter implements ILlmAdapter {
  private readonly client: OpenAI

  constructor(
    apiKey: string,
    private readonly defaultModel = DEFAULT_MODEL,
  ) {
    this.client = new OpenAI({ apiKey, baseURL: BASE_URL, timeout: REQUEST_TIMEOUT_MS })
  }

  async complete(request: LlmRequest): Promise<LlmResponse> {
    const model = request.model ?? this.defaultModel
    const start = Date.now()

    let completion: OpenAI.ChatCompletion

    try {
      const maxTokens = request.maxTokens
      completion = await this.client.chat.completions.create({
        model,
        messages: buildMessages(request),
        ...(maxTokens === undefined ? {} : { max_tokens: maxTokens }),
      })
    } catch (err) {
      throw wrapXaiError(err)
    }

    return extractResponse(completion, Date.now() - start)
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
      const stream = await this.client.chat.completions.create(
        buildStreamingRequest(request, model),
        { signal },
      )

      for await (const chunk of stream) {
        responseModel = chunk.model
        const chunkData = readOpenAiChunk(chunk, { inputTokens, outputTokens })
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
      throw wrapXaiError(err)
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

function buildStreamingRequest(
  request: LlmRequest,
  model: string,
): OpenAI.ChatCompletionCreateParamsStreaming {
  return {
    model,
    messages: buildMessages(request),
    stream: true,
    stream_options: { include_usage: true },
    ...(request.maxTokens === undefined ? {} : { max_tokens: request.maxTokens }),
  }
}

function readOpenAiChunk(
  chunk: OpenAI.ChatCompletionChunk,
  currentUsage: { inputTokens: number; outputTokens: number },
): { text: string; inputTokens: number; outputTokens: number } {
  return {
    text: chunk.choices[0]?.delta.content ?? '',
    inputTokens: chunk.usage?.prompt_tokens ?? currentUsage.inputTokens,
    outputTokens: chunk.usage?.completion_tokens ?? currentUsage.outputTokens,
  }
}

function extractResponse(completion: OpenAI.ChatCompletion, latencyMs: number): LlmResponse {
  const choice = completion.choices[0]
  if (choice === undefined) {
    throw new LlmError('xai', 'No choices returned by the API')
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

function wrapXaiError(err: unknown): LlmError {
  if (err instanceof OpenAI.APIError) {
    return new LlmError('xai', err.message, err.status as number | undefined)
  }
  const message = err instanceof Error ? err.message : String(err)
  return new LlmError('xai', message)
}
