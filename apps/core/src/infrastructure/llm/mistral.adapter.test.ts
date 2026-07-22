import { MistralError } from '@mistralai/mistralai/models/errors'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LlmError } from './llm.error.js'
import { MistralAdapter } from './mistral.adapter.js'

// ── SDK mocks ────────────────────────────────────────────────────────────────

const mockComplete = vi.fn()
const mockStream = vi.fn()

vi.mock('@mistralai/mistralai', () => {
  const MockMistral = vi.fn().mockImplementation(() => ({
    chat: { complete: mockComplete, stream: mockStream },
  }))
  return { Mistral: MockMistral }
})

vi.mock('@mistralai/mistralai/models/errors', () => {
  class MockMistralError extends Error {
    statusCode: number
    constructor(message: string, statusCode = 500) {
      super(message)
      this.name = 'MistralError'
      this.statusCode = statusCode
    }
  }
  return { MistralError: MockMistralError }
})

// ── Helpers ─────────────────────────────────────────────────────────────────

function buildCompletion(text: string, model = 'mistral-small-latest') {
  return {
    id: 'cmpl-test',
    object: 'chat.completion',
    created: 0,
    model,
    choices: [
      {
        index: 0,
        finish_reason: 'stop',
        message: { role: 'assistant', content: text },
      },
    ],
    usage: { promptTokens: 10, completionTokens: 15, totalTokens: 25 },
  }
}

const request = {
  systemPrompt: 'You are a helpful assistant.',
  messages: [{ role: 'user' as const, content: 'Hello' }],
}

// ── Tests ────────────────────────────────────────────────────────────────────

// The adapter contract tests cover completion and streaming behavior together.
// eslint-disable-next-line max-lines-per-function
describe('MistralAdapter', () => {
  beforeEach(() => {
    mockComplete.mockReset()
    mockStream.mockReset()
  })

  it('maps a successful completion to LlmResponse', async () => {
    mockComplete.mockResolvedValue(buildCompletion('Hi there!'))
    const adapter = new MistralAdapter('test-key')
    const response = await adapter.complete(request)

    expect(response.content).toBe('Hi there!')
    expect(response.model).toBe('mistral-small-latest')
    expect(response.inputTokens).toBe(10)
    expect(response.outputTokens).toBe(15)
    expect(response.latencyMs).toBeGreaterThanOrEqual(0)
  })

  it('uses the model override from the request', async () => {
    mockComplete.mockResolvedValue(buildCompletion('ok', 'mistral-large-latest'))
    const adapter = new MistralAdapter('test-key')
    await adapter.complete({ ...request, model: 'mistral-large-latest' })

    const calledWith = mockComplete.mock.calls[0]?.[0] as { model: string }
    expect(calledWith.model).toBe('mistral-large-latest')
  })

  it('sends the system prompt as the first message', async () => {
    mockComplete.mockResolvedValue(buildCompletion('ok'))
    const adapter = new MistralAdapter('test-key')
    await adapter.complete(request)

    const messages = (
      mockComplete.mock.calls[0]?.[0] as { messages: Array<{ role: string; content: string }> }
    ).messages
    expect(messages[0]).toMatchObject({ role: 'system', content: 'You are a helpful assistant.' })
  })

  it('throws LlmError when API returns no choices', async () => {
    mockComplete.mockResolvedValue({ ...buildCompletion(''), choices: [] })
    const adapter = new MistralAdapter('test-key')

    await expect(adapter.complete(request)).rejects.toBeInstanceOf(LlmError)
  })

  it('wraps MistralError in LlmError with status code', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call
    const mistralErr = new (MistralError as any)('quota exceeded', 429) as MistralError
    mockComplete.mockRejectedValue(mistralErr)
    const adapter = new MistralAdapter('test-key')

    await expect(adapter.complete(request)).rejects.toMatchObject({
      provider: 'mistral',
      statusCode: 429,
      message: 'quota exceeded',
    })
    await expect(adapter.complete(request)).rejects.toBeInstanceOf(LlmError)
  })

  it('wraps generic errors in LlmError without status code', async () => {
    mockComplete.mockRejectedValue(new Error('network failure'))
    const adapter = new MistralAdapter('test-key')

    await expect(adapter.complete(request)).rejects.toMatchObject({
      provider: 'mistral',
      message: 'network failure',
      statusCode: undefined,
    })
  })

  it('extracts text from ContentChunk array content', async () => {
    mockComplete.mockResolvedValue({
      ...buildCompletion(''),
      choices: [
        {
          index: 0,
          finish_reason: 'stop',
          message: {
            role: 'assistant',
            content: [
              { type: 'text', text: 'Hello ' },
              { type: 'text', text: 'world' },
            ],
          },
        },
      ],
    })
    const adapter = new MistralAdapter('test-key')
    const response = await adapter.complete(request)
    expect(response.content).toBe('Hello world')
  })

  it('streams ordered deltas and terminal usage while forwarding cancellation', async () => {
    mockStream.mockResolvedValue(
      (function* () {
        yield {
          data: { model: 'mistral-small-latest', choices: [{ delta: { content: 'Hello ' } }] },
        }
        yield {
          data: { model: 'mistral-small-latest', choices: [{ delta: { content: 'world' } }] },
        }
        yield {
          data: {
            model: 'mistral-small-latest',
            choices: [],
            usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
          },
        }
      })(),
    )
    const controller = new AbortController()
    const adapter = new MistralAdapter('test-key')
    const events = []

    for await (const event of adapter.stream(request, { signal: controller.signal })) {
      events.push(event)
    }

    expect(events.map((event) => event.type)).toEqual(['delta', 'delta', 'completed'])
    expect(events[2]).toMatchObject({
      type: 'completed',
      response: {
        content: 'Hello world',
        model: 'mistral-small-latest',
        inputTokens: 10,
        outputTokens: 5,
      },
    })
    expect(mockStream.mock.calls[0]?.[1]).toMatchObject({ signal: controller.signal })
  })

  it('does not start the provider when already cancelled', async () => {
    const controller = new AbortController()
    controller.abort()
    const adapter = new MistralAdapter('test-key')

    await expect(async () => {
      for await (const event of adapter.stream(request, { signal: controller.signal })) {
        void event
      }
    }).rejects.toThrow(/aborted/i)
    expect(mockStream).not.toHaveBeenCalled()
  })
})
