import { useEffect, useState } from 'react'

/** How long the visitor may stay silent on their turn before a hint appears. */
export const IDLE_HINT_DELAY_MS = 20_000

export type IdleScheduler = {
  schedule: (callback: () => void, delayMs: number) => () => void
}

const browserScheduler: IdleScheduler = {
  schedule: (callback, delayMs) => {
    const timer = setTimeout(callback, delayMs)
    return () => {
      clearTimeout(timer)
    }
  },
}

type IdleHintOptions = {
  /** Only counts idle time while it is the visitor's turn and nothing else is on screen. */
  enabled: boolean
  /** Any change (a message, typing, speech) is visitor input and ends the idle period. */
  activityKey: string
  delayMs?: number
  scheduler?: IdleScheduler
}

/** True once per idle period, until the next visitor input or the hint is no longer allowed. */
export function useIdleHint({
  enabled,
  activityKey,
  delayMs = IDLE_HINT_DELAY_MS,
  scheduler = browserScheduler,
}: IdleHintOptions): boolean {
  const [idle, setIdle] = useState(false)
  useEffect(() => {
    setIdle(false)
    if (!enabled) return
    return scheduler.schedule(() => {
      setIdle(true)
    }, delayMs)
  }, [enabled, activityKey, delayMs, scheduler])
  return idle
}

/** The first starter question the visitor has not asked yet, or null for a generic prompt. */
export function pickIdleHint(
  starterQuestions: readonly string[],
  askedMessages: readonly string[],
): string | null {
  const asked = new Set(askedMessages.map(normalize))
  return starterQuestions.find((question) => !asked.has(normalize(question))) ?? null
}

function normalize(text: string): string {
  return text.trim().toLowerCase()
}
