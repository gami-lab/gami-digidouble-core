import { normalizeLanguageTag } from '@gami/shared'
import { DomainError } from '../errors.js'

export function normalizeScenarioLanguage(value: unknown): string | undefined {
  const normalized = normalizeLanguageTag(value)
  if (normalized === null) {
    throw new DomainError('INVALID_INPUT', 'language must be a valid BCP-47 language tag.')
  }
  return normalized
}
