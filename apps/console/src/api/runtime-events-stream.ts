import type { RuntimeEvent } from '@gami/shared'
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
      buffer = processFrames(buffer, handlers.onEvent)
    }
  } catch (error) {
    if (signal.aborted) {
      return
    }
    handlers.onError?.(error instanceof Error ? error : new Error('SSE subscription failed'))
  }
}

function processFrames(buffer: string, onEvent: (event: RuntimeEvent) => void): string {
  const frames = buffer.split('\n\n')
  const remainder = frames.pop() ?? ''
  for (const frame of frames) {
    const event = parseRuntimeEventFrame(frame)
    if (event !== null) {
      onEvent(event)
    }
  }
  return remainder
}

function parseRuntimeEventFrame(frame: string): RuntimeEvent | null {
  if (frame.startsWith(':')) {
    return null
  }

  const dataLine = frame
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.startsWith('data:'))

  if (dataLine === undefined) {
    return null
  }

  const data = dataLine.slice(5).trim()
  if (data.length === 0) {
    return null
  }

  try {
    return JSON.parse(data) as RuntimeEvent
  } catch {
    return null
  }
}
