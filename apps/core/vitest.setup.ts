import { afterEach, beforeEach } from 'vitest'
import { fileURLToPath } from 'node:url'

// ── Environment ───────────────────────────────────────────────────────────────
//
// Load the root .env file into process.env so that module-level constants
// (e.g. DB_AVAILABLE, API key guards) are resolved correctly whether the tests
// are invoked directly via `vitest` or through Turbo.
//
// process.loadEnvFile does NOT overwrite env vars that are already set, so:
//   - Shell-exported vars (dev machine) win
//   - Turbo passThroughEnv vars win
//   - CI/Docker injected secrets win
//   - .env values serve as fallback for local development
{
  const envFile = fileURLToPath(new URL('../../.env', import.meta.url))
  try {
    process.loadEnvFile(envFile)
  } catch {
    // .env is optional — CI and Docker inject secrets as env vars directly
  }
}

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
