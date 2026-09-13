import { describe, expect, it } from 'vitest'
import type {
  AvatarSummary,
  ConversationSummary,
  EndConversationResponse,
  ScenarioSummary,
  SessionSummary,
} from './index.js'

describe('canonical entity contracts', () => {
  it('uses current field names and explicit nullable fields', () => {
    const avatar: AvatarSummary = {
      avatarId: 'avatar_1',
      scenarioId: 'scenario_1',
      name: 'Guide',
      personaPrompt: 'You are a guide.',
      status: 'active',
      availabilityKey: 'guide',
      computedTraits: null,
      config: { availabilityKey: 'guide' },
      createdAt: '2026-09-13T00:00:00.000Z',
      updatedAt: '2026-09-13T00:00:00.000Z',
    }
    const scenario: ScenarioSummary = {
      scenarioId: 'scenario_1',
      name: 'Scenario',
      status: 'active',
      language: 'fr-CH',
      objectives: [],
      worldContext: '',
      avatarAvailability: { initialAvatarIds: ['avatar_1'] },
      config: {},
      createdAt: '2026-09-13T00:00:00.000Z',
      updatedAt: '2026-09-13T00:00:00.000Z',
    }
    const session: SessionSummary = {
      sessionId: 'session_1',
      userId: 'user_1',
      scenarioId: scenario.scenarioId,
      status: 'active',
      startedAt: '2026-09-13T00:00:00.000Z',
      lastActivityAt: '2026-09-13T00:00:00.000Z',
    }
    const conversation: ConversationSummary = {
      conversationId: 'conversation_1',
      sessionId: session.sessionId,
      avatarId: avatar.avatarId,
      status: 'closed',
      startedAt: '2026-09-13T00:00:00.000Z',
      lastActivityAt: '2026-09-13T00:00:00.000Z',
      endedAt: '2026-09-13T00:01:00.000Z',
    }
    const endResponse: EndConversationResponse = {
      conversation,
      compaction: { scheduled: true },
    }

    expect(avatar.availabilityKey).toBe('guide')
    expect(avatar.computedTraits).toBeNull()
    expect(endResponse.conversation).toBe(conversation)
  })
})
