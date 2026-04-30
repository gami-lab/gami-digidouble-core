export const PROBE_TIMEOUT_MS = 3_000

export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let handle: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        handle = setTimeout(() => {
          reject(new Error('probe timed out'))
        }, timeoutMs)
      }),
    ])
  } finally {
    clearTimeout(handle)
  }
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
