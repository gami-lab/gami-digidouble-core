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

const request = {
  systemPrompt: 'You are a helpful assistant.',
  messages: [{ role: 'user' as const, content: 'Hello' }],
}

// ── Tests ────────────────────────────────────────────────────────────────────

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
})
