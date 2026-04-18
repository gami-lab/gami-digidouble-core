import type { AvatarConfig } from './avatar.types.js'

/**
 * Shared avatar config test fixture factory.
 */
export function makeAvatarConfig(overrides: Partial<AvatarConfig> = {}): AvatarConfig {
  return {
    avatarId: 'avatar-1',
    scenarioId: 'scenario-1',
    name: 'Ava',
    slug: 'ava',
    status: 'active',
    personaPrompt: 'You are Ava, a warm and curious guide.',
    tone: 'warm and curious',
    description: 'Friendly onboarding guide avatar',
    config: {
      responseConstraints: {
        maxSentences: 4,
      },
      uiHints: {
        accentColor: '#6C5CE7',
      },
    },
    ...overrides,
  }
}
