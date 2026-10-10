import type {
  AvatarTraitPreparationFailureReason,
  AvatarTraitPreparationResult,
  PrepareAvatarTraitsResponse,
} from '@gami/shared'

export type { AvatarTraitPreparationFailureReason, AvatarTraitPreparationResult }

export type PrepareScenarioAvatarTraitsInput = {
  scenarioId: string
}

export type PrepareScenarioAvatarTraitsOutput = PrepareAvatarTraitsResponse
