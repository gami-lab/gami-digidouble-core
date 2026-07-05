import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import { deleteScenario, updateScenario } from '../api/scenarios'
import { performDeleteScenario, performUpdateScenario } from './scenario-row'

vi.mock('../api/scenarios', () => ({
  updateScenario: vi.fn(),
  deleteScenario: vi.fn(),
}))

describe('scenario-row actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('window', { confirm: vi.fn(() => true) })
  })

  it('updates a scenario and forwards the saved value', async () => {
    const updated = {
      scenarioId: 'scenario_1',
      name: 'Updated name',
      status: 'active' as const,
      objectives: [],
      worldContext: '',
      avatarAvailability: { initialAvatarIds: [] },
      config: {},
      createdAt: '2026-04-28T00:00:00.000Z',
      updatedAt: '2026-04-28T00:01:00.000Z',
    }
    vi.mocked(updateScenario).mockResolvedValue(updated)

    const onSaved = vi.fn()
    const setSubmitError = vi.fn()
    const setIsSubmitting = vi.fn()

    await performUpdateScenario(
      'scenario_1',
      { name: 'Updated name', status: 'active' },
      onSaved,
      setSubmitError,
      setIsSubmitting,
    )

    expect(updateScenario).toHaveBeenCalledWith('scenario_1', {
      name: 'Updated name',
      status: 'active',
    })
    expect(onSaved).toHaveBeenCalledWith(updated)
    expect(setSubmitError).toHaveBeenCalledWith(null)
    expect(setIsSubmitting).toHaveBeenNthCalledWith(1, true)
    expect(setIsSubmitting).toHaveBeenLastCalledWith(false)
  })

  it('maps CONFLICT delete errors to a clear operator message', async () => {
    vi.mocked(deleteScenario).mockRejectedValue(new ApiError('CONFLICT', 'linked resources'))

    const onDeleted = vi.fn()
    const setDeleteError = vi.fn()

    await performDeleteScenario('scenario_1', onDeleted, setDeleteError)

    expect(onDeleted).not.toHaveBeenCalled()
    expect(setDeleteError).toHaveBeenCalledWith(
      'Cannot delete: scenario has avatars or active sessions.',
    )
  })
})
