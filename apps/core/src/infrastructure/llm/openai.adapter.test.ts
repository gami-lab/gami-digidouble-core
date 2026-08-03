import OpenAI from 'openai'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LlmError } from './llm.error.js'
import { OpenAiAdapter } from './openai.adapter.js'

// ── SDK mock ────────────────────────────────────────────────────────────────

const mockCreate = vi.fn()

vi.mock('openai', () => {
  const APIError = class extends Error {
    status: number
    constructor(status: number, message: string, error: unknown, headers: Headers) {
      super(message)
      this.name = 'APIError'
      this.status = status
      void error
      void headers
    }
  }

  const MockOpenAI = vi.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  }))
  ;(MockOpenAI as unknown as Record<string, unknown>)['APIError'] = APIError

  return { default: MockOpenAI }
})

// ── Helpers ─────────────────────────────────────────────────────────────────

function buildCompletion(content: string, model = 'gpt-4o-mini'): OpenAI.ChatCompletion {
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
    usage: { prompt_tokens: 15, completion_tokens: 25, total_tokens: 40 },
  }
}

function buildStreamChunk(
  content: string,
  model = 'gpt-4o-mini',
  usage: OpenAI.CompletionUsage | null = null,
): OpenAI.ChatCompletionChunk {
  return {
    id: 'chatcmpl-stream-test',
    object: 'chat.completion.chunk',
    created: 0,
    model,
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

// ── Tests ────────────────────────────────────────────────────────────────────

// eslint-disable-next-line max-lines-per-function
describe('OpenAiAdapter', () => {
  beforeEach(() => {
    mockCreate.mockReset()
  })

  it('maps a successful completion to LlmResponse', async () => {
    mockCreate.mockResolvedValue(buildCompletion('Hi there!'))
    const adapter = new OpenAiAdapter('sk-test')
    const response = await adapter.complete(request)

    expect(response.content).toBe('Hi there!')
    expect(response.model).toBe('gpt-4o-mini')
    expect(response.inputTokens).toBe(15)
    expect(response.outputTokens).toBe(25)
    expect(response.latencyMs).toBeGreaterThanOrEqual(0)
  })

  it('uses the model override from the request', async () => {
    mockCreate.mockResolvedValue(buildCompletion('ok', 'gpt-4o'))
    const adapter = new OpenAiAdapter('sk-test')
    await adapter.complete({ ...request, model: 'gpt-4o' })

    const calledWith = mockCreate.mock.calls[0]?.[0] as { model: string }
    expect(calledWith.model).toBe('gpt-4o')
  })

  it('maps the Fast service tier to the OpenAI priority wire value', async () => {
    mockCreate.mockResolvedValue(buildCompletion('ok', 'gpt-5.6-luna'))
    const adapter = new OpenAiAdapter('sk-test')

    await adapter.complete({ ...request, model: 'gpt-5.6-luna', serviceTier: 'fast' })

    expect(mockCreate.mock.calls[0]?.[0]).toMatchObject({
      model: 'gpt-5.6-luna',
      service_tier: 'priority',
    })
  })

  it('disables reasoning explicitly for GPT-5 family completions', async () => {
    mockCreate.mockResolvedValue(buildCompletion('ok', 'gpt-5.6-sol'))
    const adapter = new OpenAiAdapter('sk-test')

    await adapter.complete({ ...request, model: 'gpt-5.6-sol' })

    expect(mockCreate.mock.calls[0]?.[0]).toMatchObject({
      model: 'gpt-5.6-sol',
      reasoning_effort: 'none',
    })
  })

  it('does not send unsupported reasoning settings to pre-GPT-5 models', async () => {
    mockCreate.mockResolvedValue(buildCompletion('ok', 'gpt-4o'))
    const adapter = new OpenAiAdapter('sk-test')

    await adapter.complete({ ...request, model: 'gpt-4o' })

    expect(mockCreate.mock.calls[0]?.[0]).not.toHaveProperty('reasoning_effort')
  })

  it('wraps OpenAI.APIError in LlmError with status code', async () => {
    const apiErr = new OpenAI.APIError(429, 'rate limited', undefined, new Headers())
    mockCreate.mockRejectedValue(apiErr)
    const adapter = new OpenAiAdapter('sk-test')

    await expect(adapter.complete(request)).rejects.toMatchObject({
      provider: 'openai',
      statusCode: 429,
      message: 'rate limited',
    })
    await expect(adapter.complete(request)).rejects.toBeInstanceOf(LlmError)
  })

  it('wraps generic errors in LlmError without status code', async () => {
    mockCreate.mockRejectedValue(new Error('network failure'))
    const adapter = new OpenAiAdapter('sk-test')

    await expect(adapter.complete(request)).rejects.toMatchObject({
      provider: 'openai',
      message: 'network failure',
      statusCode: undefined,
    })
  })

  it('throws LlmError when API returns no choices', async () => {
    mockCreate.mockResolvedValue({ ...buildCompletion(''), choices: [] })
    const adapter = new OpenAiAdapter('sk-test')

    await expect(adapter.complete(request)).rejects.toBeInstanceOf(LlmError)
  })

  it('includes the system prompt as the first message', async () => {
    mockCreate.mockResolvedValue(buildCompletion('ok'))
    const adapter = new OpenAiAdapter('sk-test')
    await adapter.complete(request)

    const messages = (
      mockCreate.mock.calls[0]?.[0] as { messages: Array<{ role: string; content: string }> }
    ).messages
    expect(messages[0]).toEqual({
      role: 'system',
      content: 'You are a helpful assistant.',
    })
  })

  it('streams ordered deltas and one terminal event with usage', async () => {
    mockCreate.mockResolvedValue(
      (function* () {
        yield buildStreamChunk('Hello ')
        yield buildStreamChunk('world')
        yield {
          ...buildStreamChunk(''),
          choices: [],
          usage: { prompt_tokens: 15, completion_tokens: 5, total_tokens: 20 },
        }
      })(),
    )
    const controller = new AbortController()
    const adapter = new OpenAiAdapter('sk-test')
    const events = []

    for await (const event of adapter.stream(request, { signal: controller.signal })) {
      events.push(event)
    }

    expect(events.map((event) => event.type)).toEqual(['delta', 'delta', 'completed'])
    expect(events[0]).toEqual({ type: 'delta', text: 'Hello ' })
    expect(events[2]).toMatchObject({
      type: 'completed',
      response: { content: 'Hello world', model: 'gpt-4o-mini', inputTokens: 15, outputTokens: 5 },
    })
    expect(mockCreate.mock.calls[0]?.[0]).toMatchObject({
      model: 'gpt-4o-mini',
      stream: true,
      stream_options: { include_usage: true },
    })
    expect(mockCreate.mock.calls[0]?.[0]).not.toHaveProperty('reasoning_effort')
    expect(mockCreate.mock.calls[0]?.[1]).toMatchObject({ signal: controller.signal })
  })

  it('disables reasoning explicitly for GPT-5 family streams', async () => {
    mockCreate.mockResolvedValue(
      (function* () {
        yield buildStreamChunk('ok', 'gpt-5.4')
        yield {
          ...buildStreamChunk('', 'gpt-5.4'),
          choices: [],
          usage: { prompt_tokens: 15, completion_tokens: 5, total_tokens: 20 },
        }
      })(),
    )
    const adapter = new OpenAiAdapter('sk-test')

    for await (const event of adapter.stream({ ...request, model: 'gpt-5.4' })) {
      void event
    }

    expect(mockCreate.mock.calls[0]?.[0]).toMatchObject({
      model: 'gpt-5.4',
      reasoning_effort: 'none',
    })
  })

  it('does not start the provider when already cancelled', async () => {
    const controller = new AbortController()
    controller.abort()
    const adapter = new OpenAiAdapter('sk-test')

    await expect(async () => {
      for await (const event of adapter.stream(request, { signal: controller.signal })) {
        void event
      }
    }).rejects.toThrow(/aborted/i)
    expect(mockCreate).not.toHaveBeenCalled()
  })
})
