import { readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { afterEach, beforeEach } from 'vitest'

const dir = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(dir, '../../.env')

try {
  const content = readFileSync(envPath, 'utf8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const value = trimmed.slice(eqIdx + 1).trim()
    if (key && process.env[key] === undefined) {
      process.env[key] = value
    }
  }
} catch {
  // .env not present (CI without local secrets) — tests that require it will skip
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
