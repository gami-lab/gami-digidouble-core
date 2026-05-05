import { describe, expect, it, vi } from 'vitest'
import type { RuntimeEvent } from '@gami/shared'
import { InMemorySessionEventPublisher } from './in-memory-session-event-publisher.js'

const buildEvent = (overrides: Partial<RuntimeEvent> = {}): RuntimeEvent => ({
  eventId: 'evt-1',
  sessionId: 'session-1',
  type: 'runtime.processing_started',
  occurredAt: '2026-05-05T08:00:00.000Z',
  payload: {},
  ...overrides,
})

describe('InMemorySessionEventPublisher', () => {
  it('emit with no subscribers stores event without errors', () => {
    const publisher = new InMemorySessionEventPublisher()
    const event = buildEvent()

    publisher.emit(event)

    expect(publisher.getLastEvent('session-1')).toEqual(event)
  })

  it('subscribe and receive event calls handler with event', () => {
    const publisher = new InMemorySessionEventPublisher()
    const handler = vi.fn()
    const event = buildEvent()

    publisher.subscribe('session-1', handler)
    publisher.emit(event)

    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith(event)
  })

  it('unsubscribe stops delivery', () => {
    const publisher = new InMemorySessionEventPublisher()
    const handler = vi.fn()
    const event = buildEvent()

    const unsubscribe = publisher.subscribe('session-1', handler)
    unsubscribe()
    publisher.emit(event)

    expect(handler).not.toHaveBeenCalled()
  })

  it('session isolation delivers only to matching session subscribers', () => {
    const publisher = new InMemorySessionEventPublisher()
    const handlerA = vi.fn()
    const handlerB = vi.fn()

    publisher.subscribe('session-a', handlerA)
    publisher.subscribe('session-b', handlerB)

    const eventForB = buildEvent({
      eventId: 'evt-2',
      sessionId: 'session-b',
      type: 'runtime.processing_finished',
    })

    publisher.emit(eventForB)

    expect(handlerA).not.toHaveBeenCalled()
    expect(handlerB).toHaveBeenCalledTimes(1)
    expect(handlerB).toHaveBeenCalledWith(eventForB)
  })

  it('multiple subscribers same session receive same event', () => {
    const publisher = new InMemorySessionEventPublisher()
    const handler1 = vi.fn()
    const handler2 = vi.fn()
    const event = buildEvent()

    publisher.subscribe('session-1', handler1)
    publisher.subscribe('session-1', handler2)

    publisher.emit(event)

    expect(handler1).toHaveBeenCalledTimes(1)
    expect(handler2).toHaveBeenCalledTimes(1)
    expect(handler1).toHaveBeenCalledWith(event)
    expect(handler2).toHaveBeenCalledWith(event)
  })

  it('getLastEvent returns undefined for unknown session', () => {
    const publisher = new InMemorySessionEventPublisher()

    expect(publisher.getLastEvent('missing-session')).toBeUndefined()
  })

  it('getLastEvent returns most recent event after multiple emits', () => {
    const publisher = new InMemorySessionEventPublisher()
    const first = buildEvent({ eventId: 'evt-1' })
    const second = buildEvent({
      eventId: 'evt-2',
      type: 'runtime.processing_finished',
    })

    publisher.emit(first)
    publisher.emit(second)

    expect(publisher.getLastEvent('session-1')).toEqual(second)
  })

  it('isProcessing returns true only after setProcessing true', () => {
    const publisher = new InMemorySessionEventPublisher()

    expect(publisher.isProcessing('session-1')).toBe(false)

    publisher.setProcessing('session-1', true)

    expect(publisher.isProcessing('session-1')).toBe(true)
  })

  it('setProcessing false clears processing state', () => {
    const publisher = new InMemorySessionEventPublisher()

    publisher.setProcessing('session-1', true)
    expect(publisher.isProcessing('session-1')).toBe(true)

    publisher.setProcessing('session-1', false)

    expect(publisher.isProcessing('session-1')).toBe(false)
  })

  it('processing state is isolated per session', () => {
    const publisher = new InMemorySessionEventPublisher()

    publisher.setProcessing('session-a', true)

    expect(publisher.isProcessing('session-a')).toBe(true)
    expect(publisher.isProcessing('session-b')).toBe(false)
  })
})
