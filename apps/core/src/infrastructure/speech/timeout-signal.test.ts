import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTimeoutSignal } from './timeout-signal.js'

describe('createTimeoutSignal', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('aborts and marks the signal after the timeout', async () => {
    vi.useFakeTimers()
    const timeout = createTimeoutSignal(undefined, 100)

    expect(timeout.signal.aborted).toBe(false)
    expect(timeout.timedOut()).toBe(false)

    await vi.advanceTimersByTimeAsync(100)

    expect(timeout.signal.aborted).toBe(true)
    expect(timeout.timedOut()).toBe(true)
    timeout.clear()
  })

  it('propagates caller cancellation without reporting a timeout', () => {
    const caller = new AbortController()
    const timeout = createTimeoutSignal(caller.signal, 1000)

    caller.abort()

    expect(timeout.signal.aborted).toBe(true)
    expect(timeout.timedOut()).toBe(false)
    timeout.clear()
  })

  it('clears the timeout before it fires', async () => {
    vi.useFakeTimers()
    const timeout = createTimeoutSignal(undefined, 100)
    timeout.clear()

    await vi.advanceTimersByTimeAsync(100)

    expect(timeout.signal.aborted).toBe(false)
    expect(timeout.timedOut()).toBe(false)
  })
})
