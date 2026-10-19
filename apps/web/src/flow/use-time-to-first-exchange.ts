import { useEffect, useRef } from 'react'
import type { FlowStep } from './flow-state'

/**
 * Logs, once per page load, the time from the first landing screen to the visitor's first sent
 * message. Browser console only; nothing is sent anywhere.
 */
export function useTimeToFirstExchange(
  step: FlowStep,
  hasSentMessage: boolean,
  now: () => number = () => performance.now(),
): void {
  const landedAtRef = useRef<number | null>(null)
  const reportedRef = useRef(false)
  useEffect(() => {
    if (step === 'landing' && landedAtRef.current === null) landedAtRef.current = now()
  }, [step, now])
  useEffect(() => {
    const landedAt = landedAtRef.current
    if (!hasSentMessage || landedAt === null || reportedRef.current) return
    reportedRef.current = true
    console.info(`[gami] time to first exchange: ${String(Math.round(now() - landedAt))} ms`)
  }, [hasSentMessage, now])
}
