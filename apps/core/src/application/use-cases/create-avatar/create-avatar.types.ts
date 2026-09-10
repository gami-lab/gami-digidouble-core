import type { AvatarSummary, CreateAvatarRequest } from '@gami/shared'

export interface CreateAvatarInput extends CreateAvatarRequest {
  scenarioId: string
}

export interface CreateAvatarOutput {
  avatar: AvatarSummary
}
