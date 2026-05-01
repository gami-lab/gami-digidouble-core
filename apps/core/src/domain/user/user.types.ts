export type UserPersona = {
  role?: string
  tonePreference?: string
  interactionHints?: string[]
}

export type User = {
  userId: string
  persona?: UserPersona
  createdAt: string
  updatedAt: string
}
