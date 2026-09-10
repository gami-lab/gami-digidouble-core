import type { AvatarSummary, UpdateAvatarRequest } from '@gami/shared'

export type UpdateAvatarInput = UpdateAvatarRequest & {
  avatarId: string
}

export type UpdateAvatarOutput = {
  avatar: AvatarSummary
}
