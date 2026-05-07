import type { UserPersona as SharedUserPersona } from '@gami/shared'

export type UserPersona = SharedUserPersona

export type User = {
  userId: string
  persona?: UserPersona
  createdAt: string
  updatedAt: string
}
