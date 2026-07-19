import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import { deleteAvatar, updateAvatar } from '../api/scenarios'
import { performDeleteAvatar, performUpdateAvatar } from './avatar-row'

vi.mock('../api/scenarios', () => ({
  updateAvatar: vi.fn(),
  deleteAvatar: vi.fn(),
}))

describe('avatar-row actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('window', { confirm: vi.fn(() => true) })
  })

  it('updates avatar payload and forwards result', async () => {
    const updated = {
      avatarId: 'avatar_1',
      scenarioId: 'scenario_1',
      name: 'Guide',
      status: 'active' as const,
      personaPrompt: 'Focused prompt',
      tone: 'calm',
      description: 'desc',
      computedTraits: null,
      config: {},
      createdAt: '2026-04-28T00:00:00.000Z',
      updatedAt: '2026-04-28T00:01:00.000Z',
    }
    vi.mocked(updateAvatar).mockResolvedValue(updated)

    const onSaved = vi.fn()
    const setSubmitError = vi.fn()
    const setIsSubmitting = vi.fn()

    await performUpdateAvatar(
      'avatar_1',
      {
        name: 'Guide',
        personaPrompt: 'Focused prompt',
        tone: 'calm',
        description: 'desc',
        llmProviderOverride: '',
        llmModelOverride: '',
      },
      onSaved,
      setSubmitError,
      setIsSubmitting,
    )

    expect(updateAvatar).toHaveBeenCalledWith('avatar_1', {
      name: 'Guide',
      personaPrompt: 'Focused prompt',
      tone: 'calm',
      description: 'desc',
      llmOverride: null,
    })
    expect(onSaved).toHaveBeenCalledWith(updated)
    expect(setSubmitError).toHaveBeenCalledWith(null)
    expect(setIsSubmitting).toHaveBeenNthCalledWith(1, true)
    expect(setIsSubmitting).toHaveBeenLastCalledWith(false)
  })

  it('maps CONFLICT delete errors to a clear operator message', async () => {
    vi.mocked(deleteAvatar).mockRejectedValue(new ApiError('CONFLICT', 'active sessions'))

    const onDeleted = vi.fn()
    const setDeleteError = vi.fn()

    await performDeleteAvatar('avatar_1', onDeleted, setDeleteError)

    expect(onDeleted).not.toHaveBeenCalled()
    expect(setDeleteError).toHaveBeenCalledWith('Cannot delete: avatar has active sessions.')
  })
})
