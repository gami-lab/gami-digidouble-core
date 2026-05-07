import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import { loadRuntimeInspectorViewModel } from '../api'
import { loadGmDebugPanelData } from './GmDebugPanel'

vi.mock('../api', () => ({
  loadRuntimeInspectorViewModel: vi.fn(),
}))

const makeRuntimeInspectorViewModel = () => ({
  session: {
    sessionId: 'session_1',
    userId: 'user_1',
    scenarioId: 'scenario_1',
    activeAvatarId: 'avatar_2',
    unlockedAvatarIds: ['avatar_1', 'avatar_2'],
    status: 'active' as const,
    startedAt: '2026-04-28T10:00:00.000Z',
    lastActivityAt: '2026-04-28T10:05:00.000Z',
  },
  runtimeState: {
    sessionId: 'session_1',
    canSendMessage: true,
    isProcessing: false,
    updatedAt: '2026-04-28T10:05:00.000Z',
  },
  gm: {
    gmState: {
      currentAvatarId: 'avatar_2',
      progression: 'intro',
      topicsCovered: ['setup'],
      interactionCount: 3,
    },
    transitionHistory: [],
    unlockedAvatarIds: ['avatar_1', 'avatar_2'],
    gmNotes: 'Guide toward reflection.',
  },
  memory: {
    summary: {
      sessionId: 'session_1',
      summary: 'summary',
      updatedAt: '2026-04-28T10:05:00.000Z',
    },
    layers: {
      sessionId: 'session_1',
      shortTerm: { exchangeCount: 2 as const, recentExchanges: [] },
      working: { avatars: [] },
      longTerm: { facts: [] },
    },
  },
  metrics: {
    summary: {
      totalTurns: 3,
      turnsWithGm: 3,
      avgAvatarLatencyMs: 100,
      avgTotalTurnLatencyMs: 150,
      avgInputTokens: 100,
      avgOutputTokens: 50,
      avgGmLatencyMs: 20,
    },
  },
  persona: null,
  recentEvents: [
    {
      type: 'gm_triggered' as const,
      correlationId: 'corr_1',
      createdAt: '2026-04-28T10:05:00.000Z',
      payload: {
        triggerReason: 'post_turn_observation',
        turnIndex: 3,
        interactionCount: 3,
        stateBefore: { progression: 'intro', topicsCovered: [] },
        latencyMs: 12,
      },
    },
  ],
})

describe('loadGmDebugPanelData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads composed runtime inspector data and returns gm panel fields', async () => {
    vi.mocked(loadRuntimeInspectorViewModel).mockResolvedValue(makeRuntimeInspectorViewModel())

    const result = await loadGmDebugPanelData('session_1')

    expect(loadRuntimeInspectorViewModel).toHaveBeenCalledWith('session_1', { eventsLimit: 20 })
    expect(result.inspect).toEqual({
      session: makeRuntimeInspectorViewModel().session,
      gmState: makeRuntimeInspectorViewModel().gm.gmState,
      transitionHistory: makeRuntimeInspectorViewModel().gm.transitionHistory,
      unlockedAvatarIds: makeRuntimeInspectorViewModel().gm.unlockedAvatarIds,
      gmNotes: makeRuntimeInspectorViewModel().gm.gmNotes,
    })
    expect(result.events).toEqual(makeRuntimeInspectorViewModel().recentEvents)
  })

  it('propagates errors thrown by runtime inspector loader without swallowing', async () => {
    vi.mocked(loadRuntimeInspectorViewModel).mockRejectedValue(
      new ApiError('NOT_FOUND', 'Session not found'),
    )

    await expect(loadGmDebugPanelData('session_missing')).rejects.toThrow('Session not found')
  })
})
