import OpenAI from 'openai'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LlmError } from './llm.error.js'
import { XaiAdapter } from './xai.adapter.js'

// ── SDK mock ────────────────────────────────────────────────────────────────

const mockCreate = vi.fn()

vi.mock('openai', () => {
  const APIError = class extends Error {
    status: number
    constructor(status: number, message: string, _error: unknown, _headers: Headers) {
      super(message)
      this.name = 'APIError'
      this.status = status
    }
  }

  const MockOpenAI = vi.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  }))
  ;(MockOpenAI as unknown as Record<string, unknown>)['APIError'] = APIError

  return { default: MockOpenAI }
})

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildCompletion(content: string, model = 'grok-3'): OpenAI.ChatCompletion {
  return {
    id: 'chatcmpl-test',
    object: 'chat.completion',
    created: 0,
    model,
    choices: [
      {
        index: 0,
        finish_reason: 'stop',
        message: { role: 'assistant', content, refusal: null },
        logprobs: null,
      },
    ],
    usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
  }
}

function buildStreamChunk(
  content: string,
  usage: OpenAI.CompletionUsage | null = null,
): OpenAI.ChatCompletionChunk {
  return {
    id: 'chatcmpl-stream-test',
    object: 'chat.completion.chunk',
    created: 0,
    model: 'grok-3',
    choices: [
      {
        index: 0,
        finish_reason: null,
        delta: { role: 'assistant', content },
        logprobs: null,
      },
    ],
    usage,
  }
}

const request = {
  systemPrompt: 'You are a helpful assistant.',
  messages: [{ role: 'user' as const, content: 'Hello' }],
}

// ── Tests ─────────────────────────────────────────────────────────────────────

// The adapter contract tests cover completion and streaming behavior together.
// eslint-disable-next-line max-lines-per-function
describe('XaiAdapter', () => {
  beforeEach(() => {
    mockCreate.mockReset()
  })

  it('maps a successful completion to LlmResponse', async () => {
    mockCreate.mockResolvedValue(buildCompletion('Hi there!'))
    const adapter = new XaiAdapter('xai-test')
    const response = await adapter.complete(request)

    expect(response.content).toBe('Hi there!')
    expect(response.model).toBe('grok-3')
    expect(response.inputTokens).toBe(10)
    expect(response.outputTokens).toBe(20)
    expect(response.latencyMs).toBeGreaterThanOrEqual(0)
  })

  it('initialises the OpenAI client with the xAI base URL', () => {
    new XaiAdapter('xai-test')

    const ctorCall = vi.mocked(OpenAI).mock.calls[0]?.[0] as {
      apiKey: string
      baseURL: string
    }
    expect(ctorCall.baseURL).toBe('https://api.x.ai/v1')
    expect(ctorCall.apiKey).toBe('xai-test')
  })

  it('uses the model override from the request', async () => {
    mockCreate.mockResolvedValue(buildCompletion('ok', 'grok-3-mini'))
    const adapter = new XaiAdapter('xai-test')
    await adapter.complete({ ...request, model: 'grok-3-mini' })

    const calledWith = mockCreate.mock.calls[0]?.[0] as { model: string }
    expect(calledWith.model).toBe('grok-3-mini')
  })

  it('uses the custom default model when provided', async () => {
    mockCreate.mockResolvedValue(buildCompletion('ok', 'grok-3-fast'))
    const adapter = new XaiAdapter('xai-test', 'grok-3-fast')
    await adapter.complete(request)

    const calledWith = mockCreate.mock.calls[0]?.[0] as { model: string }
    expect(calledWith.model).toBe('grok-3-fast')
  })

  it('passes max_tokens when provided', async () => {
    mockCreate.mockResolvedValue(buildCompletion('ok'))
    const adapter = new XaiAdapter('xai-test')
    await adapter.complete({ ...request, maxTokens: 512 })

    const calledWith = mockCreate.mock.calls[0]?.[0] as { max_tokens?: number }
    expect(calledWith.max_tokens).toBe(512)
  })

  it('omits max_tokens when not provided', async () => {
    mockCreate.mockResolvedValue(buildCompletion('ok'))
    const adapter = new XaiAdapter('xai-test')
    await adapter.complete(request)

    const calledWith = mockCreate.mock.calls[0]?.[0] as { max_tokens?: number }
    expect(calledWith.max_tokens).toBeUndefined()
  })

  it('includes the system prompt as the first message', async () => {
    mockCreate.mockResolvedValue(buildCompletion('ok'))
    const adapter = new XaiAdapter('xai-test')
    await adapter.complete(request)

    const messages = (
      mockCreate.mock.calls[0]?.[0] as { messages: Array<{ role: string; content: string }> }
    ).messages
    expect(messages[0]).toEqual({ role: 'system', content: 'You are a helpful assistant.' })
  })

  it('wraps OpenAI.APIError in LlmError with provider "xai" and status code', async () => {
    const apiErr = new OpenAI.APIError(429, 'rate limited', undefined, new Headers())
    mockCreate.mockRejectedValue(apiErr)
    const adapter = new XaiAdapter('xai-test')

    await expect(adapter.complete(request)).rejects.toMatchObject({
      provider: 'xai',
      statusCode: 429,
      message: 'rate limited',
    })
    await expect(adapter.complete(request)).rejects.toBeInstanceOf(LlmError)
  })

  it('wraps generic errors in LlmError without status code', async () => {
    mockCreate.mockRejectedValue(new Error('network failure'))
    const adapter = new XaiAdapter('xai-test')

    await expect(adapter.complete(request)).rejects.toMatchObject({
      provider: 'xai',
      message: 'network failure',
      statusCode: undefined,
    })
  })

  it('throws LlmError when API returns no choices', async () => {
    mockCreate.mockResolvedValue({ ...buildCompletion(''), choices: [] })
    const adapter = new XaiAdapter('xai-test')

    await expect(adapter.complete(request)).rejects.toBeInstanceOf(LlmError)
  })

  it('streams ordered deltas, terminal usage, and cancellation signal', async () => {
    mockCreate.mockResolvedValue(
      (function* () {
        yield buildStreamChunk('Hi ')
        yield buildStreamChunk('there')
        yield {
          ...buildStreamChunk(''),
          choices: [],
          usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 },
        }
      })(),
    )
    const controller = new AbortController()
    const adapter = new XaiAdapter('xai-test')
    const events = []

    for await (const event of adapter.stream(request, { signal: controller.signal })) {
      events.push(event)
    }

    expect(events.map((event) => event.type)).toEqual(['delta', 'delta', 'completed'])
    expect(events[2]).toMatchObject({
      type: 'completed',
      response: { content: 'Hi there', model: 'grok-3', inputTokens: 10, outputTokens: 4 },
    })
    expect(mockCreate.mock.calls[0]?.[1]).toMatchObject({ signal: controller.signal })
  })

  it('does not start the provider when already cancelled', async () => {
    const controller = new AbortController()
    controller.abort()
    const adapter = new XaiAdapter('xai-test')

    await expect(async () => {
      for await (const event of adapter.stream(request, { signal: controller.signal })) {
        expect(event).toBeDefined()
      }
    }).rejects.toThrow(/aborted/i)
    expect(mockCreate).not.toHaveBeenCalled()
  })
})
