// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { pickIdleHint, useIdleHint, type IdleScheduler } from './use-idle-hint'

function manualScheduler(): IdleScheduler & { fire: () => void; pending: () => number } {
  let callbacks: (() => void)[] = []
  return {
    schedule: (callback) => {
      callbacks.push(callback)
      return () => {
        callbacks = callbacks.filter((item) => item !== callback)
      }
    },
    fire: () => {
      const due = callbacks
      callbacks = []
      due.forEach((callback) => {
        callback()
      })
    },
    pending: () => callbacks.length,
  }
}

describe('idle hint', () => {
  it('appears after the idle period and disappears on visitor input', () => {
    const scheduler = manualScheduler()
    const { result, rerender } = renderHook(
      ({ activityKey }) => useIdleHint({ enabled: true, activityKey, scheduler }),
      { initialProps: { activityKey: 'a' } },
    )
    expect(result.current).toBe(false)

    act(() => {
      scheduler.fire()
    })
    expect(result.current).toBe(true)

    rerender({ activityKey: 'b' })
    expect(result.current).toBe(false)
  })

  it('shows once per idle period', () => {
    const scheduler = manualScheduler()
    const { result } = renderHook(() => useIdleHint({ enabled: true, activityKey: 'a', scheduler }))
    act(() => {
      scheduler.fire()
    })
    expect(result.current).toBe(true)
    expect(scheduler.pending()).toBe(0)
  })

  it('does not count time while the character is thinking or speaking', () => {
    const scheduler = manualScheduler()
    const { result, rerender } = renderHook(
      ({ enabled }) => useIdleHint({ enabled, activityKey: 'a', scheduler }),
      { initialProps: { enabled: false } },
    )
    expect(scheduler.pending()).toBe(0)

    rerender({ enabled: true })
    act(() => {
      scheduler.fire()
    })
    expect(result.current).toBe(true)

    rerender({ enabled: false })
    expect(result.current).toBe(false)
  })

  it('suggests the first starter question not asked yet', () => {
    expect(pickIdleHint(['Who are you?', 'Where were you?'], [' who are you? '])).toBe(
      'Where were you?',
    )
    expect(pickIdleHint(['Who are you?'], ['Who are you?'])).toBeNull()
    expect(pickIdleHint([], [])).toBeNull()
  })
})
