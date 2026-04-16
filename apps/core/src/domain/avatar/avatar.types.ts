/** Static configuration for an Avatar persona. */
export interface AvatarConfig {
  avatarId: string
  name: string
  description?: string
  /** System prompt / persona instructions. */
  persona?: string
  /** Tone descriptor used to modulate response style. */
  tone?: string
}
