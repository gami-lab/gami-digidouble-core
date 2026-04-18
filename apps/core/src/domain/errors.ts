import type { ErrorCode } from '@gami/shared'

export class DomainError extends Error {
  readonly code: ErrorCode

  constructor(code: ErrorCode, message: string) {
    super(message)
    this.name = 'DomainError'
    this.code = code
  }
}
