// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react'
import type { RuntimeEvent } from '@gami/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { subscribeToRuntimeEvents } from '../api/runtime-events-stream'
import { listAvailableScenarios } from '../api/scenarios'
import { ensureActiveSession, getAvailableAvatarsForSession, startSession } from '../api/sessions'
import { useScenarioAvatarDiscovery } from './use-scenario-avatar-discovery'

vi.mock('../api/scenarios', () => ({
  listAvailableScenarios: vi.fn(),
}))

vi.mock('../api/sessions', () => ({
  ensureActiveSession: vi.fn(),
  getAvailableAvatarsForSession: vi.fn(),
  startSession: vi.fn(),
}))

vi.mock('../api/runtime-events-stream', () => ({
  subscribeToRuntimeEvents: vi.fn(),
}))

const userId = 'user_12345678'

// eslint-disable-next-line max-lines-per-function -- retained fixture or orchestration setup is clearer together
describe('useScenarioAvatarDiscovery behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
    vi.mocked(listAvailableScenarios).mockResolvedValue([
      {
        scenarioId: 'scenario_1',
        name: 'Scenario 1',
      },
    ])
    vi.mocked(ensureActiveSession).mockResolvedValue({
      sessionId: 'session_1',
      userId: userId,
      scenarioId: 'scenario_1',
      unlockedAvatarIds: [],
      status: 'active',
      startedAt: '2026-06-01T00:00:00.000Z',
      lastActivityAt: '2026-06-01T00:00:00.000Z',
    })
  })

  it('refreshes available avatars when runtime avatar unlock events arrive', async () => {
    const close = vi.fn()
    let onEvent: ((event: RuntimeEvent) => void) | undefined
    vi.mocked(subscribeToRuntimeEvents).mockImplementation((_, handlers) => {
      onEvent = handlers.onEvent
      handlers.onOpen?.()
      return { close }
    })

    vi.mocked(getAvailableAvatarsForSession)
      .mockResolvedValueOnce([
        {
          avatarId: 'avatar_1',
          scenarioId: 'scenario_1',
          name: 'Avatar 1',
          status: 'active',
        },
      ])
      .mockResolvedValueOnce([
        {
          avatarId: 'avatar_1',
          scenarioId: 'scenario_1',
          name: 'Avatar 1',
          status: 'active',
        },
      ])
      .mockResolvedValueOnce([
        {
          avatarId: 'avatar_1',
          scenarioId: 'scenario_1',
          name: 'Avatar 1',
          status: 'active',
        },
        {
          avatarId: 'avatar_2',
          scenarioId: 'scenario_1',
          name: 'Avatar 2',
          status: 'active',
        },
      ])

    const { result, unmount } = renderHook(() => useScenarioAvatarDiscovery(userId))

    await waitFor(() => {
      expect(result.current.scenarioStatus).toBe('ready')
    })

    act(() => {
      result.current.selectScenario('scenario_1')
    })

    await waitFor(() => {
      expect(result.current.avatarStatus).toBe('ready')
      expect(result.current.avatars.map((avatar) => avatar.avatarId)).toEqual(['avatar_1'])
    })

    expect(onEvent).toBeDefined()

    act(() => {
      onEvent?.({
        eventId: 'event_1',
        sessionId: 'session_1',
        type: 'runtime.avatar_unlocked',
        occurredAt: '2026-06-01T00:00:01.000Z',
        payload: {},
      })
    })

    await waitFor(() => {
      expect(result.current.avatars.map((avatar) => avatar.avatarId)).toEqual([
        'avatar_1',
        'avatar_2',
      ])
    })

    unmount()
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('refreshes available avatars when the runtime stream reconnects', async () => {
    const close = vi.fn()
    let onOpen: (() => void) | undefined
    vi.mocked(subscribeToRuntimeEvents).mockImplementation((_, handlers) => {
      onOpen = handlers.onOpen
      handlers.onOpen?.()
      return { close }
    })

    vi.mocked(getAvailableAvatarsForSession)
      .mockResolvedValueOnce([
        {
          avatarId: 'avatar_1',
          scenarioId: 'scenario_1',
          name: 'Avatar 1',
          status: 'active',
        },
      ])
      .mockResolvedValueOnce([
        {
          avatarId: 'avatar_1',
          scenarioId: 'scenario_1',
          name: 'Avatar 1',
          status: 'active',
        },
      ])
      .mockResolvedValueOnce([
        {
          avatarId: 'avatar_1',
          scenarioId: 'scenario_1',
          name: 'Avatar 1',
          status: 'active',
        },
        {
          avatarId: 'avatar_2',
          scenarioId: 'scenario_1',
          name: 'Avatar 2',
          status: 'active',
        },
      ])

    const { result } = renderHook(() => useScenarioAvatarDiscovery(userId))

    await waitFor(() => {
      expect(result.current.scenarioStatus).toBe('ready')
    })

    act(() => {
      result.current.selectScenario('scenario_1')
    })

    await waitFor(() => {
      expect(result.current.avatars.map((avatar) => avatar.avatarId)).toEqual(['avatar_1'])
    })

    await act(async () => {
      onOpen?.()
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(result.current.avatars.map((avatar) => avatar.avatarId)).toEqual([
        'avatar_1',
        'avatar_2',
      ])
    })
  })

  it('does not start an interval polling loop for avatar availability', async () => {
    const setIntervalSpy = vi.spyOn(window, 'setInterval')

    vi.mocked(subscribeToRuntimeEvents).mockImplementation((_, handlers) => {
      handlers.onOpen?.()
      return { close: vi.fn() }
    })
    vi.mocked(getAvailableAvatarsForSession).mockResolvedValueOnce([
      {
        avatarId: 'avatar_1',
        scenarioId: 'scenario_1',
        name: 'Avatar 1',
        status: 'active',
      },
    ])
    vi.mocked(getAvailableAvatarsForSession).mockResolvedValueOnce([
      {
        avatarId: 'avatar_1',
        scenarioId: 'scenario_1',
        name: 'Avatar 1',
        status: 'active',
      },
    ])

    const { result } = renderHook(() => useScenarioAvatarDiscovery(userId))

    await waitFor(() => {
      expect(result.current.scenarioStatus).toBe('ready')
    })

    act(() => {
      result.current.selectScenario('scenario_1')
    })

    await waitFor(() => {
      expect(result.current.avatars.map((avatar) => avatar.avatarId)).toEqual(['avatar_1'])
    })

    expect(setIntervalSpy.mock.calls.some(([, timeout]) => timeout === 5_000)).toBe(false)
  })
})

