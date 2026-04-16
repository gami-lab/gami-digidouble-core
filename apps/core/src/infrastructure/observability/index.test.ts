import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./langfuse.adapter.js', () => ({
  LangfuseObservabilityAdapter: vi.fn().mockImplementation(() => ({})),
}))
vi.mock('./console.adapter.js', () => ({
  ConsoleObservabilityAdapter: vi.fn().mockImplementation(() => ({})),
}))

import { LangfuseObservabilityAdapter } from './langfuse.adapter.js'
import { ConsoleObservabilityAdapter } from './console.adapter.js'
import { createObservabilityAdapter } from './index.js'

describe('createObservabilityAdapter', () => {
  beforeEach(() => {
    vi.mocked(LangfuseObservabilityAdapter).mockClear()
    vi.mocked(ConsoleObservabilityAdapter).mockClear()
  })

  it('returns LangfuseObservabilityAdapter when both keys are provided', () => {
    createObservabilityAdapter({
      langfusePublicKey: 'pk-test',
      langfuseSecretKey: 'sk-test',
      langfuseHost: 'http://localhost:3030',
    })
    expect(LangfuseObservabilityAdapter).toHaveBeenCalledOnce()
    expect(ConsoleObservabilityAdapter).not.toHaveBeenCalled()
  })

  it('returns ConsoleObservabilityAdapter when public key is missing', () => {
    createObservabilityAdapter({ langfuseSecretKey: 'sk-test' })
    expect(ConsoleObservabilityAdapter).toHaveBeenCalledOnce()
  })

  it('returns ConsoleObservabilityAdapter when secret key is missing', () => {
    createObservabilityAdapter({ langfusePublicKey: 'pk-test' })
    expect(ConsoleObservabilityAdapter).toHaveBeenCalledOnce()
  })

  it('returns ConsoleObservabilityAdapter when no keys are provided', () => {
    createObservabilityAdapter({})
    expect(ConsoleObservabilityAdapter).toHaveBeenCalledOnce()
  })

  it('passes default Langfuse host when langfuseHost is absent', () => {
    createObservabilityAdapter({ langfusePublicKey: 'pk', langfuseSecretKey: 'sk' })
    expect(LangfuseObservabilityAdapter).toHaveBeenCalledWith(
      'pk',
      'sk',
      'https://cloud.langfuse.com',
    )
  })
})
