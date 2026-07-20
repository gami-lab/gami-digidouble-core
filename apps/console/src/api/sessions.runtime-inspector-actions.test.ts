import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  AdminClearMemoryResponse,
  AdminRefreshMemoryResponse,
  AdminReplayGmResponse,
  AdminSessionContextResponse,
  UpsertUserPersonaResponse,
  UserPersona,
} from '@gami/shared'
import { coreRequest } from './client'
import {
  clearSessionMemory,
  getSessionContext,
  refreshSessionMemory,
  replayGm,
  upsertUserPersona,
} from './sessions'

vi.mock('./client', () => ({
  coreRequest: vi.fn(),
}))

describe('sessions runtime inspector action API wrappers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls replay GM endpoint with POST and returns typed payload', async () => {
    const payload: AdminReplayGmResponse = {
      sessionId: 'session_1',
      action: 'gm.replay',
      scheduled: true,
      correlationId: 'corr_1',
      conversationId: 'conversation_1',
      avatarId: 'avatar_1',
      turnIndex: 3,
    }
    vi.mocked(coreRequest).mockResolvedValue(payload)

    const result = await replayGm('session_1')

    expect(coreRequest).toHaveBeenCalledWith('POST', '/v1/admin/sessions/session_1/gm/replay')
    expect(result).toEqual(payload)
  })

  it('calls refresh memory and clear memory endpoints with POST', async () => {
    const refreshPayload: AdminRefreshMemoryResponse = {
      sessionId: 'session_1',
      action: 'memory.refresh',
      scheduled: true,
      correlationId: 'corr_2',
      conversationId: 'conversation_1',
      avatarId: 'avatar_1',
    }
    const clearPayload: AdminClearMemoryResponse = {
      sessionId: 'session_1',
      action: 'memory.clear',
      cleared: {
        sessionWorkingMemory: true,
        avatarWorkingMemoryCount: 1,
        gmNotesCleared: true,
        legacySessionSummaryCleared: true,
        userFactsCleared: false,
      },
    }
    vi.mocked(coreRequest).mockResolvedValueOnce(refreshPayload).mockResolvedValueOnce(clearPayload)

    const refresh = await refreshSessionMemory('session_1')
    const clear = await clearSessionMemory('session_1')

    expect(coreRequest).toHaveBeenNthCalledWith(
      1,
      'POST',
      '/v1/admin/sessions/session_1/memory/refresh',
    )
    expect(coreRequest).toHaveBeenNthCalledWith(
      2,
      'POST',
      '/v1/admin/sessions/session_1/memory/clear',
    )
    expect(refresh.action).toBe('memory.refresh')
    expect(clear.cleared.userFactsCleared).toBe(false)
  })

  it('calls context and persona endpoints with canonical shapes', async () => {
    const contextPayload: AdminSessionContextResponse = makeContextPayload()
    const personaPayload: UpsertUserPersonaResponse = {
      user: {
        userId: 'user_1',
        persona: { name: 'Maya', roleInWorld: 'student' },
        createdAt: '2026-05-07T10:00:00.000Z',
        updatedAt: '2026-05-07T10:00:00.000Z',
      },
    }

    const personaInput: UserPersona = {
      name: 'Maya',
      roleInWorld: 'student',
      avatarRelationships: ['Friend of Eva'],
      dialogGuidance: 'Ask one focused question.',
    }

    vi.mocked(coreRequest)
      .mockResolvedValueOnce(contextPayload)
      .mockResolvedValueOnce(personaPayload)

    const context = await getSessionContext('session_1')
    const updatedPersona = await upsertUserPersona('user_1', personaInput)

    expect(coreRequest).toHaveBeenNthCalledWith(1, 'GET', '/v1/admin/sessions/session_1/context')
    expect(coreRequest).toHaveBeenNthCalledWith(2, 'PUT', '/v1/users/user_1/persona', personaInput)
    expect(context.avatarContext.sections.worldContext.goals).toEqual(['Obj1'])
    expect(updatedPersona.user.persona?.name).toBe('Maya')
  })
})

function makeContextPayload(): AdminSessionContextResponse {
  return {
    sessionId: 'session_1',
    avatarContext: {
      sections: {
        directorNotes: null,
        responseRules: { items: [] },
        conversationState: {
          recentExchanges: [],
          workingMemory: {},
          longTermFacts: [],
        },
        userPersona: null,
        worldContext: {
          scenarioId: 'scenario_1',
          description: 'Scenario world',
          goals: ['Obj1'],
        },
      },
    },
    gmContext: {
      currentState: {
        progression: '',
        topicsCovered: [],
        interactionCount: 0,
      },
      availableAvatars: [],
      sections: {
        conversationState: {
          recentMessages: [],
          memory: {},
        },
        userPersona: null,
        worldContext: { scenarioId: 'scenario_1' },
      },
    },
    contextTrace: {
      deterministic: true,
      policy: {
        tokenBudget: { avatarMaxTokens: 4096, gmMaxTokens: 4096 },
        sectionPrecedence: [
          'directorNotes',
          'responseRules',
          'conversationState',
          'userPersona',
          'worldContext',
          'retrievedContext',
          'avatarTraits',
        ],
        protectedSegments: ['directorNotes', 'responseRules', 'worldContext'],
        precedence: [
          'directorNotes',
          'responseRules',
          'conversationStateWorkingMemory',
          'conversationStateLongTermFacts',
          'conversationStateRecentExchanges',
          'conversationStateRecentMessages',
          'userPersona',
          'worldContext',
          'retrievedContextMemory',
          'retrievedContextWorld',
          'retrievedContextMedia',
          'avatarTraits',
        ],
      },
      selectedInputs: {
        hasActiveAvatar: true,
        recentMessageCount: 0,
        shortTermExchangeCount: 0,
        hasWorkingMemory: false,
        longTermFactCount: 0,
        retrievalCounts: { memory: 0, world: 0, media: 0 },
        hasUserPersona: false,
        hasGmDirective: false,
        responseRuleCount: 0,
        hasAvatarTraits: false,
      },
      rationale: { avatarProjection: [], gmProjection: [] },
      selection: { kept: [], trimmed: [] },
    },
  }
}
