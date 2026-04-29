import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import { inspectSession, listSessionEvents } from '../api/sessions'
import { loadGmDebugPanelData } from './GmDebugPanel'

vi.mock('../api/sessions', () => ({
  inspectSession: vi.fn(),
  listSessionEvents: vi.fn(),
}))

const makeInspectResponse = () => ({
  inspect: {
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
})

const makeEventsResponse = () => ({
  events: [
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

  it('calls inspectSession and listSessionEvents in parallel and returns combined result', async () => {
    vi.mocked(inspectSession).mockResolvedValue(makeInspectResponse())
    vi.mocked(listSessionEvents).mockResolvedValue(makeEventsResponse())

    const result = await loadGmDebugPanelData('session_1')

    expect(inspectSession).toHaveBeenCalledWith('session_1')
    expect(listSessionEvents).toHaveBeenCalledWith('session_1', { limit: 20 })
    expect(result.inspect).toEqual(makeInspectResponse().inspect)
    expect(result.events).toEqual(makeEventsResponse().events)
  })

  it('propagates errors thrown by inspectSession without swallowing', async () => {
    vi.mocked(inspectSession).mockRejectedValue(new ApiError('NOT_FOUND', 'Session not found'))
    vi.mocked(listSessionEvents).mockResolvedValue(makeEventsResponse())

    await expect(loadGmDebugPanelData('session_missing')).rejects.toThrow('Session not found')
  })

  it('propagates errors thrown by listSessionEvents without swallowing', async () => {
    vi.mocked(inspectSession).mockResolvedValue(makeInspectResponse())
    vi.mocked(listSessionEvents).mockRejectedValue(new ApiError('NOT_FOUND', 'Session not found'))

    await expect(loadGmDebugPanelData('session_missing')).rejects.toThrow('Session not found')
  })
})
