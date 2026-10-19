import { describe, expect, it } from 'vitest'
import type { RuntimeEvent } from '@gami/shared'
import {
  createRuntimeMomentsState,
  currentMediaMoment,
  dismissMoment,
  finishMedia,
  markMediaStarted,
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

describe('runtime media cues', () => {
  function cueEvent(cueId: string, eventId = `event_${cueId}`): RuntimeEvent {
    return event({
      eventId,
      type: 'runtime.media_cue',
      payload: {
        cueId,
        origin: 'game_master',
        display: 'overlay',
        asset: {
          assetId: 'media_1',
          kind: 'image',
          url: '/v1/media/media_1',
          description: 'A map',
        },
      },
    })
  }

  it('queues cues in arrival order and ignores repeats of the same cue', () => {
    const state = receive([cueEvent('cue_a'), cueEvent('cue_b'), cueEvent('cue_a', 'event_again')])

    expect(state.media.map((moment) => moment.cue.cueId)).toEqual(['cue_a', 'cue_b'])
  })

  it('ignores malformed cues and cues of another session', () => {
    const state = receive([
      event({ type: 'runtime.media_cue', payload: { cueId: 'cue_x' } }),
      { ...cueEvent('cue_y'), sessionId: 'session_2' },
    ])

    expect(state.media).toEqual([])
  })

  it('waits while the character is busy, then keeps a started cue until it ends', () => {
    let state = receive([cueEvent('cue_a'), cueEvent('cue_b')])
    expect(currentMediaMoment(state, { busy: true })).toBeNull()
    expect(currentMediaMoment(state, { busy: false })?.cue.cueId).toBe('cue_a')

    state = markMediaStarted(state, 'cue_a')
    expect(currentMediaMoment(state, { busy: true })?.cue.cueId).toBe('cue_a')

    state = finishMedia(state, 'cue_a')
    expect(currentMediaMoment(state, { busy: false })?.cue.cueId).toBe('cue_b')
  })
})
