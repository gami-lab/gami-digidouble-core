import type { ErrorCode } from '@gami/shared'

export class DomainError extends Error {
  readonly code: ErrorCode
  readonly details?: unknown

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message)
    this.name = 'DomainError'
    this.code = code
    if (details !== undefined) {
      this.details = details
    }
  }
}
