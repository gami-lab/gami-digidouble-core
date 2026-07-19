import type { AvatarComputedTraits } from '@gami/shared'

export type PrepareScenarioAvatarTraitsInput = {
  scenarioId: string
}

export type AvatarTraitPreparationResult =
  | { avatarId: string; status: 'prepared'; computedTraits: AvatarComputedTraits }
  | { avatarId: string; status: 'failed'; reason: string }

export type PrepareScenarioAvatarTraitsOutput = {
  scenarioId: string
  results: AvatarTraitPreparationResult[]
}