describe('useScenarioAvatarDiscovery session lifecycle', () => {
  let onEvent: ((event: RuntimeEvent) => void) | undefined

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(listAvailableScenarios).mockResolvedValue([{ scenarioId: 'scenario_1', name: 'S' }])
    vi.mocked(ensureActiveSession).mockResolvedValue({
      sessionId: 'session_1',
      userId,
      scenarioId: 'scenario_1',
      unlockedAvatarIds: [],
      status: 'active',
      startedAt: '2026-06-01T00:00:00.000Z',
      lastActivityAt: '2026-06-01T00:00:00.000Z',
    })
    vi.mocked(getAvailableAvatarsForSession).mockResolvedValue([])
    vi.mocked(subscribeToRuntimeEvents).mockImplementation((_, handlers) => {
      onEvent = handlers.onEvent
      return { close: vi.fn() }
    })
  })

  async function renderWithSession() {
    const hook = renderHook(() =>
      useScenarioAvatarDiscovery(userId, { initialSelectedScenarioId: 'scenario_1' }),
    )
    await waitFor(() => {
      expect(hook.result.current.session?.sessionId).toBe('session_1')
    })
    return hook
  }

  function closedEvent(sessionId: string): RuntimeEvent {
    return {
      eventId: `closed_${sessionId}`,
      sessionId,
      type: 'runtime.session_closed',
      occurredAt: '2026-06-01T00:00:01.000Z',
      payload: {},
    }
  }

  it('reports the current session closed and ignores other sessions', async () => {
    const { result } = await renderWithSession()

    act(() => {
      onEvent?.(closedEvent('session_other'))
    })
    expect(result.current.sessionClosed).toBe(false)

    act(() => {
      onEvent?.(closedEvent('session_1'))
    })
    expect(result.current.sessionClosed).toBe(true)
  })

  it('starts a fresh session on restart', async () => {
    vi.mocked(startSession).mockResolvedValue({
      sessionId: 'session_2',
      userId,
      scenarioId: 'scenario_1',
      unlockedAvatarIds: [],
      status: 'active',
      startedAt: '2026-06-01T00:00:02.000Z',
      lastActivityAt: '2026-06-01T00:00:02.000Z',
    })
    const { result } = await renderWithSession()

    act(() => {
      result.current.restartSession()
    })

    await waitFor(() => {
      expect(result.current.session?.sessionId).toBe('session_2')
    })
    expect(startSession).toHaveBeenCalledWith({ scenarioId: 'scenario_1' })
    expect(result.current.sessionClosed).toBe(false)
  })
})
