import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LlmRequest, LlmResponse } from '../../ports/ILlmAdapter.js'
import type { TraceEvent } from '../../ports/IObservabilityAdapter.js'
import { SendRawMessageUseCase } from './send-raw-message.use-case.js'
import { expectConsoleError } from '../../../test-utils/console.js'

// ── Test doubles ─────────────────────────────────────────────────────────────

const completeMock = vi.fn()
const traceMock = vi.fn()
const flushMock = vi.fn()

const llm = { complete: completeMock }
const observability = { trace: traceMock, flush: flushMock }

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
    traceMock.mockReset()
    flushMock.mockReset()
    completeMock.mockResolvedValue(makeDefaultResponse())
    traceMock.mockResolvedValue(undefined)
    flushMock.mockResolvedValue(undefined)
    useCase = new SendRawMessageUseCase(llm, observability)
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

  it('calls observability.trace() exactly once per execute()', async () => {
    await useCase.execute({ userMessage: 'ping' })
    await new Promise((r) => setTimeout(r, 0))
    expect(traceMock).toHaveBeenCalledOnce()
  })

  it('passes requestId and token counts to the trace event', async () => {
    const output = await useCase.execute({ userMessage: 'ping' })
    await new Promise((r) => setTimeout(r, 0))

    const traceArg = traceMock.mock.calls[0]?.[0] as TraceEvent
    expect(traceArg.requestId).toBe(output.requestId)
    expect(traceArg.inputTokens).toBe(output.inputTokens)
    expect(traceArg.outputTokens).toBe(output.outputTokens)
    expect(traceArg.event).toBe('llm.completion')
  })

  it('passes the messages array as input and the reply as output in the trace event', async () => {
    await useCase.execute({ userMessage: 'Tell me a joke.' })
    await new Promise((r) => setTimeout(r, 0))

    const traceArg = traceMock.mock.calls[0]?.[0] as TraceEvent
    expect(traceArg.input).toEqual([{ role: 'user', content: 'Tell me a joke.' }])
    expect(traceArg.output).toBe('Hello from the model.')
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

  it('does not crash when observability.trace() rejects', async () => {
    traceMock.mockRejectedValue(new Error('Langfuse down'))
    const result = await expectConsoleError(
      () => useCase.execute({ userMessage: 'Hi' }),
      /Observability trace failed.*Langfuse down/,
    )
    expect(result).toBeDefined()
  })

  it('propagates LLM errors to the caller', async () => {
    completeMock.mockRejectedValue(new Error('LLM timeout'))
    await expect(useCase.execute({ userMessage: 'Hi' })).rejects.toThrow('LLM timeout')
  })
})
