import type { TestContext } from 'vitest'
import { LlmError } from '../infrastructure/llm/llm.error.js'

/**
 * Live-provider smoke tests should not fail the suite when a provider is
 * temporarily unavailable or its test account is out of quota. Other errors
 * still surface as test failures so the smoke tests retain useful coverage.
 */
export function skipIfTransientProviderError(
  context: TestContext,
  provider: string,
  error: unknown,
): never {
  if (error instanceof LlmError && isTransientProviderFailure(error.statusCode, error.message)) {
    context.skip(formatSkipReason(provider, error.statusCode))
  }

  throw error
}

export function skipIfTransientProviderHttpError(
  context: TestContext,
  provider: string,
  statusCode: number,
  message: string | undefined,
): void {
  if (statusCode === 502 && isTransientProviderFailure(undefined, message ?? '')) {
    context.skip(formatSkipReason(provider))
  }
}

function isTransientProviderFailure(statusCode: number | undefined, message: string): boolean {
  if (statusCode === 429 || (statusCode !== undefined && statusCode >= 500)) return true

  return /(?:\b429\b|\b5\d{2}\b|rate[ _-]?limit|rate_limited|no credits|temporarily unavailable|service unavailable|timeout|network|connection|fetch failed|econnreset|etimedout)/i.test(
    message,
  )
}

function formatSkipReason(provider: string, statusCode?: number): string {
  const status =
    statusCode === undefined ? 'temporarily unavailable' : `returned ${String(statusCode)}`
  return `${provider} live API ${status}; skipping provider smoke test`
}
