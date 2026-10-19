import { describe, expect, it } from 'vitest'
import type { RuntimeEvent } from '@gami/shared'
import {
  createRuntimeMomentsState,
  dismissMoment,
  receiveRuntimeEvent,
  visibleMoment,
  type MomentDisplayContext,
  type RuntimeMomentsState,
} from './runtime-moments'

function event(overrides: Partial<RuntimeEvent>): RuntimeEvent {
  return {
    eventId: 'event_1',
    sessionId: 'session_1',
    type: 'runtime.avatar_unlocked',
    occurredAt: '2026-10-19T00:00:00.000Z',
    payload: { unlockedAvatarIds: ['avatar_elias'] },
    ...overrides,
  }
}

const idle: MomentDisplayContext = {
  busy: false,
  activeAvatarId: 'avatar_clara',
  availableAvatarIds: ['avatar_clara', 'avatar_elias', 'avatar_margot'],
}

function receive(events: RuntimeEvent[]): RuntimeMomentsState {
  return events.reduce(receiveRuntimeEvent, createRuntimeMomentsState('session_1'))
}

describe('runtime moments', () => {
  it('stages an unlock as a moment for each newly unlocked character', () => {
    const state = receive([
      event({ payload: { unlockedAvatarIds: ['avatar_elias', 'avatar_margot'] } }),
    ])
    expect(state.queue.map((moment) => [moment.kind, moment.avatarId])).toEqual([
      ['unlocked', 'avatar_elias'],
      ['unlocked', 'avatar_margot'],
    ])
    expect(visibleMoment(state, idle)?.avatarId).toBe('avatar_elias')
  })

  it('defers moments while the character is thinking or speaking', () => {
    const state = receive([event({})])
    expect(visibleMoment(state, { ...idle, busy: true })).toBeNull()
    expect(visibleMoment(state, idle)?.avatarId).toBe('avatar_elias')
  })

  it('keeps suggestions and unlocks in arrival order and shows the next after dismissal', () => {
    const state = receive([
      event({}),
      event({
        eventId: 'event_2',
        type: 'runtime.avatar_suggested',
        payload: { suggestedAvatarId: 'avatar_margot', reason: 'GM INTERNAL REASON' },
      }),
    ])
    const first = visibleMoment(state, idle)
    expect(first?.kind).toBe('unlocked')

    const next = visibleMoment(dismissMoment(state, first?.momentId ?? ''), idle)
    expect(next).toEqual({ momentId: 'event_2', kind: 'suggested', avatarId: 'avatar_margot' })
    expect(JSON.stringify(next)).not.toContain('GM INTERNAL REASON')
  })

  it('renders a replayed event once and ignores other sessions and other event types', () => {
    const state = receive([
      event({}),
      event({}),
      event({ eventId: 'event_9', payload: { unlockedAvatarIds: ['avatar_elias'] } }),
      event({ eventId: 'event_3', sessionId: 'session_other' }),
      event({ eventId: 'event_4', type: 'runtime.processing_started', payload: {} }),
    ])
    expect(state.queue).toHaveLength(1)
  })

  it('skips a suggestion for the character already speaking with the visitor', () => {
    const state = receive([
      event({ type: 'runtime.avatar_suggested', payload: { suggestedAvatarId: 'avatar_clara' } }),
    ])
    expect(visibleMoment(state, idle)).toBeNull()
  })

  it('waits until the unlocked character appears in the available list', () => {
    const state = receive([event({})])
    expect(visibleMoment(state, { ...idle, availableAvatarIds: ['avatar_clara'] })).toBeNull()
  })

  it('ignores malformed payloads', () => {
    expect(
      receive([
        event({ payload: { unlockedAvatarIds: 'avatar_elias' } }),
        event({ eventId: 'e2', type: 'runtime.avatar_suggested', payload: {} }),
      ]).queue,
    ).toEqual([])
  })
})
