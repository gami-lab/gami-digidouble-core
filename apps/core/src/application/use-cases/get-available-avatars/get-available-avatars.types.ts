import type { AvailableAvatarSummary, GetAvailableAvatarsResponse } from '@gami/shared'

export interface GetAvailableAvatarsInput {
  sessionId: string
}

export type AvatarSummary = AvailableAvatarSummary

export type GetAvailableAvatarsOutput = GetAvailableAvatarsResponse
