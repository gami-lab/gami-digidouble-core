/**
 * Unit tests for SendRawMessageUseCase.
 *
 * When asserting on the observability trace, think from the consumer side:
 * what must the trace contain for it to be useful? Assert every field that
 * a downstream consumer (e.g. Langfuse dashboard, alerting) needs, not
 * only the fields the implementation happened to set at the time of writing.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LlmRequest, LlmResponse } from '../../ports/ILlmAdapter.js'
import { SendRawMessageUseCase } from './send-raw-message.use-case.js'

// ── Test doubles ─────────────────────────────────────────────────────────────

const completeMock = vi.fn()

const llm = { complete: completeMock }

function makeDefaultResponse(overrides: Partial<LlmResponse> = {}): LlmResponse {
  return {
    content: 'Hello from the model.',
    model: 'null',
    inputTokens: 10,
    outputTokens: 20,
    latencyMs: 5,
    ...overrides,
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('SendRawMessageUseCase', () => {
  let useCase: SendRawMessageUseCase

  beforeEach(() => {
    completeMock.mockReset()
    completeMock.mockResolvedValue(makeDefaultResponse())
    useCase = new SendRawMessageUseCase(llm)
  })

  it('returns a valid SendRawMessageOutput on the happy path', async () => {
    const output = await useCase.execute({ userMessage: 'Hi there' })

    expect(output.reply).toBe('Hello from the model.')
    expect(output.model).toBe('null')
    expect(output.inputTokens).toBe(10)
    expect(output.outputTokens).toBe(20)
    expect(output.latencyMs).toBeGreaterThanOrEqual(0)
  })

  it('generates a non-empty requestId (UUID format) for every call', async () => {
    const output = await useCase.execute({ userMessage: 'Hi' })
    expect(output.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
  })

  it('generates a unique requestId per call', async () => {
    const [a, b] = await Promise.all([
      useCase.execute({ userMessage: 'first' }),
      useCase.execute({ userMessage: 'second' }),
    ])
    expect(a.requestId).not.toBe(b.requestId)
  })

  it('passes requestId to the LLM trace context', async () => {
    const output = await useCase.execute({ userMessage: 'ping' })

    const llmArg = completeMock.mock.calls[0]?.[0] as LlmRequest
    expect(llmArg.trace?.requestId).toBe(output.requestId)
    expect(llmArg.trace?.metadata).toEqual({ surface: 'send_raw_message' })
  })

  it('passes the default system prompt when none is provided', async () => {
    await useCase.execute({ userMessage: 'Hello' })

    const llmArg = completeMock.mock.calls[0]?.[0] as LlmRequest
    expect(llmArg.systemPrompt).toBe('You are a helpful assistant.')
  })

  it('forwards a custom systemPrompt to the LLM request', async () => {
    await useCase.execute({ userMessage: 'Hello', systemPrompt: 'You are a pirate.' })

    const llmArg = completeMock.mock.calls[0]?.[0] as LlmRequest
    expect(llmArg.systemPrompt).toBe('You are a pirate.')
  })

  it('forwards the userMessage as the first user turn', async () => {
    await useCase.execute({ userMessage: 'Tell me a joke.' })

    const llmArg = completeMock.mock.calls[0]?.[0] as LlmRequest
    expect(llmArg.messages).toHaveLength(1)
    expect(llmArg.messages[0]).toEqual({ role: 'user', content: 'Tell me a joke.' })
  })

  it('propagates LLM errors to the caller', async () => {
    completeMock.mockRejectedValue(new Error('LLM timeout'))
    await expect(useCase.execute({ userMessage: 'Hi' })).rejects.toThrow('LLM timeout')
  })
})
