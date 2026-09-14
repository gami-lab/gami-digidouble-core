import type { MessageStreamEvent } from '@gami/shared'
import { describe, expect, it } from 'vitest'
import { isTerminalMessageStreamEvent } from './message-stream-events'

describe('message stream terminal events', () => {
  it.each([
    'conversation.message.completed',
    'conversation.message.interrupted',
    'conversation.message.error',
  ] as const)('recognizes %s as terminal', (type) => {
    expect(isTerminalMessageStreamEvent({ type } as MessageStreamEvent)).toBe(true)
  })

  it('does not treat started or delta events as terminal', () => {
    expect(
      isTerminalMessageStreamEvent({ type: 'conversation.message.started' } as MessageStreamEvent),
    ).toBe(false)
    expect(
      isTerminalMessageStreamEvent({ type: 'conversation.message.delta' } as MessageStreamEvent),
    ).toBe(false)
  })
})
