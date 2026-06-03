import type { RuntimeEvent } from '@gami/shared'
import { apiKey, apiUrl } from '../env'

const normalizeApiUrl = (value: string): string => value.replace(/\/$/, '')

export type RuntimeEventStreamHandlers = {
  onOpen?: () => void
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
  let reconnectAttempt = 0

  while (!signal.aborted) {
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

      reconnectAttempt = 0
      handlers.onOpen?.()
      await consumeEventStream(response.body, handlers.onEvent, signal)
    } catch (error) {
      if (isAbortError(error)) {
        return
      }

      handlers.onError?.(error instanceof Error ? error : new Error('SSE subscription failed'))
    }

    reconnectAttempt += 1
    await waitForReconnectDelay(getReconnectDelayMs(reconnectAttempt), signal)
  }
}

async function consumeEventStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: RuntimeEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (!signal.aborted) {
      const chunk = await reader.read()
      if (chunk.done) {
        return
      }
      buffer += decoder.decode(chunk.value, { stream: true })
      buffer = processFrames(buffer, onEvent)
    }
  } finally {
    reader.releaseLock()
  }
}

function getReconnectDelayMs(attempt: number): number {
  if (attempt <= 1) {
    return 1_000
  }

  if (attempt === 2) {
    return 2_000
  }

  return 5_000
}

async function waitForReconnectDelay(delayMs: number, signal: AbortSignal): Promise<void> {
  if (delayMs <= 0 || signal.aborted) {
    return
  }

  await new Promise<void>((resolve) => {
    const timeoutId = setTimeout(() => {
      signal.removeEventListener('abort', handleAbort)
      resolve()
    }, delayMs)

    function handleAbort(): void {
      clearTimeout(timeoutId)
      signal.removeEventListener('abort', handleAbort)
      resolve()
    }

    signal.addEventListener('abort', handleAbort, { once: true })
  })
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
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
