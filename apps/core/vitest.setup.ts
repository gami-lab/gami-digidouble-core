import { afterEach, beforeEach } from 'vitest'

// ── Console guards ────────────────────────────────────────────────────────────
//
// Any test that calls console.error or console.warn without opting in will fail
// immediately. This turns accidental or unexpected logging into a hard failure
// instead of silent noise in the test output.
//
// When a test exercises an error-resilience code path that intentionally logs,
// wrap the triggering code in expectConsoleError() from src/test-utils/console.ts.
//
// Direct replacement (not vi.spyOn) is intentional: vi.restoreAllMocks() also
// calls mockRestore() on vi.fn() mocks, which clears their implementations and
// breaks module-level mocks in other test files.

const _originalConsoleError = console.error.bind(console)
const _originalConsoleWarn = console.warn.bind(console)

beforeEach(() => {
  console.error = (...args: unknown[]): void => {
    throw new Error(
      `Unexpected console.error in test — wrap the code in expectConsoleError() if this log is intentional.\n${args.map(String).join(' ')}`,
    )
  }
  console.warn = (...args: unknown[]): void => {
    throw new Error(
      `Unexpected console.warn in test — add a guard if this log is intentional.\n${args.map(String).join(' ')}`,
    )
  }
})

afterEach(() => {
  console.error = _originalConsoleError
  console.warn = _originalConsoleWarn
})
