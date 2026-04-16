/**
 * Error thrown by LLM adapters when a provider call fails.
 */
export class LlmError extends Error {
  readonly provider: string
  readonly statusCode: number | undefined

  constructor(provider: string, message: string, statusCode?: number) {
    super(message)
    this.name = 'LlmError'
    this.provider = provider
    this.statusCode = statusCode
  }
}
