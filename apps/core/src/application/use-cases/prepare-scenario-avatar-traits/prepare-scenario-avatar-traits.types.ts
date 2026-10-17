import type {
  AvatarTraitPreparationFailureReason,
  AvatarTraitPreparationResult,
  PrepareAvatarTraitsRequest,
  PrepareAvatarTraitsResponse,
} from '@gami/shared'

export type { AvatarTraitPreparationFailureReason, AvatarTraitPreparationResult }

export type PrepareScenarioAvatarTraitsInput = PrepareAvatarTraitsRequest & {
  scenarioId: string
}

export type PrepareScenarioAvatarTraitsOutput = PrepareAvatarTraitsResponse
