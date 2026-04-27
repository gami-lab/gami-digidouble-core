import { describe, expect, it } from 'vitest'
import type { AvailableAvatarSummary, ConversationSummary, SessionSummary } from '../api'
import {
  createInitialScenarioTestState,
  deriveAvatarAvailabilityEntries,
  deriveConversationTimeline,
  withAvailableAvatarsRefreshed,
  withConversationAdded,
  withSessionStarted,
} from './scenario-test-state'

function makeAvatar(avatarId: string, name: string): AvailableAvatarSummary {
  return {
    avatarId,
    scenarioId: 'scenario_1',
    name,
    status: 'active',
    personaPrompt: `${name} persona`,
    createdAt: '2026-04-22T00:00:00.000Z',
    updatedAt: '2026-04-22T00:00:00.000Z',
  }
}

function makeSession(activeAvatarId: string | null): SessionSummary {
  return {
    sessionId: 'session_1',
    userId: 'tester',
    scenarioId: 'scenario_1',
    activeAvatarId,
    status: 'active',
    startedAt: '2026-04-22T00:00:00.000Z',
    lastActivityAt: '2026-04-22T00:00:00.000Z',
    endedAt: null,
  }
}

function makeConversation(
  conversationId: string,
  avatarId: string,
  startedAt: string,
): ConversationSummary {
  return {
    conversationId,
    sessionId: 'session_1',
    avatarId,
    status: 'active',
    startedAt,
    lastActivityAt: startedAt,
    endedAt: null,
  }
}

describe('scenario-test-state availability', () => {
  it('derives locked, available, and active statuses correctly', () => {
    const guide = makeAvatar('avatar_guide', 'Guide')
    const ethics = makeAvatar('avatar_ethics', 'Ethics')
    const engineer = makeAvatar('avatar_engineer', 'Engineer')

    const initial = createInitialScenarioTestState()
    const started = withSessionStarted(initial, makeSession('avatar_ethics'), [
      'avatar_guide',
      'avatar_ethics',
    ])
    const state = {
      ...started,
      allScenarioAvatars: [guide, ethics, engineer],
    }

    const entries = deriveAvatarAvailabilityEntries(state)

    expect(entries).toHaveLength(3)
    expect(entries.map((entry) => [entry.avatar.avatarId, entry.status])).toEqual([
      ['avatar_guide', 'available'],
      ['avatar_ethics', 'active'],
      ['avatar_engineer', 'locked'],
    ])
  })
})

describe('scenario-test-state unlock tracking', () => {
  it('adds unlock events only for newly available avatars', () => {
    const guide = makeAvatar('avatar_guide', 'Guide')
    const ethicist = makeAvatar('avatar_ethics', 'Ethics Expert')
    const allAvatarsById = new Map<string, AvailableAvatarSummary>([
      [guide.avatarId, guide],
      [ethicist.avatarId, ethicist],
    ])

    const initial = {
      ...createInitialScenarioTestState(),
      availableAvatarIds: ['avatar_guide'],
      allScenarioAvatars: [guide, ethicist],
    }

    const refreshed = withAvailableAvatarsRefreshed(
      initial,
      ['avatar_guide', 'avatar_ethics'],
      makeSession('avatar_ethics'),
      ['avatar_guide'],
      2,
      allAvatarsById,
    )

    expect(refreshed.unlockEvents).toHaveLength(1)
    expect(refreshed.unlockEvents[0]).toEqual({
      avatarId: 'avatar_ethics',
      avatarName: 'Ethics Expert',
      reason: 'Unlocked based on topic detected in last message.',
      turnIndex: 2,
    })
  })
})

describe('scenario-test-state timeline', () => {
  it('sorts conversations chronologically and computes episode index per avatar', () => {
    const allAvatarsById = new Map<string, AvailableAvatarSummary>([
      ['avatar_guide', makeAvatar('avatar_guide', 'Guide')],
      ['avatar_ethics', makeAvatar('avatar_ethics', 'Ethics Expert')],
    ])

    const state = {
      ...createInitialScenarioTestState(),
      conversations: [
        makeConversation('conv_3', 'avatar_guide', '2026-04-22T00:03:00.000Z'),
        makeConversation('conv_1', 'avatar_guide', '2026-04-22T00:01:00.000Z'),
        makeConversation('conv_2', 'avatar_ethics', '2026-04-22T00:02:00.000Z'),
      ],
    }

    const timeline = deriveConversationTimeline(state, allAvatarsById)

    expect(timeline.map((item) => item.conversation.conversationId)).toEqual([
      'conv_1',
      'conv_2',
      'conv_3',
    ])
    expect(timeline.map((item) => [item.avatarName, item.episodeIndex])).toEqual([
      ['Guide', 1],
      ['Ethics Expert', 1],
      ['Guide', 2],
    ])
  })
})

describe('scenario-test-state conversation upsert', () => {
  it('upserts a conversation without creating duplicates', () => {
    const session = makeSession('avatar_guide')
    const initial = createInitialScenarioTestState()
    const first = makeConversation('conv_1', 'avatar_guide', '2026-04-22T00:01:00.000Z')
    const updated: ConversationSummary = {
      ...first,
      status: 'closed',
      lastActivityAt: '2026-04-22T00:05:00.000Z',
      endedAt: '2026-04-22T00:05:00.000Z',
    }

    const added = withConversationAdded(initial, first, session, true)
    const upserted = withConversationAdded(added, updated, session, false)

    expect(upserted.conversations).toHaveLength(1)
    expect(upserted.conversations[0]).toEqual(updated)
    expect(upserted.selectedConversationId).toBe('conv_1')
  })
})
