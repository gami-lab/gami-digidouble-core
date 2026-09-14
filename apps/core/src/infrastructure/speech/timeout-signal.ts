export type TimeoutSignal = {
  signal: AbortSignal
  timedOut: () => boolean
  clear: () => void
}

export function createTimeoutSignal(
  callerSignal: AbortSignal | undefined,
  timeoutMs: number,
): TimeoutSignal {
  const timeoutController = new AbortController()
  let timedOut = false
  const timeoutHandle = setTimeout(() => {
    timedOut = true
    timeoutController.abort()
  }, timeoutMs)
  return {
    signal:
      callerSignal === undefined
        ? timeoutController.signal
        : AbortSignal.any([callerSignal, timeoutController.signal]),
    timedOut: () => timedOut,
    clear: () => {
      clearTimeout(timeoutHandle)
    },
  }
}
