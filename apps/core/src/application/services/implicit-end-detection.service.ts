import type { ConversationEndReason } from '@gami/shared'

export type ImplicitEndPolicy = {
  enabled: boolean
  inactivityMs?: number
  terminalSignals: string[]
}

export const DEFAULT_IMPLICIT_END_POLICY: ImplicitEndPolicy = {
  enabled: true,
  terminalSignals: ['bye', 'goodbye', 'end conversation'],
}

export function detectImplicitEndReason(input: {
  userMessage: string
  lastActivityAt: string
  now: string
  policy: ImplicitEndPolicy
}): ConversationEndReason | null {
  if (!input.policy.enabled) return null

  const normalized = normalize(input.userMessage)
  if (input.policy.terminalSignals.some((signal) => normalized === normalize(signal))) {
    return 'auto_terminal_signal'
  }

  if (input.policy.inactivityMs !== undefined) {
    const elapsedMs = Date.parse(input.now) - Date.parse(input.lastActivityAt)
    if (Number.isFinite(elapsedMs) && elapsedMs >= input.policy.inactivityMs) {
      return 'inactivity_timeout'
    }
  }

  return null
}

function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/g, '')
    .replace(/\s+/g, ' ')
}
