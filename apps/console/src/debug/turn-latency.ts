import type { TurnCompletedEventPayload } from '@gami/shared'
import type { LatencySegment } from '../ui/ui'
import type { AudioRun } from './session-timeline'

/**
 * What the user waited for, in order: transcription (voice only), retrieval, the Avatar LLM call
 * (split at the first token when streamed), the remaining orchestration overhead, and, when the
 * reply was spoken, the text-to-speech request the client made once the text was complete.
 */
export function turnLatencySegments(
  turn: TurnCompletedEventPayload,
  audio: AudioRun | null = null,
): LatencySegment[] {
  const segments: LatencySegment[] = []
  if (turn.speechToTextLatencyMs !== undefined) {
    segments.push({
      label: 'Speech-to-text',
      description: 'Transcribing the recorded audio into the user message',
      ms: turn.speechToTextLatencyMs,
      color: 'var(--lat-stt)',
    })
  }
  if (turn.retrievalLatencyMs !== undefined) {
    segments.push({
      label: 'Knowledge retrieval',
      description: 'Embedding the RAG queries and searching the knowledge chunks',
      ms: turn.retrievalLatencyMs,
      color: 'var(--lat-retrieval)',
    })
  }
  segments.push(...avatarLlmSegments(turn))
  if (turn.otherOverheadMs !== undefined) {
    segments.push({
      label: 'Other',
      description: 'Loading state, assembling the prompt, saving the messages',
      ms: turn.otherOverheadMs,
      color: 'var(--lat-other)',
    })
  }
  if (audio?.status === 'ok') {
    segments.push({
      label: 'Voice generation (text-to-speech)',
      description: 'Turning the finished reply into audio; starts once the whole text is ready',
      ms: audio.payload.latencyMs,
      color: 'var(--lat-tts)',
    })
  }
  return segments
}

// A streamed reply is shown (or spoken) as it arrives, so the wait before its first word matters
// more than the total; non-streamed turns have one undivided Avatar call.
function avatarLlmSegments(turn: TurnCompletedEventPayload): LatencySegment[] {
  const firstToken = turn.avatarFirstTokenLatencyMs
  if (firstToken === undefined || firstToken > turn.avatarLatencyMs) {
    return [
      {
        label: 'Avatar reply (LLM)',
        description: 'The Avatar text model writing the whole reply',
        ms: turn.avatarLatencyMs,
        color: 'var(--lat-llm)',
      },
    ]
  }
  return [
    {
      label: 'Avatar reply: first words (LLM)',
      description: 'The Avatar text model until it sends the first words of the reply',
      ms: firstToken,
      color: 'var(--lat-first-token)',
    },
    {
      label: 'Avatar reply: rest of the text (LLM)',
      description: 'The same LLM call streaming the remaining words, already visible to the user',
      ms: turn.avatarLatencyMs - firstToken,
      color: 'var(--lat-llm)',
    },
  ]
}

/** Wall-clock time from the user finishing speaking or typing to the complete reply text. */
export function turnWaitMs(turn: TurnCompletedEventPayload): number {
  return (turn.speechToTextLatencyMs ?? 0) + turn.totalTurnLatencyMs
}

/** Time until the spoken reply is ready, when audio was generated (excludes client round trips). */
export function turnVoiceReadyMs(
  turn: TurnCompletedEventPayload,
  audio: AudioRun | null,
): number | undefined {
  if (audio?.status !== 'ok') return undefined
  return turnWaitMs(turn) + audio.payload.latencyMs
}

/** Time until the user starts seeing the reply text, when the turn was streamed. */
export function turnFirstReplyMs(turn: TurnCompletedEventPayload): number | undefined {
  if (turn.avatarFirstTokenLatencyMs === undefined) return undefined
  return (
    (turn.speechToTextLatencyMs ?? 0) +
    (turn.retrievalLatencyMs ?? 0) +
    turn.avatarFirstTokenLatencyMs +
    (turn.otherOverheadMs ?? 0)
  )
}
