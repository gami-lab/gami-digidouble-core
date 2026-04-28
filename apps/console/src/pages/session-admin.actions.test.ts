import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import { listSessions, resetSession } from '../api/sessions'
import { loadSessions, performResetSession } from './SessionAdminPage'

vi.mock('../api/sessions', () => ({
  listSessions: vi.fn(),
  resetSession: vi.fn(),
}))

describe('session admin actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('window', { confirm: vi.fn(() => true) })
  })

  it('loads sessions with scenario filter and updates loading/error state', async () => {
    const sessions = [
      {
        sessionId: 'session_1',
        userId: 'user_1',
        scenarioId: 'scenario_1',
        status: 'active' as const,
        startedAt: '2026-04-28T00:00:00.000Z',
        lastActivityAt: '2026-04-28T00:01:00.000Z',
      },
    ]
    vi.mocked(listSessions).mockResolvedValue(sessions)

    const setSessions = vi.fn()
    const setIsLoading = vi.fn()
    const setListError = vi.fn()

    await loadSessions('scenario_1', setSessions, setIsLoading, setListError)

    expect(listSessions).toHaveBeenCalledWith({ scenarioId: 'scenario_1' })
    expect(setSessions).toHaveBeenCalledWith(sessions)
    expect(setListError).toHaveBeenCalledWith(null)
    expect(setIsLoading).toHaveBeenNthCalledWith(1, true)
    expect(setIsLoading).toHaveBeenLastCalledWith(false)
  })

  it('maps NOT_FOUND reset errors to a clear operator message', async () => {
    vi.mocked(resetSession).mockRejectedValue(new ApiError('NOT_FOUND', 'Missing session'))

    const onReset = vi.fn()
    const setIsResetting = vi.fn()
    const setResetError = vi.fn()

    await performResetSession('session_1', onReset, setIsResetting, setResetError)

    expect(onReset).not.toHaveBeenCalled()
    expect(setResetError).toHaveBeenCalledWith('Session not found.')
    expect(setIsResetting).toHaveBeenNthCalledWith(1, true)
    expect(setIsResetting).toHaveBeenLastCalledWith(false)
  })
})
