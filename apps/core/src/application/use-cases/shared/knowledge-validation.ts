import { findReservedStaticScopeKeys } from '../../../domain/knowledge/static-knowledge-validation.js'
import { DomainError } from '../../../domain/errors.js'

export function assertStaticMetadataAllowed(metadata: Record<string, unknown> | undefined): void {
  const reservedKeys = findReservedStaticScopeKeys(metadata)
  if (reservedKeys.length === 0) return

  throw new DomainError(
    'VALIDATION_ERROR',
    `Static knowledge metadata cannot contain reserved scope keys: ${reservedKeys.join(', ')}.`,
  )
}
