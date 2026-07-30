import { describe, expect, it, vi } from 'vitest'
import type { ILlmAdapter } from '../ports/ILlmAdapter.js'
import { LlmError } from '../../infrastructure/llm/llm.error.js'
import { resolveRoleLlmCall } from './model-resolution-runtime.service.js'

describe('resolveRoleLlmCall', () => {
  it('uses a request-level Avatar model override before persisted configuration', async () => {
    const legacyAdapter = { complete: vi.fn() } as unknown as ILlmAdapter
    const selectedAdapter = { complete: vi.fn() } as unknown as ILlmAdapter
    const modelConfigRepository = {
      get: vi.fn().mockResolvedValue({
        globalDefault: { provider: 'openai', model: 'gpt-4o' },
        roleOverrides: { avatar: { provider: 'anthropic', model: 'claude-sonnet-4-6' } },
        updatedAt: '2026-05-20T00:00:00.000Z',
      }),
      upsert: vi.fn(),
    }
    const llmAdapterRegistry = { get: vi.fn().mockReturnValue(selectedAdapter) }

    await expect(
      resolveRoleLlmCall({
        role: 'avatar',
        legacyAdapter,
        modelConfigRepository,
        llmAdapterRegistry,
        modelConfigFallback: undefined,
        avatarOverride: { provider: 'xai', model: 'grok-4.3' },
        requestOverride: { provider: 'mistral', model: 'mistral-small-4' },
        scenarioModelSelection: undefined,
      }),
    ).resolves.toEqual({
      adapter: selectedAdapter,
      provider: 'mistral',
      model: 'mistral-small-4',
      effectiveModel: 'mistral-small-4',
    })
    expect(llmAdapterRegistry.get).toHaveBeenCalledWith('mistral')
  })

  it('throws a clear role-scoped error when provider adapter is unavailable', async () => {
    const legacyAdapter = { complete: vi.fn() } as unknown as ILlmAdapter
    const modelConfigRepository = {
      get: vi.fn().mockResolvedValue({
        globalDefault: { provider: 'null', model: '' },
        roleOverrides: { avatar: { provider: 'anthropic', model: 'claude-3-7-sonnet' } },
        updatedAt: '2026-05-20T00:00:00.000Z',
      }),
      upsert: vi.fn(),
    }
    const llmAdapterRegistry = {
      get: vi.fn().mockImplementation(() => {
        throw new LlmError('anthropic', 'LLM provider anthropic is not configured', 503)
      }),
    }

    await expect(
      resolveRoleLlmCall({
        role: 'avatar',
        legacyAdapter,
        modelConfigRepository,
        llmAdapterRegistry,
        modelConfigFallback: undefined,
        avatarOverride: undefined,
        scenarioModelSelection: undefined,
      }),
    ).rejects.toMatchObject({
      message: "Provider 'anthropic' is configured for role 'avatar' but no API key is available.",
      statusCode: 503,
    })
  })
})
