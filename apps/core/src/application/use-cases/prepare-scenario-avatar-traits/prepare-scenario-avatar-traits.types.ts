import type { AvatarTraitPreparationResult, PrepareAvatarTraitsResponse } from '@gami/shared'

export type { AvatarTraitPreparationResult }

export type PrepareScenarioAvatarTraitsInput = {
  scenarioId: string
}

/**
 * Structurally identical to the canonical `PrepareAvatarTraitsResponse`
 * shared DTO — the API route returns this use-case output directly.
 */
export type PrepareScenarioAvatarTraitsOutput = PrepareAvatarTraitsResponse
