import { processSseFrames, type RuntimeEvent } from '@gami/shared'
import { apiKey, apiUrl } from '../env'

const normalizeApiUrl = (value: string): string => value.replace(/\/$/, '')

export type RuntimeEventStreamHandlers = {
  onEvent: (event: RuntimeEvent) => void
  onError?: (error: Error) => void
}

export type RuntimeEventStreamSubscription = {
  close: () => void
}

export function subscribeToRuntimeEvents(
  sessionId: string,
  handlers: RuntimeEventStreamHandlers,
): RuntimeEventStreamSubscription {
  const controller = new AbortController()
  void streamRuntimeEvents(sessionId, handlers, controller.signal)
  return {
    close: () => {
      controller.abort()
    },
  }
}

async function streamRuntimeEvents(
  sessionId: string,
  handlers: RuntimeEventStreamHandlers,
  signal: AbortSignal,
): Promise<void> {
  try {
    const response = await fetch(
      `${normalizeApiUrl(apiUrl)}/v1/sessions/${sessionId}/events/stream`,
      {
        method: 'GET',
        headers: {
          'x-api-key': apiKey,
        },
        signal,
      },
    )

    if (!response.ok || response.body === null) {
      throw new Error(`Failed to subscribe to runtime events for ${sessionId}`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (!signal.aborted) {
      const chunk = await reader.read()
      if (chunk.done) {
        break
      }
      buffer += decoder.decode(chunk.value, { stream: true })
      buffer = processSseFrames(buffer, (event) => {
        handlers.onEvent(event as RuntimeEvent)
      })
    }
  } catch (error) {
    if (signal.aborted) {
      return
    }
    handlers.onError?.(error instanceof Error ? error : new Error('SSE subscription failed'))
  }
}
