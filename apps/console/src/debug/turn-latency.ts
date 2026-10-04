import type { TurnCompletedEventPayload } from '@gami/shared'
import type { LatencySegment } from '../ui/ui'

/**
 * What the user waited for, in order: transcription (voice only), retrieval, the Avatar LLM call
 * (split at the first token when streamed), and the remaining orchestration overhead.
 */
export function turnLatencySegments(turn: TurnCompletedEventPayload): LatencySegment[] {
  const segments: LatencySegment[] = []
  if (turn.speechToTextLatencyMs !== undefined) {
    segments.push({
      label: 'Speech-to-text',
      ms: turn.speechToTextLatencyMs,
      color: 'var(--lat-stt)',
    })
  }
  if (turn.retrievalLatencyMs !== undefined) {
    segments.push({
      label: 'Retrieval',
      ms: turn.retrievalLatencyMs,
      color: 'var(--lat-retrieval)',
    })
  }
  const firstToken = turn.avatarFirstTokenLatencyMs
  if (firstToken !== undefined && firstToken <= turn.avatarLatencyMs) {
    segments.push({ label: 'LLM to first token', ms: firstToken, color: 'var(--lat-first-token)' })
    segments.push({
      label: 'LLM generation',
      ms: turn.avatarLatencyMs - firstToken,
      color: 'var(--lat-llm)',
    })
  } else {
    segments.push({ label: 'Avatar LLM', ms: turn.avatarLatencyMs, color: 'var(--lat-llm)' })
  }
  if (turn.otherOverheadMs !== undefined) {
    segments.push({ label: 'Other', ms: turn.otherOverheadMs, color: 'var(--lat-other)' })
  }
  return segments
}

/** Wall-clock time from the user finishing speaking or typing to the complete reply. */
export function turnWaitMs(turn: TurnCompletedEventPayload): number {
  return (turn.speechToTextLatencyMs ?? 0) + turn.totalTurnLatencyMs
}

/** Time until the user starts seeing (or hearing) a reply, when the turn was streamed. */
export function turnFirstReplyMs(turn: TurnCompletedEventPayload): number | undefined {
  if (turn.avatarFirstTokenLatencyMs === undefined) return undefined
  return (
    (turn.speechToTextLatencyMs ?? 0) +
    (turn.retrievalLatencyMs ?? 0) +
    turn.avatarFirstTokenLatencyMs +
    (turn.otherOverheadMs ?? 0)
  )
}
