/**
 * Silences console.error for the duration of fn() and asserts that at least
 * one emitted message matches expectedPattern.
 *
 * Use this in tests that exercise error-resilience code paths where production
 * code deliberately catches and logs an error. Without this wrapper, the global
 * console.error guard installed in vitest.setup.ts will fail the test.
 *
 * The expectedPattern argument is required — callers must be explicit about
 * what they expect to be logged. This prevents accidentally wrapping code that
 * produces no console output at all.
 *
 * The helper flushes the microtask/macrotask queue after fn() resolves so that
 * fire-and-forget .catch() handlers (e.g. non-blocking observability traces)
 * have a chance to run before validation.
 *
 * @example
 * it('does not propagate errors from trace()', async () => {
 *   mockTrace.mockImplementation(() => { throw new Error('network down') })
 *   await expectConsoleError(
 *     () => adapter.trace(event),
 *     /Failed to record trace.*network down/,
 *   )
 * })
 */
export async function expectConsoleError<T>(
  fn: () => T | Promise<T>,
  expectedPattern: RegExp,
): Promise<T> {
  const captured: string[] = []
  const savedImpl = console.error

  console.error = (...args: unknown[]): void => {
    captured.push(args.map(String).join(' '))
  }

  try {
    const result = await fn()

    // Flush the microtask/macrotask queue so async .catch() handlers have a
    // chance to run before we validate captured messages.
    await new Promise<void>((resolve) => setTimeout(resolve, 0))

    const matched = captured.some((msg) => expectedPattern.test(msg))
    if (!matched) {
      throw new Error(
        `expectConsoleError: expected a console.error matching ${String(expectedPattern)}, but got:${
          captured.length === 0 ? ' (no calls)' : `\n  ${captured.join('\n  ')}`
        }`,
      )
    }

    return result
  } finally {
    // Re-install whatever guard was in place before this call.
    console.error = savedImpl
  }
}
