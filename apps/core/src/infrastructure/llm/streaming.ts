import type {
  LlmStreamCompletedEvent,
  LlmStreamDeltaEvent,
  LlmResponse,
} from '../../application/ports/ILlmAdapter.js'

export function deltaEvent(text: string): LlmStreamDeltaEvent {
  return { type: 'delta', text }
}

export function completedEvent(response: LlmResponse): LlmStreamCompletedEvent {
  return { type: 'completed', response }
}

export function throwIfAborted(signal: AbortSignal | undefined): void {
  signal?.throwIfAborted()
}

export function isAborted(signal: AbortSignal | undefined): boolean {
  return signal?.aborted ?? false
}
