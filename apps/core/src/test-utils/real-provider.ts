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
  if (error instanceof LlmError) {
    const category = classifyTransientProviderFailure(error.statusCode, error.message)
    if (category !== undefined) {
      skipProviderSmokeTest(context, provider, category, error.statusCode)
    }
  }

  throw error
}

export function skipIfTransientProviderHttpError(
  context: TestContext,
  provider: string,
  statusCode: number,
  message: string | undefined,
): void {
  if (statusCode === 502) {
    const category = classifyTransientProviderFailure(undefined, message ?? '')
    if (category !== undefined) {
      skipProviderSmokeTest(context, provider, category, statusCode)
    }
  }
}

export function skipIfTransientProviderReason(
  context: TestContext,
  provider: string,
  reason: string | undefined,
): void {
  if (reason === 'provider_unavailable') {
    skipProviderSmokeTest(context, provider, 'provider_unavailable')
  }
}

function skipProviderSmokeTest(
  context: TestContext,
  provider: string,
  category: 'quota_or_rate_limit' | 'provider_unavailable',
  statusCode?: number,
): void {
  const reason = formatSkipReason(provider, category, statusCode)
  context.skip(reason)
}

function classifyTransientProviderFailure(
  statusCode: number | undefined,
  message: string,
): 'quota_or_rate_limit' | 'provider_unavailable' | undefined {
  if (statusCode === 429 || /(?:\b429\b|rate[ _-]?limit|rate_limited|no credits)/i.test(message)) {
    return 'quota_or_rate_limit'
  }

  if (
    (statusCode !== undefined && statusCode >= 500) ||
    /(?:\b5\d{2}\b|temporarily unavailable|service unavailable|timeout|network|connection|fetch failed|econnreset|etimedout)/i.test(
      message,
    )
  ) {
    return 'provider_unavailable'
  }

  return undefined
}

function formatSkipReason(
  provider: string,
  category: 'quota_or_rate_limit' | 'provider_unavailable',
  statusCode?: number,
): string {
  const status = statusCode === undefined ? '' : ` status=${String(statusCode)}`
  return `SKIPPED provider=${provider} category=${category}${status}; live provider smoke test`
}
