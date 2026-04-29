import type { AvatarSummary } from '@gami/shared'

export type ListScenarioAvatarsInput = {
  scenarioId: string
}

export type ListScenarioAvatarsOutput = {
  avatars: AvatarSummary[]
}
