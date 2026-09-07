import { describe, expect, it, vi, type TestContext } from 'vitest'
import { LlmError } from '../infrastructure/llm/llm.error.js'
import { skipIfTransientProviderError, skipIfTransientProviderHttpError } from './real-provider.js'

function makeContext(): TestContext {
  return {
    skip: vi.fn((note?: string): never => {
      throw new Error(note ?? 'test skipped')
    }),
  } as unknown as TestContext
}

describe('real-provider test helpers', () => {
  it('skips a live adapter test for a quota response', () => {
    const context = makeContext()

    expect(() => {
      skipIfTransientProviderError(context, 'OpenAI', new LlmError('openai', 'no credits', 429))
    }).toThrow('skipping provider smoke test')
    expect(context.skip).toHaveBeenCalledOnce()
  })

  it('rethrows non-transient adapter errors', () => {
    const context = makeContext()
    const error = new LlmError('openai', 'invalid API key', 401)

    expect(() => skipIfTransientProviderError(context, 'OpenAI', error)).toThrow(error)
    expect(context.skip).not.toHaveBeenCalled()
  })

  it('skips an exchange smoke test for a transient provider response', () => {
    const context = makeContext()

    expect(() => {
      skipIfTransientProviderHttpError(context, 'Mistral', 502, 'Status 429: rate limit exceeded')
    }).toThrow('skipping provider smoke test')
    expect(context.skip).toHaveBeenCalledOnce()
  })

  it('does not skip an exchange smoke test for an authentication error', () => {
    const context = makeContext()

    skipIfTransientProviderHttpError(context, 'Mistral', 502, 'Invalid API key')

    expect(context.skip).not.toHaveBeenCalled()
  })
})
