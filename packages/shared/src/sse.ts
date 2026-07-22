/**
 * Generic browser-safe SSE frame helpers. Client surfaces own subscription,
 * reconnect, URL, and authentication behavior; frame parsing lives here so it
 * cannot drift between web and console.
 */
export function processSseFrames(buffer: string, onEvent: (event: unknown) => void): string {
  const frames = buffer.split(/\r?\n\r?\n/)
  const remainder = frames.pop() ?? ''

  for (const frame of frames) {
    const event = parseSseDataFrame(frame)
    if (event !== null) {
      onEvent(event)
    }
  }

  return remainder
}

export function parseSseDataFrame(frame: string): unknown {
  if (frame.startsWith(':')) {
    return null
  }

  const dataLine = frame
    .split(/\r?\n/)
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
    return JSON.parse(data) as unknown
  } catch {
    return null
  }
}
