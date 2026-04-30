import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ILlmAdapter, LlmRequest, LlmResponse } from '../../application/ports/ILlmAdapter.js'
import { LlmError } from '../llm/llm.error.js'
import { LlmProbe } from './llm.probe.js'

function createAdapterMock(
  completeImpl?: (request: LlmRequest) => Promise<LlmResponse>,
): ILlmAdapter {
  return {
    complete:
      completeImpl ??
      (vi.fn().mockResolvedValue({
        content: 'pong',
        model: 'null',
        inputTokens: 1,
        outputTokens: 1,
        latencyMs: 1,
      }) as ILlmAdapter['complete']),
  }
}

describe('LlmProbe', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns healthy when adapter call succeeds', async () => {
    const complete = vi.fn().mockResolvedValue({
      content: 'pong',
      model: 'null',
      inputTokens: 1,
      outputTokens: 1,
      latencyMs: 1,
    })
    const probe = new LlmProbe(createAdapterMock(complete))

    const result = await probe.probe()

    expect(result.name).toBe('llm')
    expect(result.status).toBe('healthy')
    expect(typeof result.latencyMs).toBe('number')
    expect(complete).toHaveBeenCalledWith({
      systemPrompt: 'ping',
      messages: [{ role: 'user', content: 'ping' }],
      maxTokens: 1,
    })
  })

  it('returns degraded when adapter throws LlmError', async () => {
    const probe = new LlmProbe(
      createAdapterMock(() => {
        throw new LlmError('openai', 'provider unavailable')
      }),
    )

    const result = await probe.probe()

    expect(result).toMatchObject({
      name: 'llm',
      status: 'degraded',
      message: 'provider unavailable',
    })
  })

  it('returns degraded when adapter throws a generic error', async () => {
    const probe = new LlmProbe(
      createAdapterMock(() => {
        throw new Error('unexpected failure')
      }),
    )

    const result = await probe.probe()

    expect(result).toMatchObject({
      name: 'llm',
      status: 'degraded',
      message: 'unexpected failure',
    })
  })

  it('returns degraded on timeout within 3.1 seconds', async () => {
    vi.useFakeTimers()
    const probe = new LlmProbe(
      createAdapterMock(async () => await new Promise<LlmResponse>(() => undefined)),
    )

    const startedAt = Date.now()
    const probePromise = probe.probe()

    await vi.advanceTimersByTimeAsync(3_000)
    const result = await probePromise
    const elapsedMs = Date.now() - startedAt

    expect(result).toMatchObject({
      name: 'llm',
      status: 'degraded',
      message: 'probe timed out',
    })
    expect(elapsedMs).toBeLessThanOrEqual(3_100)
  })
})
