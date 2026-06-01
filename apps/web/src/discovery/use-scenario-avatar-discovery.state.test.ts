import { describe, expect, it } from 'vitest'
import { createScenarioSelectionState } from './use-scenario-avatar-discovery'

describe('scenario selection state', () => {
  it('resets avatar/session state when a new scenario is selected', () => {
    expect(createScenarioSelectionState('scenario_42')).toEqual({
      selectedScenarioId: 'scenario_42',
      avatarStatus: 'loading',
      avatarError: null,
      avatars: [],
      session: null,
      lastAvatarSyncAt: null,
    })
  })
})
