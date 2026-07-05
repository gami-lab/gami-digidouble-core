// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react'
import type { LocalWebIdentity, RuntimeEvent } from '@gami/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { subscribeToRuntimeEvents } from '../api/runtime-events-stream'
import { listAvailableScenarios } from '../api/scenarios'
import { ensureActiveSession, getAvailableAvatarsForSession } from '../api/sessions'
import { useScenarioAvatarDiscovery } from './use-scenario-avatar-discovery'

vi.mock('../api/scenarios', () => ({
  listAvailableScenarios: vi.fn(),
}))

vi.mock('../api/sessions', () => ({
  ensureActiveSession: vi.fn(),
  getAvailableAvatarsForSession: vi.fn(),
}))

vi.mock('../api/runtime-events-stream', () => ({
  subscribeToRuntimeEvents: vi.fn(),
}))

const identity: LocalWebIdentity = {
  version: 1,
  userId: 'user_12345678',
  persona: {},
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
}

// eslint-disable-next-line max-lines-per-function
describe('useScenarioAvatarDiscovery behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
    vi.mocked(listAvailableScenarios).mockResolvedValue([
      {
        scenarioId: 'scenario_1',
        name: 'Scenario 1',
        status: 'active',
        objectives: [],
        worldContext: '',
        avatarAvailability: { initialAvatarIds: [] },
        config: {},
        createdAt: '2026-06-01T00:00:00.000Z',
        updatedAt: '2026-06-01T00:00:00.000Z',
      },
    ])
    vi.mocked(ensureActiveSession).mockResolvedValue({
      sessionId: 'session_1',
      userId: identity.userId,
      scenarioId: 'scenario_1',
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
          personaPrompt: 'Prompt 1',
          createdAt: '2026-06-01T00:00:00.000Z',
          updatedAt: '2026-06-01T00:00:00.000Z',
        },
      ])
      .mockResolvedValueOnce([
        {
          avatarId: 'avatar_1',
          scenarioId: 'scenario_1',
          name: 'Avatar 1',
          status: 'active',
          personaPrompt: 'Prompt 1',
          createdAt: '2026-06-01T00:00:00.000Z',
          updatedAt: '2026-06-01T00:00:00.000Z',
        },
      ])
      .mockResolvedValueOnce([
        {
          avatarId: 'avatar_1',
          scenarioId: 'scenario_1',
          name: 'Avatar 1',
          status: 'active',
          personaPrompt: 'Prompt 1',
          createdAt: '2026-06-01T00:00:00.000Z',
          updatedAt: '2026-06-01T00:00:00.000Z',
        },
        {
          avatarId: 'avatar_2',
          scenarioId: 'scenario_1',
          name: 'Avatar 2',
          status: 'active',
          personaPrompt: 'Prompt 2',
          createdAt: '2026-06-01T00:00:00.000Z',
          updatedAt: '2026-06-01T00:00:00.000Z',
        },
      ])

    const { result, unmount } = renderHook(() => useScenarioAvatarDiscovery(identity))

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
          personaPrompt: 'Prompt 1',
          createdAt: '2026-06-01T00:00:00.000Z',
          updatedAt: '2026-06-01T00:00:00.000Z',
        },
      ])
      .mockResolvedValueOnce([
        {
          avatarId: 'avatar_1',
          scenarioId: 'scenario_1',
          name: 'Avatar 1',
          status: 'active',
          personaPrompt: 'Prompt 1',
          createdAt: '2026-06-01T00:00:00.000Z',
          updatedAt: '2026-06-01T00:00:00.000Z',
        },
      ])
      .mockResolvedValueOnce([
        {
          avatarId: 'avatar_1',
          scenarioId: 'scenario_1',
          name: 'Avatar 1',
          status: 'active',
          personaPrompt: 'Prompt 1',
          createdAt: '2026-06-01T00:00:00.000Z',
          updatedAt: '2026-06-01T00:00:00.000Z',
        },
        {
          avatarId: 'avatar_2',
          scenarioId: 'scenario_1',
          name: 'Avatar 2',
          status: 'active',
          personaPrompt: 'Prompt 2',
          createdAt: '2026-06-01T00:00:00.000Z',
          updatedAt: '2026-06-01T00:00:00.000Z',
        },
      ])

    const { result } = renderHook(() => useScenarioAvatarDiscovery(identity))

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
        personaPrompt: 'Prompt 1',
        createdAt: '2026-06-01T00:00:00.000Z',
        updatedAt: '2026-06-01T00:00:00.000Z',
      },
    ])
    vi.mocked(getAvailableAvatarsForSession).mockResolvedValueOnce([
      {
        avatarId: 'avatar_1',
        scenarioId: 'scenario_1',
        name: 'Avatar 1',
        status: 'active',
        personaPrompt: 'Prompt 1',
        createdAt: '2026-06-01T00:00:00.000Z',
        updatedAt: '2026-06-01T00:00:00.000Z',
      },
    ])

    const { result } = renderHook(() => useScenarioAvatarDiscovery(identity))

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
