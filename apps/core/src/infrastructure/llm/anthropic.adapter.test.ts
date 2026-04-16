import Anthropic from '@anthropic-ai/sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LlmError } from './llm.error.js'
import { AnthropicAdapter } from './anthropic.adapter.js'

// ── SDK mock ────────────────────────────────────────────────────────────────

const mockCreate = vi.fn()

vi.mock('@anthropic-ai/sdk', () => {
  class MockAPIError extends Error {
    status: number | undefined
    constructor(
      status: number | undefined,
      error: unknown,
      message: string | undefined,
      headers: Headers | undefined,
    ) {
      super(message ?? '')
      this.name = 'APIError'
      this.status = status
      void error
      void headers
    }
  }

  const MockAnthropic = vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  }))
  ;(MockAnthropic as unknown as Record<string, unknown>)['APIError'] = MockAPIError

  return { default: MockAnthropic }
})

// ── Helpers ─────────────────────────────────────────────────────────────────

function buildMessage(text: string, model = 'claude-3-haiku-20240307'): Anthropic.Message {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model,
    content: [{ type: 'text', text }],
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: { input_tokens: 12, output_tokens: 8 },
  } as unknown as Anthropic.Message
}

const request = {
  systemPrompt: 'You are a helpful assistant.',
  messages: [{ role: 'user' as const, content: 'Hello' }],
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('AnthropicAdapter', () => {
  beforeEach(() => {
    mockCreate.mockReset()
  })

  it('maps a successful completion to LlmResponse', async () => {
    mockCreate.mockResolvedValue(buildMessage('Hi there!'))
    const adapter = new AnthropicAdapter('sk-ant-test')
    const response = await adapter.complete(request)

    expect(response.content).toBe('Hi there!')
    expect(response.model).toBe('claude-3-haiku-20240307')
    expect(response.inputTokens).toBe(12)
    expect(response.outputTokens).toBe(8)
    expect(response.latencyMs).toBeGreaterThanOrEqual(0)
  })

  it('uses the model override from the request', async () => {
    mockCreate.mockResolvedValue(buildMessage('ok', 'claude-3-5-sonnet-20241022'))
    const adapter = new AnthropicAdapter('sk-ant-test')
    await adapter.complete({ ...request, model: 'claude-3-5-sonnet-20241022' })

    const calledWith = mockCreate.mock.calls[0]?.[0] as { model: string }
    expect(calledWith.model).toBe('claude-3-5-sonnet-20241022')
  })

  it('passes the system prompt separately', async () => {
    mockCreate.mockResolvedValue(buildMessage('ok'))
    const adapter = new AnthropicAdapter('sk-ant-test')
    await adapter.complete(request)

    const calledWith = mockCreate.mock.calls[0]?.[0] as { system: string }
    expect(calledWith.system).toBe('You are a helpful assistant.')
  })

  it('concatenates multiple text blocks', async () => {
    mockCreate.mockResolvedValue({
      ...buildMessage(''),
      content: [
        { type: 'text', text: 'Hello ' },
        { type: 'text', text: 'world' },
      ],
    })
    const adapter = new AnthropicAdapter('sk-ant-test')
    const response = await adapter.complete(request)
    expect(response.content).toBe('Hello world')
  })

  it('wraps Anthropic.APIError in LlmError with status code', async () => {
    const apiErr = new Anthropic.APIError(429, undefined, 'rate limited', undefined)
    mockCreate.mockRejectedValue(apiErr)
    const adapter = new AnthropicAdapter('sk-ant-test')

    await expect(adapter.complete(request)).rejects.toMatchObject({
      provider: 'anthropic',
      statusCode: 429,
      message: 'rate limited',
    })
    await expect(adapter.complete(request)).rejects.toBeInstanceOf(LlmError)
  })

  it('wraps generic errors in LlmError without status code', async () => {
    mockCreate.mockRejectedValue(new Error('network failure'))
    const adapter = new AnthropicAdapter('sk-ant-test')

    await expect(adapter.complete(request)).rejects.toMatchObject({
      provider: 'anthropic',
      message: 'network failure',
      statusCode: undefined,
    })
  })
})
